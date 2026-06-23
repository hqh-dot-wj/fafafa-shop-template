import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CronExpression } from '@nestjs/schedule';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { OrderQueryPort } from '../ports/order-query.port';

/**
 * 佣金补偿调度器
 *
 * @description
 * 每小时扫描支付成功但缺少佣金记录的订单，重新入队计算。
 * 防止 Redis 宕机导致的队列消息丢失造成漏佣。
 *
 * 补偿窗口：payTime 在 [1h, 24h] 前的订单。
 * - 下限 1h：留足正常队列处理时间，避免与正常流程并发。
 * - 上限 24h：超过 24h 无佣金记录视为合法零佣金（纯兑换商品、自购、黑名单等），停止重试。
 */
@Injectable()
export class CommissionCompensationScheduler {
  private readonly logger = new Logger(CommissionCompensationScheduler.name);

  constructor(
    private readonly orderQueryPort: OrderQueryPort,
    @InjectQueue('CALC_COMMISSION') private readonly commissionQueue: Queue,
  ) {}

  @IgnoreTenant()
  @CodeManagedJob({
    key: 'finance.commissionCompensateJob',
    name: '佣金漏算补偿扫描',
    group: 'FINANCE',
    cron: CronExpression.EVERY_HOUR,
    guardMode: 'self-managed',
  })
  @Task({ name: 'finance.commissionCompensateJob', description: '佣金漏算补偿扫描' })
  async compensateJob() {
    // Phase D2: findPaidOrdersMissingCommissions 跨租户扫描 paid orders，cron path 必须显式
    // 进入 super-tenant context；Bull 入队 payload 已显式带 tenantId，消费者读 payload 即可。
    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() - 60 * 60 * 1000);

      const missed = await this.orderQueryPort.findPaidOrdersMissingCommissions(windowStart, windowEnd, 200);

      if (missed.length === 0) return;

      this.logger.warn(`[CommissionCompensation] Found ${missed.length} orders missing commissions, re-enqueuing`);

      for (const order of missed) {
        await this.commissionQueue.add(
          { orderId: order.id, tenantId: order.tenantId },
          {
            jobId: `calc:commission:${order.id}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            // Bull 默认会拒绝重复的 jobId 入队，导致同一订单一旦失败/完成就再也补不上。
            // 跑完即销毁让下一轮补偿可重新入队；失败排查走 commission 事件 + job 日志。
            removeOnComplete: true,
            removeOnFail: true,
          },
        );
      }
    });
  }
}
