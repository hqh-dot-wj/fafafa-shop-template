import { MktCampaignKind, MktCampaignStatus, Prisma, PrismaClient } from '@prisma/client';

export type CampaignCutoverSeedStats = {
  scannedActivities: number;
  createdDrafts: number;
  updatedDrafts: number;
  /** 已存在且非旧 mkt_activity 衍生的 mkt_campaign，按防护策略跳过，未被覆盖。 */
  skippedNonLegacy: number;
  createdReleases: number;
  updatedReleases: number;
  createdPools: number;
  updatedPools: number;
  linkedPoolPairs: number;
};

type LegacyActivityRow = {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  description: string | null;
  trigger_condition: Prisma.JsonValue;
  rules: Prisma.JsonValue;
  rewards: Prisma.JsonValue;
  start_time: Date | null;
  end_time: Date | null;
  is_enabled: boolean;
  priority: number;
  created_by: string | null;
  updated_by: string | null;
  create_time: Date;
  update_time: Date;
};

type LegacyTouchpointRow = {
  id: string;
  tenant_id: string;
  activity_id: string;
  kind: 'MESSAGE' | 'SHARE';
  code: string;
  name: string;
  config: Prisma.JsonValue;
  is_enabled: boolean;
  create_time: Date;
  update_time: Date;
};

type LegacyParticipationRow = {
  id: string;
  tenant_id: string;
  activity_id: string;
  member_id: string;
  rewards_snapshot: Prisma.JsonValue | null;
  create_time: Date;
};

const POLICY_TYPES = new Set(['FIRST_ORDER', 'FULL_REDUCTION', 'MEMBER_DAY', 'PROMOTION_PRICE', 'BIRTHDAY']);

function resolveKind(type: string): MktCampaignKind {
  if (POLICY_TYPES.has(type)) return MktCampaignKind.POLICY;
  return MktCampaignKind.HANDLER;
}

function resolveStatus(row: LegacyActivityRow): MktCampaignStatus {
  if (row.end_time && row.end_time.getTime() <= Date.now()) return MktCampaignStatus.ARCHIVED;
  if (row.is_enabled) return MktCampaignStatus.PUBLISHED;
  if (row.start_time && row.start_time.getTime() <= Date.now()) return MktCampaignStatus.PAUSED;
  return MktCampaignStatus.DRAFT;
}

function normalizeMoneyJson(value: Prisma.JsonValue): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeMoneyJson(item)) as Prisma.InputJsonArray;
  }
  if (!value || typeof value !== 'object') {
    return value as Prisma.InputJsonValue;
  }
  const next: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === 'discountValue' && typeof child === 'number') {
      next[key] = String(child);
      continue;
    }
    next[key] = normalizeMoneyJson(child);
  }
  return next;
}

function toJsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.InputJsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return normalizeMoneyJson(value) as Record<string, Prisma.InputJsonValue>;
}

function toFoundationJson(row: LegacyActivityRow): Prisma.InputJsonObject {
  return {
    startTime: row.start_time?.toISOString() ?? null,
    endTime: row.end_time?.toISOString() ?? null,
    isEnabled: row.is_enabled,
    priority: row.priority,
  };
}

function toPolicyJson(row: LegacyActivityRow): Prisma.InputJsonObject | undefined {
  if (resolveKind(row.type) !== MktCampaignKind.POLICY) return undefined;
  return {
    source: 'legacy-mkt-activity',
    type: row.type,
    triggerCondition: toJsonObject(row.trigger_condition),
    rules: toJsonObject(row.rules),
    rewards: toJsonObject(row.rewards),
  };
}

async function tableExists(prisma: PrismaClient, name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean | null }>>`
    SELECT to_regclass(${name}) IS NOT NULL AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function loadActivities(prisma: PrismaClient, tenantId?: string): Promise<LegacyActivityRow[]> {
  if (tenantId) {
    return prisma.$queryRaw<LegacyActivityRow[]>`
      SELECT id, tenant_id, type, name, description, trigger_condition, rules, rewards,
             start_time, end_time, is_enabled, priority, created_by, updated_by, create_time, update_time
      FROM mkt_activity
      WHERE tenant_id = ${tenantId}
      ORDER BY create_time ASC
    `;
  }
  return prisma.$queryRaw<LegacyActivityRow[]>`
    SELECT id, tenant_id, type, name, description, trigger_condition, rules, rewards,
           start_time, end_time, is_enabled, priority, created_by, updated_by, create_time, update_time
    FROM mkt_activity
    ORDER BY create_time ASC
  `;
}

async function loadTouchpoints(prisma: PrismaClient, tenantId?: string): Promise<LegacyTouchpointRow[]> {
  if (tenantId) {
    return prisma.$queryRaw<LegacyTouchpointRow[]>`
      SELECT id, tenant_id, activity_id, kind, code, name, config, is_enabled, create_time, update_time
      FROM mkt_activity_touchpoint
      WHERE tenant_id = ${tenantId}
      ORDER BY create_time ASC
    `;
  }
  return prisma.$queryRaw<LegacyTouchpointRow[]>`
    SELECT id, tenant_id, activity_id, kind, code, name, config, is_enabled, create_time, update_time
    FROM mkt_activity_touchpoint
    ORDER BY create_time ASC
  `;
}

async function loadParticipations(prisma: PrismaClient, tenantId?: string): Promise<LegacyParticipationRow[]> {
  if (tenantId) {
    return prisma.$queryRaw<LegacyParticipationRow[]>`
      SELECT id, tenant_id, activity_id, member_id, rewards_snapshot, create_time
      FROM mkt_activity_participation
      WHERE tenant_id = ${tenantId}
      ORDER BY create_time ASC
    `;
  }
  return prisma.$queryRaw<LegacyParticipationRow[]>`
    SELECT id, tenant_id, activity_id, member_id, rewards_snapshot, create_time
    FROM mkt_activity_participation
    ORDER BY create_time ASC
  `;
}

/**
 * P1-05 cutover：把旧 mkt_activity / mkt_activity_touchpoint / mkt_activity_participation
 * 物理表里的数据搬迁到 mkt_campaign 等新结构。
 *
 * 设计权衡：
 * - 旧表在 migration `20260517100000_unify_activity_campaign` 中保留，便于回滚/审计。
 * - 单跑 `prisma migrate deploy` 不会搬数据；之前依赖 `scripts/migrations/migrate-mkt-activity-to-campaign.ts --write`
 *   人工执行，发布流程容易漏。本 seed 直接复用核心搬迁逻辑，让 `pnpm db:seed` 标准流程自动完成。
 * - 所有写操作都是 upsert + 显式 id，因此重跑幂等；新装环境（旧表不存在或为空）跳过并返回 0 stats。
 */
export async function seedCampaignCutoverFromActivity(
  prisma: PrismaClient,
  options?: {
    tenantId?: string;
    actor?: string;
    /**
     * 当 mkt_campaign 已有同 id 行但其 policyJson.source !== 'legacy-mkt-activity' 时，
     * 默认 false：视为人工录入/其他来源数据，跳过 + warn，不被旧 mkt_activity 内容覆盖。
     * true：无差别 upsert（用于明确知道要刷新的场景）。
     */
    overwriteForeignRows?: boolean;
  },
): Promise<CampaignCutoverSeedStats> {
  const stats: CampaignCutoverSeedStats = {
    scannedActivities: 0,
    createdDrafts: 0,
    updatedDrafts: 0,
    skippedNonLegacy: 0,
    createdReleases: 0,
    updatedReleases: 0,
    createdPools: 0,
    updatedPools: 0,
    linkedPoolPairs: 0,
  };

  const activityExists = await tableExists(prisma, 'mkt_activity');
  if (!activityExists) {
    console.log('[08-Cutover] 旧 mkt_activity 表不存在（新装环境），跳过 cutover seed。');
    return stats;
  }

  const [activities, touchpoints, participations] = await Promise.all([
    loadActivities(prisma, options?.tenantId),
    (await tableExists(prisma, 'mkt_activity_touchpoint')) ? loadTouchpoints(prisma, options?.tenantId) : [],
    (await tableExists(prisma, 'mkt_activity_participation')) ? loadParticipations(prisma, options?.tenantId) : [],
  ]);

  stats.scannedActivities = activities.length;

  if (activities.length === 0) {
    console.log('[08-Cutover] 旧 mkt_activity 无数据，跳过 cutover seed。');
    return stats;
  }

  console.log(
    `[08-Cutover] 搬迁 mkt_activity -> mkt_campaign：activities=${activities.length}, ` +
      `touchpoints=${touchpoints.length}, participations=${participations.length}` +
      (options?.tenantId ? `, tenantId=${options.tenantId}` : ''),
  );

  const skippedCampaignIds = new Set<string>();

  for (const row of activities) {
    const existing = await prisma.mktCampaign.findUnique({
      where: { id: row.id },
      select: { id: true, policyJson: true },
    });

    if (existing && !options?.overwriteForeignRows) {
      const policy = existing.policyJson as { source?: string } | null;
      const isLegacyDerived = policy?.source === 'legacy-mkt-activity';
      if (!isLegacyDerived) {
        console.warn(
          `[08-Cutover] 跳过 id=${row.id}：mkt_campaign 已存在且非旧 mkt_activity 衍生（policyJson.source=${policy?.source ?? 'null'}），` +
            `避免覆盖人工录入数据。如需强制刷新，请传 overwriteForeignRows: true。`,
        );
        stats.skippedNonLegacy += 1;
        skippedCampaignIds.add(row.id);
        continue;
      }
    }

    await prisma.mktCampaign.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        type: row.type,
        kind: resolveKind(row.type),
        description: row.description,
        status: resolveStatus(row),
        startTime: row.start_time,
        endTime: row.end_time,
        priority: row.priority,
        policyJson: toPolicyJson(row),
        foundationJson: toFoundationJson(row),
        audienceJson: toJsonObject(row.trigger_condition),
        rightsJson: toJsonObject(row.rewards),
        stagesJson: toJsonObject(row.rules),
        deliveryJson: {},
        constraintsJson: {},
        ownerUserId: toJsonObject(row.trigger_condition).ownerUserId as string | undefined,
        createdBy: row.created_by ?? options?.actor,
        updatedBy: row.updated_by ?? options?.actor,
        createTime: row.create_time,
        updateTime: row.update_time,
      },
      update: {
        name: row.name,
        type: row.type,
        kind: resolveKind(row.type),
        description: row.description,
        status: resolveStatus(row),
        startTime: row.start_time,
        endTime: row.end_time,
        priority: row.priority,
        policyJson: toPolicyJson(row),
        foundationJson: toFoundationJson(row),
        audienceJson: toJsonObject(row.trigger_condition),
        rightsJson: toJsonObject(row.rewards),
        stagesJson: toJsonObject(row.rules),
        updatedBy: row.updated_by ?? options?.actor,
        updateTime: row.update_time,
      },
    });
    if (existing) {
      stats.updatedDrafts += 1;
    } else {
      stats.createdDrafts += 1;
    }
  }

  for (const row of touchpoints) {
    if (skippedCampaignIds.has(row.activity_id)) continue;
    await prisma.mktCampaignTouchpoint.upsert({
      where: {
        tenantId_campaignId_kind_code: {
          tenantId: row.tenant_id,
          campaignId: row.activity_id,
          kind: row.kind,
          code: row.code,
        },
      },
      create: {
        id: row.id,
        tenantId: row.tenant_id,
        campaignId: row.activity_id,
        kind: row.kind,
        code: row.code,
        name: row.name,
        config: normalizeMoneyJson(row.config),
        isEnabled: row.is_enabled,
        createTime: row.create_time,
        updateTime: row.update_time,
      },
      update: {
        name: row.name,
        config: normalizeMoneyJson(row.config),
        isEnabled: row.is_enabled,
        updateTime: row.update_time,
      },
    });
  }

  for (const row of participations) {
    if (skippedCampaignIds.has(row.activity_id)) continue;
    await prisma.mktCampaignParticipation.upsert({
      where: {
        campaignId_memberId: {
          campaignId: row.activity_id,
          memberId: row.member_id,
        },
      },
      create: {
        id: row.id,
        tenantId: row.tenant_id,
        campaignId: row.activity_id,
        memberId: row.member_id,
        rewardsSnapshot: row.rewards_snapshot ? normalizeMoneyJson(row.rewards_snapshot) : undefined,
        createTime: row.create_time,
      },
      update: {
        rewardsSnapshot: row.rewards_snapshot ? normalizeMoneyJson(row.rewards_snapshot) : undefined,
      },
    });
  }

  console.log(
    `[08-Cutover] 完成：created=${stats.createdDrafts}, updated=${stats.updatedDrafts}, ` +
      `skippedNonLegacy=${stats.skippedNonLegacy}, touchpoints=${touchpoints.length}, ` +
      `participations=${participations.length}`,
  );

  return stats;
}
