import { Injectable } from '@nestjs/common';
import { DelFlag, Prisma, Status } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { MARKETING_CLIENT_RUNTIME_REGISTRY } from './marketing-client-runtime.registry';
import { marketingCompatWindowSummaryKey, type MarketingCompatEndpoint } from './marketing-aggregate-traffic.constants';

export interface MarketingRuntimeLedgerRowVo {
  configKey: string;
  displayName: string;
  remark: string;
  platformValue: string | null;
  tenantValue: string | null;
  effectiveValue: string;
}

type CompatWindowSummary = {
  tenantId: string;
  endpoint: MarketingCompatEndpoint;
  date: string;
  thresholdDays: number;
  calls14d: number;
  zeroStreakDays: number;
  canDeprecate: boolean;
};

/**
 * 营销运行时台账服务
 *
 * @description
 * 汇总营销客户端运行时配置的实际生效值（平台默认值 vs 租户覆盖值），
 * 并附加兼容接口 14 天流量观测汇总，供运维台账页展示。
 */
@Injectable()
export class MarketingRuntimeLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly redis: RedisService,
  ) {}

  /**
   * 查询当前租户的运行时台账行列表。
   * @description 遍历 MARKETING_CLIENT_RUNTIME_REGISTRY，分别查询平台值和租户覆盖值，
   * 按"租户覆盖 > 平台默认"规则计算生效值，最后追加兼容接口观测行。
   */
  async listRows(activeTenantId: string): Promise<MarketingRuntimeLedgerRowVo[]> {
    const rows: MarketingRuntimeLedgerRowVo[] = [];
    for (const def of MARKETING_CLIENT_RUNTIME_REGISTRY) {
      const platformRow = await this.prisma.sysConfig.findFirst({
        where: {
          tenantId: TenantHelper.SUPER_TENANT_ID,
          configKey: def.configKey,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
        },
        select: { configValue: true },
      });
      const platformValue = platformRow?.configValue?.trim() ?? null;

      let tenantValue: string | null = null;
      if (activeTenantId !== TenantHelper.SUPER_TENANT_ID) {
        const tenantRow = await this.prisma.sysConfig.findFirst({
          where: this.tenantHelper.readWhereForDelegate('sysConfig', {
            tenantId: activeTenantId,
            configKey: def.configKey,
            status: Status.NORMAL,
            delFlag: DelFlag.NORMAL,
          }) as Prisma.SysConfigWhereInput,
          select: { configValue: true },
        });
        tenantValue = tenantRow?.configValue?.trim() ?? null;
      }

      const effectiveRaw =
        tenantValue !== null && tenantValue !== '' ? tenantValue : platformValue !== null && platformValue !== ''
          ? platformValue
          : def.platformDefaultDisplay;

      rows.push({
        configKey: def.configKey,
        displayName: def.displayName,
        remark: def.remark,
        platformValue,
        tenantValue,
        effectiveValue: effectiveRaw,
      });
    }

    await this.appendCompatWindowRows(rows, activeTenantId);
    return rows;
  }

  /**
   * 追加兼容接口 14 天观测行到台账。
   * 超管租户无需展示（兼容流量观测只针对普通租户），直接跳过。
   */
  private async appendCompatWindowRows(rows: MarketingRuntimeLedgerRowVo[], activeTenantId: string): Promise<void> {
    if (!activeTenantId || activeTenantId === TenantHelper.SUPER_TENANT_ID) {
      return;
    }

    const endpoints: MarketingCompatEndpoint[] = ['aggregate', 'zone'];
    for (const endpoint of endpoints) {
      const summaryRaw = await this.redis.get(marketingCompatWindowSummaryKey(activeTenantId, endpoint));
      const summary = this.parseSummary(summaryRaw);
      if (!summary) {
        rows.push({
          configKey: `marketing.client.compat.${endpoint}.window14d`,
          displayName: `兼容${endpoint}入口近14天调用`,
          remark: '由定时任务每日更新；连续 14 天零调用可评估下线。',
          platformValue: null,
          tenantValue: null,
          effectiveValue: '暂无观测数据',
        });
        continue;
      }

      rows.push({
        configKey: `marketing.client.compat.${endpoint}.window14d`,
        displayName: `兼容${endpoint}入口近14天调用`,
        remark: `观测日期 ${summary.date}；阈值 ${summary.thresholdDays} 天。`,
        platformValue: null,
        tenantValue: String(summary.calls14d),
        effectiveValue: `calls14d=${summary.calls14d}; zeroStreakDays=${summary.zeroStreakDays}; canDeprecate=${summary.canDeprecate ? 'Y' : 'N'}`,
      });
    }
  }

  /** 安全解析 Redis 中存储的 CompatWindowSummary JSON；缺失必要字段或类型不符时返回 null */
  private parseSummary(raw: unknown): CompatWindowSummary | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const candidate = raw as Partial<CompatWindowSummary>;
    if (!candidate.endpoint || !candidate.date) {
      return null;
    }
    return {
      tenantId: String(candidate.tenantId ?? ''),
      endpoint: candidate.endpoint,
      date: candidate.date,
      thresholdDays: Number(candidate.thresholdDays ?? 14),
      calls14d: Number(candidate.calls14d ?? 0),
      zeroStreakDays: Number(candidate.zeroStreakDays ?? 0),
      canDeprecate: Boolean(candidate.canDeprecate),
    };
  }
}
