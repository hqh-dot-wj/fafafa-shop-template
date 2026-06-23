import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from 'src/module/common/redis/redis.service';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { UserCouponRepository } from '../distribution/user-coupon.repository';
import { CouponSchedulerService } from './scheduler.service';

describe('CouponSchedulerService', () => {
  let service: CouponSchedulerService;

  const mockUserCouponRepo = {
    findExpiredCouponIds: jest.fn(),
    markCouponsExpiredByIds: jest.fn(),
    findExpiredCouponsByIds: jest.fn(),
    findLockedExpiredCouponIds: jest.fn(),
    markLockedCouponsExpiredByIds: jest.fn(),
  };

  const mockRedisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  const mockEventEmitter = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponSchedulerService,
        { provide: UserCouponRepository, useValue: mockUserCouponRepo },
        { provide: RedisService, useValue: mockRedisService },
        { provide: MessageTouchpointDispatcher, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<CouponSchedulerService>(CouponSchedulerService);
    jest.clearAllMocks();
  });

  // R-CONCUR-COUPON-01
  it('Given 未获得分布式锁, When cleanExpiredCoupons, Then 跳过执行仓储清理', async () => {
    mockRedisService.tryLock.mockResolvedValue(false);

    await service.cleanExpiredCoupons();

    expect(mockUserCouponRepo.findExpiredCouponIds).not.toHaveBeenCalled();
    expect(mockUserCouponRepo.markCouponsExpiredByIds).not.toHaveBeenCalled();
    expect(mockRedisService.unlock).not.toHaveBeenCalled();
  });

  // R-FLOW-COUPON-01
  it('Given 获得分布式锁, When cleanExpiredCoupons, Then 执行清理并释放锁', async () => {
    mockRedisService.tryLock.mockResolvedValue(true);
    mockUserCouponRepo.findExpiredCouponIds.mockResolvedValueOnce(['c1', 'c2', 'c3']).mockResolvedValueOnce([]);
    mockUserCouponRepo.markCouponsExpiredByIds.mockResolvedValue(3);
    mockUserCouponRepo.findExpiredCouponsByIds.mockResolvedValue([
      { id: 'c1', tenantId: 't1', memberId: 'm1', templateId: 'tpl1', endTime: new Date() },
      { id: 'c2', tenantId: 't1', memberId: 'm2', templateId: 'tpl1', endTime: new Date() },
      { id: 'c3', tenantId: 't1', memberId: 'm3', templateId: 'tpl2', endTime: new Date() },
    ]);
    mockRedisService.unlock.mockResolvedValue(1);

    await service.cleanExpiredCoupons();

    expect(mockUserCouponRepo.findExpiredCouponIds).toHaveBeenCalledTimes(1);
    expect(mockUserCouponRepo.markCouponsExpiredByIds).toHaveBeenCalledWith(['c1', 'c2', 'c3']);
    expect(mockUserCouponRepo.findExpiredCouponsByIds).toHaveBeenCalledWith(['c1', 'c2', 'c3']);
    expect(mockEventEmitter.dispatch).toHaveBeenCalledTimes(3);
    expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MarketingEventType.COUPON_EXPIRED,
        tenantId: 't1',
      }),
    );
    expect(mockRedisService.unlock).toHaveBeenCalledTimes(1);
  });

  // 问题 13：清理 LOCKED 超时优惠券 — 未获锁应跳过
  it('Given 未获得分布式锁, When cleanLockedExpiredCoupons, Then 跳过执行', async () => {
    mockRedisService.tryLock.mockResolvedValue(false);

    await service.cleanLockedExpiredCoupons();

    expect(mockUserCouponRepo.findLockedExpiredCouponIds).not.toHaveBeenCalled();
    expect(mockUserCouponRepo.markLockedCouponsExpiredByIds).not.toHaveBeenCalled();
    expect(mockRedisService.unlock).not.toHaveBeenCalled();
  });

  // 问题 13：清理 LOCKED 超时优惠券 — 正常路径
  it('Given 获得分布式锁, When cleanLockedExpiredCoupons, Then 转 EXPIRED 并发事件', async () => {
    mockRedisService.tryLock.mockResolvedValue(true);
    mockUserCouponRepo.findLockedExpiredCouponIds.mockResolvedValueOnce(['lc1', 'lc2']).mockResolvedValueOnce([]);
    mockUserCouponRepo.markLockedCouponsExpiredByIds.mockResolvedValue(2);
    mockUserCouponRepo.findExpiredCouponsByIds.mockResolvedValue([
      { id: 'lc1', tenantId: 't1', memberId: 'm1', templateId: 'tpl1', endTime: new Date() },
      { id: 'lc2', tenantId: 't1', memberId: 'm2', templateId: 'tpl1', endTime: new Date() },
    ]);
    mockRedisService.unlock.mockResolvedValue(1);

    await service.cleanLockedExpiredCoupons();

    expect(mockUserCouponRepo.markLockedCouponsExpiredByIds).toHaveBeenCalledWith(['lc1', 'lc2']);
    expect(mockEventEmitter.dispatch).toHaveBeenCalledTimes(2);
    expect(mockEventEmitter.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: MarketingEventType.COUPON_EXPIRED,
        payload: expect.objectContaining({ source: 'scheduler:locked-expired' }),
      }),
    );
  });
});
