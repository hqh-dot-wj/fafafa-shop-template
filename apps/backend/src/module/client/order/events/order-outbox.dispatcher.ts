import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bull';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { OrderDomainEvent, OrderDomainEventType } from './order-domain-event.types';
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
} from 'src/module/marketing/integration/order-marketing-event.contract';

interface ClaimedOutboxRow {
  id: bigint;
  eventType: string;
  dedupeKey: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

type QueueJob =
  | { name: typeof ORDER_MARKETING_CREATED; payload: OrderMarketingCreatedJob }
  | { name: typeof ORDER_MARKETING_PAID; payload: OrderMarketingPaidJob }
  | { name: typeof ORDER_MARKETING_CANCELLED; payload: OrderMarketingCancelledJob }
  | { name: typeof ORDER_MARKETING_REFUNDED; payload: OrderMarketingRefundedJob };

/**
 * Leader 锁键。集群中所有 pod 共用同一把锁，仅持锁实例驱动 outbox 派发；
 * 锁过期或主动释放后其他实例可立即接管，保证单实例语义但不依赖 K8s leader election。
 */
const LEADER_LOCK_KEY = 'order:outbox:dispatcher:leader';
/** Leader 锁 TTL（ms）。需大于一次 dispatchPendingBatch 的耗时上限，否则可能在执行过程中失锁。 */
const LEADER_LOCK_TTL_MS = 15_000;
/** Leader 续租间隔（ms）。需小于 TTL 的 1/2，预留一次续租失败窗口仍能保留 leader 身份。 */
const LEADER_RENEW_INTERVAL_MS = 5_000;

@Injectable()
export class OrderOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderOutboxDispatcher.name);
  private readonly tickIntervalMs = 1000;
  private readonly batchSize = 50;
  private readonly maxAttempts = 8;
  private readonly leaseSeconds = 300;
  private timer?: NodeJS.Timeout;
  private running = false;
  /** 当前进程持有 leader 锁时的 token；未持锁时为 null。 */
  private leaderToken: string | null = null;
  /** 距离下一次续租剩余时间（ms）。Leader 每次 tick 减一个 tickIntervalMs。 */
  private renewBudgetMs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @InjectQueue(ORDER_MARKETING_QUEUE) private readonly marketingQueue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tickSafe(), this.tickIntervalMs);
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.releaseLeadership();
  }

  async dispatchPendingBatch(): Promise<number> {
    const rows = await this.claimRows();
    for (const row of rows) {
      await this.dispatchRow(row);
    }
    return rows.length;
  }

  /**
   * 手动重投 FAILED 行：把状态重置为 PENDING、attempts 清零、available_at 设为现在。
   * 仅用于运维 replay 通路，不在常规链路调用。可通过 ids 精确指定，或传 limit 批量重投最早 N 条。
   * 返回真正受影响的行数。
   */
  async replayFailedRows(options: { ids?: bigint[]; limit?: number } = {}): Promise<number> {
    const ids = options.ids?.filter((id) => typeof id === 'bigint') ?? [];
    if (ids.length === 0 && !options.limit) return 0;

    if (ids.length > 0) {
      const result = await this.prisma.$executeRaw`
        UPDATE "oms_order_event_outbox"
        SET "status" = 'PENDING'::"OrderOutboxStatus",
            "attempts" = 0,
            "last_error" = NULL,
            "available_at" = NOW(),
            "update_time" = NOW()
        WHERE "status" = 'FAILED'::"OrderOutboxStatus"
          AND "id" IN (${Prisma.join(ids)})
      `;
      this.logger.warn({ message: 'Order outbox manual replay (by ids)', ids: ids.map(String), affected: result });
      return Number(result);
    }

    const limit = Math.max(1, Math.min(1000, options.limit ?? 0));
    const result = await this.prisma.$executeRaw`
      WITH picked AS (
        SELECT "id"
        FROM "oms_order_event_outbox"
        WHERE "status" = 'FAILED'::"OrderOutboxStatus"
        ORDER BY "id" ASC
        LIMIT ${limit}
      )
      UPDATE "oms_order_event_outbox" AS outbox
      SET "status" = 'PENDING'::"OrderOutboxStatus",
          "attempts" = 0,
          "last_error" = NULL,
          "available_at" = NOW(),
          "update_time" = NOW()
      FROM picked
      WHERE outbox."id" = picked."id"
    `;
    this.logger.warn({ message: 'Order outbox manual replay (by limit)', limit, affected: result });
    return Number(result);
  }

  private async tickSafe() {
    if (this.running) return;
    this.running = true;
    try {
      if (!(await this.ensureLeadership())) {
        return;
      }
      await this.dispatchPendingBatch();
    } catch (error) {
      this.logger.error({
        message: 'Order outbox tick failed',
        error: getErrorMessage(error),
        stack: getErrorStack(error),
      });
    } finally {
      this.running = false;
    }
  }

  /**
   * 维护 leader 身份：未持锁时尝试竞争；已持锁时按周期续租。
   * 续租失败（被其他 pod 抢走 / 锁已过期）会主动放弃身份，下一 tick 重新竞争。
   */
  private async ensureLeadership(): Promise<boolean> {
    if (!this.leaderToken) {
      const token = await this.redis.tryLock(LEADER_LOCK_KEY, LEADER_LOCK_TTL_MS);
      if (!token) return false;
      this.leaderToken = token;
      this.renewBudgetMs = LEADER_RENEW_INTERVAL_MS;
      this.logger.log({ message: 'Order outbox dispatcher acquired leadership', token });
      return true;
    }

    this.renewBudgetMs -= this.tickIntervalMs;
    if (this.renewBudgetMs > 0) return true;

    const renewed = await this.redis.renewLock(LEADER_LOCK_KEY, this.leaderToken, LEADER_LOCK_TTL_MS);
    if (renewed === 1) {
      this.renewBudgetMs = LEADER_RENEW_INTERVAL_MS;
      return true;
    }
    this.logger.warn({ message: 'Order outbox dispatcher lost leadership; will recompete next tick' });
    this.leaderToken = null;
    return false;
  }

  private async releaseLeadership(): Promise<void> {
    if (!this.leaderToken) return;
    try {
      await this.redis.unlock(LEADER_LOCK_KEY, this.leaderToken);
    } catch (error) {
      this.logger.warn({
        message: 'Order outbox dispatcher release lock failed',
        error: getErrorMessage(error),
      });
    } finally {
      this.leaderToken = null;
    }
  }

  private async claimRows(): Promise<ClaimedOutboxRow[]> {
    return this.prisma.$queryRaw<ClaimedOutboxRow[]>`
      WITH picked AS (
        SELECT "id"
        FROM "oms_order_event_outbox"
        WHERE "status" = 'PENDING'::"OrderOutboxStatus"
          AND "available_at" <= NOW()
        ORDER BY "id" ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "oms_order_event_outbox" AS outbox
      SET "available_at" = NOW() + (${this.leaseSeconds} * INTERVAL '1 second'),
          "update_time" = NOW()
      FROM picked
      WHERE outbox."id" = picked."id"
      RETURNING outbox."id",
                outbox."event_type" AS "eventType",
                outbox."dedupe_key" AS "dedupeKey",
                outbox."payload",
                outbox."attempts"
    `;
  }

  private async dispatchRow(row: ClaimedOutboxRow): Promise<void> {
    try {
      const job = this.toQueueJob(row.payload);
      await this.marketingQueue.add(job.name, job.payload, { jobId: row.dedupeKey });
      await this.markDispatched(row.id);
    } catch (error) {
      await this.recordFailure(row, error);
    }
  }

  private toQueueJob(payload: Prisma.JsonValue): QueueJob {
    const event = payload as unknown as OrderDomainEvent;
    switch (event.type) {
      case OrderDomainEventType.CREATED:
        return {
          name: ORDER_MARKETING_CREATED,
          payload: {
            orderId: event.orderId,
            memberId: event.memberId,
            tenantId: event.tenantId,
            userCouponId: event.userCouponId,
            pointsUsed: event.pointsUsed,
          },
        };
      case OrderDomainEventType.PAID:
        return {
          name: ORDER_MARKETING_PAID,
          payload: {
            orderId: event.orderId,
            orderSn: event.orderSn,
            memberId: event.memberId,
            tenantId: event.tenantId,
            payAmount: event.payAmount,
            transactionId: event.transactionId,
            paidAt: this.toIsoString(event.paidAt),
          },
        };
      case OrderDomainEventType.CANCELLED:
        return {
          name: ORDER_MARKETING_CANCELLED,
          payload: {
            orderId: event.orderId,
            memberId: event.memberId,
            tenantId: event.tenantId,
            reason: event.reason,
          },
        };
      case OrderDomainEventType.REFUNDED:
        return {
          name: ORDER_MARKETING_REFUNDED,
          payload: {
            orderId: event.orderId,
            memberId: event.memberId,
            tenantId: event.tenantId,
            options: {
              refundReferenceId: event.refundReferenceId,
              refundPointsAmount: event.refundPointsAmount,
              earnedPointsClawbackRatio: event.earnedPointsClawbackRatio,
              refundCoupon: event.refundCoupon,
              partialRefund: event.partialRefund,
            },
            refundedAt: this.toIsoString(event.refundedAt),
          },
        };
    }
  }

  private async markDispatched(id: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "oms_order_event_outbox"
      SET "status" = 'DISPATCHED'::"OrderOutboxStatus",
          "dispatched_at" = NOW(),
          "update_time" = NOW()
      WHERE "id" = ${id}
    `;
  }

  private async recordFailure(row: ClaimedOutboxRow, error: unknown): Promise<void> {
    const nextAttempts = row.attempts + 1;
    const failed = nextAttempts >= this.maxAttempts;
    const availableAt = failed ? new Date() : new Date(Date.now() + this.backoffSeconds(nextAttempts) * 1000);
    const errorMessage = this.truncate(getErrorMessage(error), 500);
    await this.prisma.$executeRaw`
      UPDATE "oms_order_event_outbox"
      SET "attempts" = ${nextAttempts},
          "status" = ${failed ? 'FAILED' : 'PENDING'}::"OrderOutboxStatus",
          "last_error" = ${errorMessage},
          "available_at" = ${availableAt},
          "update_time" = NOW()
      WHERE "id" = ${row.id}
    `;
    // 触达 maxAttempts 后转 FAILED：以 error 级别上报，触发既有错误观测告警；
    // 中间态保持 warn 不打扰运维。手动 replay 通过 replayFailedRows() 触发。
    if (failed) {
      this.logger.error({
        message: 'Order outbox row exhausted retries (FAILED)',
        outboxId: row.id.toString(),
        eventType: row.eventType,
        dedupeKey: row.dedupeKey,
        attempts: nextAttempts,
        lastError: errorMessage,
      });
    } else {
      this.logger.warn({
        message: 'Order outbox row dispatch failed, will retry',
        outboxId: row.id.toString(),
        eventType: row.eventType,
        attempts: nextAttempts,
        nextAttemptAt: availableAt.toISOString(),
        lastError: errorMessage,
      });
    }
  }

  private backoffSeconds(attempts: number): number {
    return Math.min(2 ** attempts, 600);
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : value;
  }

  private truncate(value: string, maxLength: number): string {
    return value.length <= maxLength ? value : value.slice(0, maxLength);
  }
}
