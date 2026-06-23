import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { RedisService } from 'src/module/common/redis/redis.service';
import { UserCouponRepository } from '../distribution/user-coupon.repository';
import { MessageTouchpointDispatcher } from '../../events/message-touchpoint.dispatcher';
import { MarketingEventType } from '../../events/marketing-event.types';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 优惠券定时任务服务
 *
 * @description 处理优惠券的定时清理任务，如过期优惠券处理
 */
@Injectable()
export class CouponSchedulerService {
  private readonly logger = new Logger(CouponSchedulerService.name);
  private readonly lockKey = 'lock:marketing:coupon:scheduler:clean-expired-coupons';
  private readonly lockedExpiredLockKey = 'lock:marketing:coupon:scheduler:clean-locked-expired-coupons';
  private readonly lockTtlMs = 5 * 60 * 1000;
  private readonly batchSize = 500;

  constructor(
    private readonly userCouponRepo: UserCouponRepository,
    private readonly redisService: RedisService,
    private readonly messageTouchpointDispatcher: MessageTouchpointDispatcher,
  ) {}

  /**
   * 清理过期优惠券
   * 每天凌晨 2 点执行
   */
  @CodeManagedJob({
    key: 'coupon.cleanExpiredCoupons',
    name: '清理过期优惠券',
    group: 'MARKETING',
    cron: CronExpression.EVERY_DAY_AT_2AM,
    guardMode: 'self-managed',
  })
  @Task({ name: 'coupon.cleanExpiredCoupons', description: '清理过期优惠券' })
  async cleanExpiredCoupons() {
    const lockToken = await this.redisService.tryLock(this.lockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('跳过清理过期优惠券：已有实例正在执行');
      return;
    }

    this.logger.log('开始清理过期优惠券...');

    try {
      let totalCount = 0;

      while (true) {
        const ids = await this.userCouponRepo.findExpiredCouponIds(this.batchSize);
        if (ids.length === 0) {
          break;
        }

        const count = await this.userCouponRepo.markCouponsExpiredByIds(ids);
        const expiredCoupons = await this.userCouponRepo.findExpiredCouponsByIds(ids);
        await Promise.all(
          expiredCoupons.map((coupon) =>
            this.messageTouchpointDispatcher.dispatch({
              type: MarketingEventType.COUPON_EXPIRED,
              tenantId: coupon.tenantId,
              instanceId: coupon.id,
              configId: coupon.templateId,
              memberId: coupon.memberId,
              payload: {
                templateId: coupon.templateId,
                endTime: coupon.endTime,
                source: 'scheduler',
              },
              timestamp: new Date(),
            }),
          ),
        );
        totalCount += count;

        this.logger.log(`过期优惠券批次处理完成: batch=${ids.length}, updated=${count}, total=${totalCount}`);

        if (ids.length < this.batchSize) {
          break;
        }
      }

      this.logger.log(`清理过期优惠券完成，共处理 ${totalCount} 张优惠券`);
    } catch (error) {
      this.logger.error(`清理过期优惠券失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`释放清理过期优惠券锁失败: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * 清理 LOCKED 超时优惠券（问题 13）
   *
   * @description LOCKED 状态的券应随订单生命周期解锁或转 USED；
   * 当上游事件链路异常导致挂死时，到了 endTime 之后仍是 LOCKED，
   * 让账面状态长期不收敛、影响统计。本任务每天 02:30 把这部分券转 EXPIRED。
   */
  @CodeManagedJob({
    key: 'coupon.cleanLockedExpiredCoupons',
    name: '清理 LOCKED 超时优惠券',
    group: 'MARKETING',
    cron: '0 30 2 * * *',
    guardMode: 'self-managed',
  })
  @Task({ name: 'coupon.cleanLockedExpiredCoupons', description: '清理 LOCKED 超时优惠券' })
  async cleanLockedExpiredCoupons() {
    const lockToken = await this.redisService.tryLock(this.lockedExpiredLockKey, this.lockTtlMs);
    if (!lockToken) {
      this.logger.log('跳过清理 LOCKED 超时优惠券：已有实例正在执行');
      return;
    }

    this.logger.log('开始清理 LOCKED 超时优惠券...');

    try {
      let totalCount = 0;

      while (true) {
        const ids = await this.userCouponRepo.findLockedExpiredCouponIds(this.batchSize);
        if (ids.length === 0) {
          break;
        }

        const count = await this.userCouponRepo.markLockedCouponsExpiredByIds(ids);
        const expiredCoupons = await this.userCouponRepo.findExpiredCouponsByIds(ids);
        await Promise.all(
          expiredCoupons.map((coupon) =>
            this.messageTouchpointDispatcher.dispatch({
              type: MarketingEventType.COUPON_EXPIRED,
              tenantId: coupon.tenantId,
              instanceId: coupon.id,
              configId: coupon.templateId,
              memberId: coupon.memberId,
              payload: {
                templateId: coupon.templateId,
                endTime: coupon.endTime,
                source: 'scheduler:locked-expired',
              },
              timestamp: new Date(),
            }),
          ),
        );
        totalCount += count;

        this.logger.log(`LOCKED 超时券批次处理完成: batch=${ids.length}, updated=${count}, total=${totalCount}`);

        if (ids.length < this.batchSize) {
          break;
        }
      }

      this.logger.log(`清理 LOCKED 超时优惠券完成，共处理 ${totalCount} 张`);
    } catch (error) {
      this.logger.error(`清理 LOCKED 超时优惠券失败: ${getErrorMessage(error)}`, getErrorStack(error));
    } finally {
      try {
        await this.redisService.unlock(this.lockedExpiredLockKey, lockToken);
      } catch (error) {
        this.logger.warn(`释放清理 LOCKED 超时优惠券锁失败: ${getErrorMessage(error)}`);
      }
    }
  }
}
