import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { OrderIntegrationService } from './integration.service';
import {
  ORDER_MARKETING_CANCELLED,
  ORDER_MARKETING_CREATED,
  ORDER_MARKETING_PAID,
  ORDER_MARKETING_QUEUE,
  ORDER_MARKETING_REFUNDED,
  OrderMarketingCancelledJob,
  OrderMarketingCreatedJob,
  OrderMarketingPaidJob,
  OrderMarketingRefundedJob,
} from './order-marketing-event.contract';

/**
 * Bull 队列 `order-marketing` 的载荷契约。
 *
 * - `paid` / `cancelled`：orderId + memberId + tenantId
 * - `refunded`：含部分退款 options，可空对象
 * - tenantId 必须随 payload 落库，processor 在执行 handler 前用 `TenantContext.run` 绑定，
 *   否则 Bull worker 没有 HTTP 上下文会导致 prisma tenant 过滤失效。
 */

/**
 * 订单营销事件处理器
 *
 * @description 通过 Bull 队列接管 paid / cancelled / refunded 事件，
 * 失败由 Bull 按 attempts/backoff 重投，解决 listener 同步吞错后无重试的问题。
 *
 * 注意：
 * - created 事件只记录订单创建事实；锁券 / 冻结积分已在订单创建事务内完成。
 * - jobId 由订单 outbox dedupeKey 提供，配合 OrderIntegrationService 内部 Redis 幂等键兜底。
 * - 失败语义：handler 抛错即让 Bull 走 BullConfigModule 默认 attempts/backoff；
 *   业务幂等命中由 `executeWithIdempotency` 短路；不可重试的业务异常应由 service 层判断后吞错。
 */
@Processor(ORDER_MARKETING_QUEUE)
export class OrderMarketingEventProcessor {
  private readonly logger = new Logger(OrderMarketingEventProcessor.name);

  constructor(
    private readonly orderIntegrationService: OrderIntegrationService,
    private readonly financeCommandPort: FinanceCommandPort,
  ) {}

  @Process(ORDER_MARKETING_CREATED)
  async handleCreated(job: Job<OrderMarketingCreatedJob>): Promise<void> {
    const { orderId, memberId, tenantId, userCouponId, pointsUsed } = job.data;
    await this.runWithTenant(tenantId, 'created', orderId, job, () =>
      this.orderIntegrationService.recordOrderCreated(orderId, memberId, { userCouponId, pointsUsed }),
    );
  }

  @Process(ORDER_MARKETING_PAID)
  async handlePaid(job: Job<OrderMarketingPaidJob>): Promise<void> {
    const { orderId, orderSn, memberId, tenantId, payAmount, transactionId, paidAt } = job.data;
    await this.runWithTenant(tenantId, 'paid', orderId, job, async () => {
      await this.orderIntegrationService.handleOrderPaid(orderId, memberId, payAmount);
      await this.financeCommandPort.recordPaidOrder({
        orderId,
        tenantId,
        orderSn,
        transactionId,
        payAmount,
        channelType: 'WECHAT_PAY',
        payTime: new Date(paidAt),
      });
      await this.financeCommandPort.queueCommissionCalculation(orderId, tenantId);
    });
  }

  @Process(ORDER_MARKETING_CANCELLED)
  async handleCancelled(job: Job<OrderMarketingCancelledJob>): Promise<void> {
    const { orderId, memberId, tenantId } = job.data;
    await this.runWithTenant(tenantId, 'cancelled', orderId, job, () =>
      this.orderIntegrationService.handleOrderCancelled(orderId, memberId),
    );
  }

  @Process(ORDER_MARKETING_REFUNDED)
  async handleRefunded(job: Job<OrderMarketingRefundedJob>): Promise<void> {
    const { orderId, memberId, tenantId, options, refundedAt } = job.data;
    this.logger.log({
      message: 'Order marketing refunded payload',
      jobId: job.id,
      orderId,
      tenantId,
      refundedAt,
    });
    await this.runWithTenant(tenantId, 'refunded', orderId, job, () =>
      this.orderIntegrationService.handleOrderRefunded(orderId, memberId, options ?? {}),
    );
  }

  private async runWithTenant(
    tenantId: string,
    eventType: 'created' | 'paid' | 'cancelled' | 'refunded',
    orderId: string,
    job: Job,
    handler: () => Promise<void>,
  ): Promise<void> {
    this.logger.log({
      message: `Order marketing ${eventType} job received`,
      jobId: job.id,
      orderId,
      tenantId,
      attemptsMade: job.attemptsMade,
    });
    try {
      if (!tenantId?.trim()) {
        throw new Error('order marketing job missing tenantId');
      }
      await TenantContext.run({ tenantId }, () => handler());
    } catch (error) {
      this.logger.error({
        message: `Order marketing ${eventType} job failed, will retry via Bull`,
        jobId: job.id,
        orderId,
        tenantId,
        attemptsMade: job.attemptsMade,
        error: getErrorMessage(error),
        stack: getErrorStack(error),
      });
      throw error;
    }
  }
}
