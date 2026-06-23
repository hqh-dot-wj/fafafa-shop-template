import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';

interface OutboxMetricRow {
  pendingCount: bigint;
  failedCount: bigint;
  maxPendingAgeSeconds: number | null;
}

@Injectable()
export class OrderOutboxMetricsService {
  private readonly logger = new Logger(OrderOutboxMetricsService.name);

  // 多实例部署时只让抢到锁的 leader 真正查全表，避免每实例 30s 一次的 N 倍开销
  // 锁 TTL 必须小于 cron 间隔（30s），防止上一轮卡死时连环阻塞下一轮
  private static readonly LOCK_KEY = 'lock:order:outbox-metrics:collect';
  private static readonly LOCK_TTL_MS = 25_000;

  private static readonly EMPTY: OutboxMetricRow = {
    pendingCount: 0n,
    failedCount: 0n,
    maxPendingAgeSeconds: null,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Cron('*/30 * * * * *')
  async collect(): Promise<OutboxMetricRow> {
    const lockToken = await this.redis.tryLock(
      OrderOutboxMetricsService.LOCK_KEY,
      OrderOutboxMetricsService.LOCK_TTL_MS,
    );
    if (!lockToken) {
      // 非 leader 实例直接跳过本轮采集；不报错也不告警，正常多副本运行预期
      return OrderOutboxMetricsService.EMPTY;
    }

    try {
      const [row] = await this.prisma.$queryRaw<OutboxMetricRow[]>`
        SELECT
          COUNT(*) FILTER (WHERE "status" = 'PENDING'::"OrderOutboxStatus")::bigint AS "pendingCount",
          COUNT(*) FILTER (WHERE "status" = 'FAILED'::"OrderOutboxStatus")::bigint AS "failedCount",
          EXTRACT(EPOCH FROM NOW() - MIN("available_at") FILTER (
            WHERE "status" = 'PENDING'::"OrderOutboxStatus"
          ))::int AS "maxPendingAgeSeconds"
        FROM "oms_order_event_outbox"
      `;

      if (row) {
        const failedCount = Number(row.failedCount ?? 0n);
        const maxPendingAge = Number(row.maxPendingAgeSeconds ?? 0);
        // FAILED 行须立即告警（错误观测路径），PENDING 滞留 > 60s 视为 backlog 提示
        if (failedCount > 0) {
          this.logger.error({
            message: 'Order outbox has FAILED rows; manual replay required',
            pendingCount: row.pendingCount.toString(),
            failedCount: row.failedCount.toString(),
            maxPendingAgeSeconds: maxPendingAge,
          });
        } else if (maxPendingAge > 60) {
          this.logger.warn({
            message: 'Order outbox backlog detected',
            pendingCount: row.pendingCount.toString(),
            failedCount: row.failedCount.toString(),
            maxPendingAgeSeconds: maxPendingAge,
          });
        }
      }

      return row ?? OrderOutboxMetricsService.EMPTY;
    } finally {
      try {
        await this.redis.unlock(OrderOutboxMetricsService.LOCK_KEY, lockToken);
      } catch (error) {
        // 释放失败不阻塞下一轮 cron；锁会在 TTL 到期后自动释放
        this.logger.warn({
          message: 'Failed to release outbox metrics lock; will auto-expire by TTL',
          error: (error as Error)?.message ?? String(error),
        });
      }
    }
  }
}
