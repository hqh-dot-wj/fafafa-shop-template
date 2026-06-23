import { Injectable, Logger } from '@nestjs/common';
import type { StorePlayConfig } from '@prisma/client';
import { RedisService } from 'src/module/common/redis/redis.service';

const EXPLAIN_TTL_SECONDS = 60 * 60 * 24 * 7;

const REASON_TEXT_MAP: Record<string, string> = {
  expired: '活动已结束',
  not_started: '活动未开始',
  not_newcomer: '仅限新用户',
  not_member_level: '会员等级不符',
};

export interface ResolutionExplainWinner {
  configId: string;
  templateCode: string;
  priority: number;
}

export interface ResolutionExplainFilteredItem {
  configId: string;
  templateCode: string;
  reason: string;
  reasonText: string;
}

export interface ResolutionExplainSnapshot {
  traceId: string;
  tenantId: string;
  productId: string;
  memberId?: string;
  resolvedAt: string;
  winner: ResolutionExplainWinner | null;
  filtered: ResolutionExplainFilteredItem[];
  explainVersion: '1';
}

export interface RecordExplainParams {
  traceId: string;
  tenantId: string;
  productId: string;
  memberId?: string;
  winner: ResolutionExplainWinner | null;
  filtered: Array<{ config: StorePlayConfig; reason: string }>;
}

@Injectable()
export class ResolutionExplainService {
  private readonly logger = new Logger(ResolutionExplainService.name);

  constructor(private readonly redis: RedisService) {}

  async record(params: RecordExplainParams): Promise<void> {
    const key = this.buildKey(params.tenantId, params.traceId, params.productId);
    const snapshot: ResolutionExplainSnapshot = {
      traceId: params.traceId,
      tenantId: params.tenantId,
      productId: params.productId,
      memberId: params.memberId,
      resolvedAt: new Date().toISOString(),
      winner: params.winner,
      filtered: params.filtered.map((item) => ({
        configId: item.config.id,
        templateCode: item.config.templateCode,
        reason: item.reason,
        reasonText: REASON_TEXT_MAP[item.reason] ?? item.reason,
      })),
      explainVersion: '1',
    };
    try {
      await this.redis.getClient().set(key, JSON.stringify(snapshot), 'EX', EXPLAIN_TTL_SECONDS);
    } catch (error) {
      this.logger.error({ message: 'Failed to record resolution explain', key, error });
    }
  }

  async query(params: {
    tenantId: string;
    traceId: string;
    productId: string;
  }): Promise<ResolutionExplainSnapshot | null> {
    const key = this.buildKey(params.tenantId, params.traceId, params.productId);
    try {
      const raw = await this.redis.getClient().get(key);
      if (!raw) return null;
      return JSON.parse(raw) as ResolutionExplainSnapshot;
    } catch (error) {
      this.logger.error({ message: 'Failed to query resolution explain', key, error });
      return null;
    }
  }

  private buildKey(tenantId: string, traceId: string, productId: string): string {
    return `marketing:resolution:explain:${tenantId}:${traceId}:${productId}`;
  }
}
