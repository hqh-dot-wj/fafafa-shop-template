import { Injectable, Logger } from '@nestjs/common';
import { CronExpression } from '@nestjs/schedule';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { OrderAutoCancelConfigService } from './config/order-auto-cancel.config';
import { OrderRepository } from './order.repository';
import { OrderService } from './order.service';

@Injectable()
export class OrderAutoCancelScheduler {
  private readonly logger = new Logger(OrderAutoCancelScheduler.name);
  private readonly lockKey = 'lock:order:auto-cancel:sweep';

  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly orderService: OrderService,
    private readonly redisService: RedisService,
    private readonly autoCancelConfig: OrderAutoCancelConfigService,
  ) {}

  /**
   * 兜底扫描待支付超时订单，防止延迟队列丢失或配置调整后旧订单长期占用库存。
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'order.cancelTimedOutUnpaidOrders',
    name: '订单待支付超时自动取消',
    group: 'STORE',
    cron: CronExpression.EVERY_MINUTE,
    guardMode: 'self-managed',
  })
  @Task({ name: 'order.cancelTimedOutUnpaidOrders', description: '扫描并自动取消超时未支付订单' })
  async cancelTimedOutUnpaidOrders() {
    const options = this.autoCancelConfig.getOptions();
    const lockToken = await this.redisService.tryLock(this.lockKey, options.sweepLockTtlMs);
    if (!lockToken) {
      this.logger.log('跳过待支付超时订单扫描：已有实例正在执行');
      return;
    }

    try {
      await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
        const deadline = new Date(Date.now() - options.timeoutMs);
        const orders = await this.orderRepo.findTimedOutUnpaidOrders(deadline, options.sweepBatchSize);
        let cancelledCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const order of orders) {
          try {
            const result = await this.orderService.cancelOrderBySystem(order.id, options.reason);
            if (result.status === 'cancelled') {
              cancelledCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            failedCount++;
            this.logger.error(`自动取消超时订单失败: orderId=${order.id}, error=${getErrorMessage(error)}`);
          }
        }

        this.logger.log(
          `待支付超时订单扫描完成: deadline=${deadline.toISOString()}, scanned=${orders.length}, cancelled=${cancelledCount}, skipped=${skippedCount}, failed=${failedCount}`,
        );
      });
    } catch (error) {
      this.logger.error(`待支付超时订单扫描失败: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    } finally {
      try {
        await this.redisService.unlock(this.lockKey, lockToken);
      } catch (error) {
        this.logger.warn(`释放待支付超时订单扫描锁失败: ${getErrorMessage(error)}`);
      }
    }
  }
}
