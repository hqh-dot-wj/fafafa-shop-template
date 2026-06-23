import { Test, TestingModule } from '@nestjs/testing';
import { CouponStatus, CouponType, UserCouponStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { ORDER_SERVICE } from 'src/module/client/order/order-service.token';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { UserCouponRepository } from '../distribution/user-coupon.repository';
import { CouponTemplateRepository } from '../template/template.repository';
import { CouponUsageRepository } from './usage.repository';
import { CouponUsageService } from './usage.service';

describe('CouponUsageService', () => {
  let service: CouponUsageService;

  const mockUserCouponRepo = {
    findAvailableCoupons: jest.fn(),
    findById: jest.fn(),
    lockCoupon: jest.fn(),
    useCoupon: jest.fn(),
    unlockCoupon: jest.fn(),
    refundCoupon: jest.fn(),
    refundCouponWithExtend: jest.fn(),
  };

  const mockUsageRepo = {
    create: jest.fn(),
  };

  const mockTemplateRepo = {
    findById: jest.fn(),
  };

  const mockPrisma = {
    mktCouponRefundCompensation: {
      upsert: jest.fn(),
    },
  };

  const mockOrderService = {
    findByIdForMarketing: jest.fn(),
  };

  const mockEventEmitter = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponUsageService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ORDER_SERVICE, useValue: mockOrderService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
        { provide: UserCouponRepository, useValue: mockUserCouponRepo },
        { provide: CouponTemplateRepository, useValue: mockTemplateRepo },
        { provide: CouponUsageRepository, useValue: mockUsageRepo },
      ],
    }).compile();

    service = module.get<CouponUsageService>(CouponUsageService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAvailableCoupons', () => {
    it('无订单上下文时应返回全部可用券', async () => {
      const coupons = [
        {
          id: 'uc1',
          memberId: 'm1',
          status: UserCouponStatus.UNUSED,
          minOrderAmount: 100,
        },
      ];
      mockUserCouponRepo.findAvailableCoupons.mockResolvedValue(coupons);

      const result = await service.findAvailableCoupons('m1');

      expect(result.data).toHaveLength(1);
    });

    it('有订单上下文时应过滤适用券', async () => {
      const coupons = [
        {
          id: 'uc1',
          memberId: 'm1',
          status: UserCouponStatus.UNUSED,
          minOrderAmount: 50,
          applicableProducts: [],
          applicableCategories: [],
        },
      ];
      mockUserCouponRepo.findAvailableCoupons.mockResolvedValue(coupons);

      const result = await service.findAvailableCoupons('m1', {
        memberId: 'm1',
        orderAmount: 100,
        productIds: [],
        categoryIds: [],
      });

      expect(result.data).toBeDefined();
    });
  });

  describe('validateCoupon', () => {
    it('优惠券不存在应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue(null);

      await expect(
        service.validateCoupon('uc1', {
          memberId: 'm1',
          orderAmount: 100,
          productIds: [],
          categoryIds: [],
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('非当前用户券应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        memberId: 'm2',
        status: UserCouponStatus.UNUSED,
        startTime: new Date(0),
        endTime: new Date(Date.now() + 86400000),
        minOrderAmount: 50,
        applicableProducts: [],
        applicableCategories: [],
      });

      await expect(
        service.validateCoupon('uc1', {
          memberId: 'm1',
          orderAmount: 100,
          productIds: [],
          categoryIds: [],
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('订单金额未达最低消费应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        memberId: 'm1',
        status: UserCouponStatus.UNUSED,
        startTime: new Date(0),
        endTime: new Date(Date.now() + 86400000),
        minOrderAmount: 200,
        applicableProducts: [],
        applicableCategories: [],
      });

      await expect(
        service.validateCoupon('uc1', {
          memberId: 'm1',
          orderAmount: 100,
          productIds: [],
          categoryIds: [],
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('验证通过应返回 valid', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        memberId: 'm1',
        status: UserCouponStatus.UNUSED,
        startTime: new Date(0),
        endTime: new Date(Date.now() + 86400000),
        minOrderAmount: 50,
        applicableProducts: [],
        applicableCategories: [],
      });

      const result = await service.validateCoupon('uc1', {
        memberId: 'm1',
        orderAmount: 100,
        productIds: [],
        categoryIds: [],
      });

      expect(result.data.valid).toBe(true);
    });
  });

  describe('calculateDiscount', () => {
    it('优惠券不存在应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue(null);

      await expect(service.calculateDiscount('uc1', 100)).rejects.toThrow(BusinessException);
    });

    it('满减券应返回固定金额', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        couponType: CouponType.DISCOUNT,
        discountAmount: 20,
        discountPercent: null,
        maxDiscountAmount: null,
        minOrderAmount: 100,
      });

      const discount = await service.calculateDiscount('uc1', 150);
      expect(discount).toBe(20);
    });

    it('折扣券应按比例计算且不超过最高优惠', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        couponType: CouponType.PERCENTAGE,
        discountAmount: null,
        discountPercent: 10,
        maxDiscountAmount: 15,
        minOrderAmount: 100,
      });

      const discount = await service.calculateDiscount('uc1', 200);
      expect(discount).toBe(15); // 200*0.1=20, cap 15
    });

    it('优惠不超过订单金额', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        couponType: CouponType.DISCOUNT,
        discountAmount: 500,
        minOrderAmount: 100,
      });

      const discount = await service.calculateDiscount('uc1', 80);
      expect(discount).toBe(80);
    });
  });

  describe('lockCoupon', () => {
    it('更新数为 0 应抛异常', async () => {
      mockUserCouponRepo.lockCoupon.mockResolvedValue({ count: 0 });

      await expect(service.lockCoupon('uc1', 'order1')).rejects.toThrow(BusinessException);
    });

    it('应成功锁定', async () => {
      mockUserCouponRepo.lockCoupon.mockResolvedValue({ count: 1 });

      await service.lockCoupon('uc1', 'order1');

      expect(mockUserCouponRepo.lockCoupon).toHaveBeenCalledWith('uc1', 'order1');
    });
  });

  describe('useCoupon', () => {
    it('优惠券不存在应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue(null);

      await expect(service.useCoupon('uc1', 'order1', 20)).rejects.toThrow(BusinessException);
    });

    it('应更新状态并创建使用记录', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        tenantId: '00000',
        memberId: 'm1',
        templateId: 't1',
      });
      mockUserCouponRepo.useCoupon.mockResolvedValue({ count: 1 });
      mockOrderService.findByIdForMarketing.mockResolvedValue({
        totalAmount: new Decimal(100),
      });
      mockUsageRepo.create.mockResolvedValue({});

      await service.useCoupon('uc1', 'order1', 20);

      expect(mockUserCouponRepo.useCoupon).toHaveBeenCalledWith('uc1', 'order1');
      expect(mockUsageRepo.create).toHaveBeenCalled();
      expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MarketingEventType.COUPON_USED,
          instanceId: 'uc1',
          memberId: 'm1',
          configId: 't1',
        }),
      );
    });

    it('Given 优惠券未被当前订单锁定, When useCoupon, Then 不创建使用记录或事件', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        tenantId: '00000',
        memberId: 'm1',
        templateId: 't1',
        status: UserCouponStatus.UNUSED,
        orderId: null,
      });
      mockUserCouponRepo.useCoupon.mockResolvedValue({ count: 0 });

      await expect(service.useCoupon('uc1', 'order2', 20)).rejects.toThrow(BusinessException);

      expect(mockOrderService.findByIdForMarketing).not.toHaveBeenCalled();
      expect(mockUsageRepo.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.dispatch).not.toHaveBeenCalled();
    });

    // 问题 4：同 (userCouponId, orderId) 重投 — CAS count=0 后必须重新读取当前状态，不能使用 CAS 前旧快照
    it('Given useCoupon 并发重投同 orderId 且 CAS 前快照仍是 LOCKED, When 调用, Then 重新读当前 USED 状态后幂等成功', async () => {
      mockUserCouponRepo.findById
        .mockResolvedValueOnce({
          id: 'uc1',
          tenantId: '00000',
          memberId: 'm1',
          templateId: 't1',
          status: UserCouponStatus.LOCKED,
          orderId: 'order1',
        })
        .mockResolvedValueOnce({
          id: 'uc1',
          tenantId: '00000',
          memberId: 'm1',
          templateId: 't1',
          status: UserCouponStatus.USED,
          orderId: 'order1',
        });
      mockUserCouponRepo.useCoupon.mockResolvedValue({ count: 0 });
      mockOrderService.findByIdForMarketing.mockResolvedValue({ totalAmount: new Decimal(100) });
      mockUsageRepo.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.useCoupon('uc1', 'order1', 20)).resolves.toBeUndefined();
      expect(mockUserCouponRepo.findById).toHaveBeenCalledTimes(2);
      expect(mockEventEmitter.dispatch).not.toHaveBeenCalled();
    });

    // 问题 4：CAS count=1 但 usage create 抛 P2002（防御边界，应被 catch 幂等吞掉）
    it('Given useCoupon CAS 成功但 usage 创建冲突, When 调用, Then 由唯一约束兜底吞掉', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        tenantId: '00000',
        memberId: 'm1',
        templateId: 't1',
        status: UserCouponStatus.LOCKED,
        orderId: 'order1',
      });
      mockUserCouponRepo.useCoupon.mockResolvedValue({ count: 1 });
      mockOrderService.findByIdForMarketing.mockResolvedValue({ totalAmount: new Decimal(100) });
      mockUsageRepo.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.useCoupon('uc1', 'order1', 20)).resolves.toBeUndefined();
      expect(mockEventEmitter.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('unlockCoupon', () => {
    it('应调用仓储解锁', async () => {
      mockUserCouponRepo.unlockCoupon.mockResolvedValue({ count: 1 });

      await service.unlockCoupon('uc1', 'order1');

      expect(mockUserCouponRepo.unlockCoupon).toHaveBeenCalledWith('uc1', 'order1');
    });

    it('Given 优惠券未被当前订单锁定, When unlockCoupon, Then 抛出异常', async () => {
      mockUserCouponRepo.unlockCoupon.mockResolvedValue({ count: 0 });

      await expect(service.unlockCoupon('uc1', 'order2')).rejects.toThrow(BusinessException);
    });
  });

  describe('refundCoupon', () => {
    it('优惠券不存在应抛异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue(null);

      await expect(service.refundCoupon('uc1', 'order1')).rejects.toThrow(BusinessException);
    });

    // 问题 7-B3：已过期 + 模板 ACTIVE → 自动延期 N 天
    it('Given 券已过期且模板 ACTIVE, When refundCoupon, Then 调用 refundCouponWithExtend 延期 N 天', async () => {
      const past = new Date(Date.now() - 86400000);
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        tenantId: '00000',
        memberId: 'm1',
        templateId: 'tpl1',
        endTime: past,
      });
      mockTemplateRepo.findById.mockResolvedValue({
        id: 'tpl1',
        status: CouponStatus.ACTIVE,
        refundExpireExtendDays: 7,
      });
      mockUserCouponRepo.refundCouponWithExtend.mockResolvedValue({ count: 1 });

      await service.refundCoupon('uc1', 'order1');

      expect(mockUserCouponRepo.refundCouponWithExtend).toHaveBeenCalledTimes(1);
      const args = mockUserCouponRepo.refundCouponWithExtend.mock.calls[0];
      expect(args[0]).toBe('uc1');
      expect(args[1]).toBe('order1');
      // newEndTime ≈ now + 7d，允许 1 分钟漂移
      const newEnd = args[2] as Date;
      const diffMs = newEnd.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(7 * 86400000 - 60_000);
      expect(diffMs).toBeLessThan(7 * 86400000 + 60_000);
      expect(mockPrisma.mktCouponRefundCompensation.upsert).not.toHaveBeenCalled();
    });

    // 问题 7-B3 降级：已过期 + 模板 INACTIVE → 写补偿表
    it('Given 券已过期且模板已停用, When refundCoupon, Then 降级写 MktCouponRefundCompensation', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        tenantId: '00000',
        memberId: 'm1',
        templateId: 'tpl1',
        endTime: new Date(Date.now() - 86400000),
      });
      mockTemplateRepo.findById.mockResolvedValue({
        id: 'tpl1',
        status: CouponStatus.INACTIVE,
        refundExpireExtendDays: 7,
      });

      await service.refundCoupon('uc1', 'order1');

      expect(mockUserCouponRepo.refundCouponWithExtend).not.toHaveBeenCalled();
      expect(mockPrisma.mktCouponRefundCompensation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userCouponId_orderId: { userCouponId: 'uc1', orderId: 'order1' } },
          create: expect.objectContaining({
            templateId: 'tpl1',
            userCouponId: 'uc1',
            orderId: 'order1',
            reason: 'TEMPLATE_INACTIVE',
          }),
        }),
      );
    });

    it('未过期应调用返还', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        endTime: new Date(Date.now() + 86400000),
      });
      mockUserCouponRepo.refundCoupon.mockResolvedValue({ count: 1 });

      await service.refundCoupon('uc1', 'order1');

      expect(mockUserCouponRepo.refundCoupon).toHaveBeenCalledWith('uc1', 'order1');
    });

    it('Given 优惠券不是当前订单已使用状态, When refundCoupon, Then 抛出异常', async () => {
      mockUserCouponRepo.findById.mockResolvedValue({
        id: 'uc1',
        endTime: new Date(Date.now() + 86400000),
      });
      mockUserCouponRepo.refundCoupon.mockResolvedValue({ count: 0 });

      await expect(service.refundCoupon('uc1', 'order2')).rejects.toThrow(BusinessException);
    });
  });
});
