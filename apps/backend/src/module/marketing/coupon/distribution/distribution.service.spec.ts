import { Test, TestingModule } from '@nestjs/testing';
import { CouponStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { ORDER_SERVICE } from 'src/module/client/order/order-service.token';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { CouponTemplateRepository } from '../template/template.repository';
import { UserCouponRepository } from './user-coupon.repository';
import { RedisLockService } from './redis-lock.service';
import { CouponDistributionService } from './distribution.service';

describe('CouponDistributionService', () => {
  let service: CouponDistributionService;

  const mockTemplateRepo = {
    findById: jest.fn(),
  };

  const mockUserCouponRepo = {
    countUserCoupons: jest.fn(),
    tryClaim: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn(),
  };

  const mockOrderService = {
    findByIdForMarketing: jest.fn(),
  };

  const mockEventEmitter = {
    dispatch: jest.fn(),
  };

  const mockRedisLock = {
    getCouponStockLockKey: jest.fn().mockReturnValue('lock:coupon:stock:t1'),
    getUserClaimLockKey: jest.fn().mockReturnValue('lock:coupon:claim:m1:t1'),
    // 双层锁：测试时直接放行所有 executeWithLock 调用，按嵌套顺序执行回调
    executeWithLock: jest.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponDistributionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ORDER_SERVICE, useValue: mockOrderService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
        { provide: RedisLockService, useValue: mockRedisLock },
        { provide: CouponTemplateRepository, useValue: mockTemplateRepo },
        { provide: UserCouponRepository, useValue: mockUserCouponRepo },
      ],
    }).compile();

    service = module.get<CouponDistributionService>(CouponDistributionService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkEligibility', () => {
    it('模板不存在或已停用应返回不可领取', async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      const result = await service.checkEligibility('m1', 't1');

      expect(result.data.eligible).toBe(false);
      expect(result.data.reason).toBeDefined();
    });

    it('库存为 0 应返回不可领取', async () => {
      mockTemplateRepo.findById.mockResolvedValue({
        id: 't1',
        status: CouponStatus.ACTIVE,
        remainingStock: 0,
        limitPerUser: 1,
      });

      const result = await service.checkEligibility('m1', 't1');

      expect(result.data.eligible).toBe(false);
    });

    it('已达领取上限应返回不可领取', async () => {
      mockTemplateRepo.findById.mockResolvedValue({
        id: 't1',
        status: CouponStatus.ACTIVE,
        remainingStock: 100,
        limitPerUser: 1,
      });
      mockUserCouponRepo.countUserCoupons.mockResolvedValue(1);

      const result = await service.checkEligibility('m1', 't1');

      expect(result.data.eligible).toBe(false);
    });

    it('符合条件应返回可领取', async () => {
      mockTemplateRepo.findById.mockResolvedValue({
        id: 't1',
        status: CouponStatus.ACTIVE,
        remainingStock: 100,
        limitPerUser: 2,
      });
      mockUserCouponRepo.countUserCoupons.mockResolvedValue(0);

      const result = await service.checkEligibility('m1', 't1');

      expect(result.data.eligible).toBe(true);
    });
  });

  describe('claimCoupon', () => {
    it('应通过事务内原子库存扣减和 tryClaim 领取并返回结果', async () => {
      const userCoupon = {
        id: 'uc1',
        memberId: 'm1',
        templateId: 't1',
        status: 'UNUSED',
        startTime: new Date('2026-05-01T00:00:00.000Z'),
        endTime: new Date('2026-05-31T00:00:00.000Z'),
        createTime: new Date(),
      };

      const moduleRef = await Test.createTestingModule({
        providers: [
          CouponDistributionService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: ORDER_SERVICE, useValue: mockOrderService },
          { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
          { provide: RedisLockService, useValue: mockRedisLock },
          { provide: CouponTemplateRepository, useValue: mockTemplateRepo },
          { provide: UserCouponRepository, useValue: mockUserCouponRepo },
        ],
      }).compile();

      const svc = moduleRef.get<CouponDistributionService>(CouponDistributionService);
      const template = {
        id: 't1',
        tenantId: '00000',
        name: '满100减20',
        type: 'DISCOUNT',
        status: CouponStatus.ACTIVE,
        remainingStock: 10,
        limitPerUser: 1,
        discountAmount: 20,
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: 100,
        validityType: 'RELATIVE',
        validDays: 30,
        startTime: null,
        endTime: null,
      };
      mockTemplateRepo.findById.mockResolvedValue(template);
      mockUserCouponRepo.countUserCoupons.mockResolvedValue(0);
      mockUserCouponRepo.tryClaim.mockResolvedValue(userCoupon);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          mktCouponTemplate: {
            findUnique: jest.fn().mockResolvedValue(template),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      });

      const result = await svc.claimCoupon('m1', 't1');

      expect(result.data).toBeDefined();
      expect(result.msg).toContain('领取成功');
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.COUPON_CLAIMED,
          instanceId: 'uc1',
          configId: 't1',
          memberId: 'm1',
        }),
      );
      expect(mockRedisLock.executeWithLock).not.toHaveBeenCalled();
      expect(mockUserCouponRepo.countUserCoupons).not.toHaveBeenCalled();
      expect(mockUserCouponRepo.tryClaim).toHaveBeenCalledWith(
        expect.objectContaining({
          memberId: 'm1',
          templateId: 't1',
          limitPerUser: 1,
        }),
        expect.any(Object),
      );
    });

    it('并发 ord 唯一冲突时应在同一事务内重试一次 tryClaim', async () => {
      const template = {
        id: 't1',
        tenantId: '00000',
        name: '满100减20',
        type: 'DISCOUNT',
        status: CouponStatus.ACTIVE,
        remainingStock: 10,
        limitPerUser: 3,
        discountAmount: 20,
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: 100,
        validityType: 'RELATIVE',
        validDays: 30,
        startTime: null,
        endTime: null,
      };
      const userCoupon = {
        id: 'uc2',
        memberId: 'm1',
        templateId: 't1',
        status: 'UNUSED',
        startTime: new Date('2026-05-01T00:00:00.000Z'),
        endTime: new Date('2026-05-31T00:00:00.000Z'),
      };
      mockUserCouponRepo.tryClaim.mockRejectedValueOnce({ code: 'P2002' }).mockResolvedValueOnce(userCoupon);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          mktCouponTemplate: {
            findUnique: jest.fn().mockResolvedValue(template),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      });

      const result = await service.claimCoupon('m1', 't1');

      expect(result.data.id).toBe('uc2');
      expect(mockUserCouponRepo.tryClaim).toHaveBeenCalledTimes(2);
    });

    it('tryClaim 返回 null 时应抛出领取上限异常并由事务回滚库存扣减', async () => {
      const template = {
        id: 't1',
        tenantId: '00000',
        name: '满100减20',
        type: 'DISCOUNT',
        status: CouponStatus.ACTIVE,
        remainingStock: 10,
        limitPerUser: 1,
        discountAmount: 20,
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: 100,
        validityType: 'RELATIVE',
        validDays: 30,
        startTime: null,
        endTime: null,
      };
      mockUserCouponRepo.tryClaim.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(async (cb) => {
        const tx = {
          mktCouponTemplate: {
            findUnique: jest.fn().mockResolvedValue(template),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      });

      await expect(service.claimCoupon('m1', 't1')).rejects.toThrow(BusinessException);
      expect(mockRedisLock.executeWithLock).not.toHaveBeenCalled();
    });
  });

  describe('distributeManually', () => {
    it('手动发放超过500人应抛异常', async () => {
      await expect(
        service.distributeManually({
          templateId: 't1',
          memberIds: Array.from({ length: 501 }, (_, i) => `m${i}`),
        }),
      ).rejects.toThrow(BusinessException);
      expect(mockTemplateRepo.findById).not.toHaveBeenCalled();
    });

    it('模板不存在应抛异常', async () => {
      mockTemplateRepo.findById.mockResolvedValue(null);

      await expect(
        service.distributeManually({
          templateId: 't1',
          memberIds: ['m1'],
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('模板已停用应抛异常', async () => {
      mockTemplateRepo.findById.mockResolvedValue({
        id: 't1',
        status: CouponStatus.INACTIVE,
      });

      await expect(
        service.distributeManually({
          templateId: 't1',
          memberIds: ['m1'],
        }),
      ).rejects.toThrow(BusinessException);
    });
  });
});
