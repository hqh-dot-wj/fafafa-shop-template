import { MktCampaignKind, MktCampaignStatus, Prisma, PrismaClient } from '@prisma/client';

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
const HANDLER_TYPES = new Set([
  'NEWCOMER_EXCLUSIVE',
  'DISTRIBUTION_GROWTH',
  'COURSE_GROUP_BUY',
  'FLASH_SALE',
  'MEMBER_UPGRADE',
]);

function parseArgs(argv: string[]) {
  const tenantArg = argv.find((item) => item.startsWith('--tenant='));
  return {
    write: argv.includes('--write'),
    tenantId: tenantArg ? tenantArg.slice('--tenant='.length).trim() : null,
  };
}

function resolveKind(type: string): MktCampaignKind {
  if (POLICY_TYPES.has(type)) return MktCampaignKind.POLICY;
  if (HANDLER_TYPES.has(type)) return MktCampaignKind.HANDLER;
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

async function loadActivities(prisma: PrismaClient, tenantId: string | null): Promise<LegacyActivityRow[]> {
  const select = Prisma.sql`
    SELECT
      id,
      tenant_id,
      type,
      name,
      description,
      trigger_condition,
      rules,
      rewards,
      start_time,
      end_time,
      is_enabled,
      priority,
      created_by,
      updated_by,
      create_time,
      update_time
    FROM mkt_activity
  `;

  if (tenantId) {
    return prisma.$queryRaw<LegacyActivityRow[]>`
      ${select}
      WHERE tenant_id = ${tenantId}
      ORDER BY create_time ASC
    `;
  }

  return prisma.$queryRaw<LegacyActivityRow[]>`
    ${select}
    ORDER BY create_time ASC
  `;
}

async function loadTouchpoints(prisma: PrismaClient, tenantId: string | null): Promise<LegacyTouchpointRow[]> {
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

async function loadParticipations(prisma: PrismaClient, tenantId: string | null): Promise<LegacyParticipationRow[]> {
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

async function migrate(write: boolean, tenantId: string | null) {
  const prisma = new PrismaClient();
  try {
    const [activities, touchpoints, participations] = await Promise.all([
      loadActivities(prisma, tenantId),
      loadTouchpoints(prisma, tenantId),
      loadParticipations(prisma, tenantId),
    ]);

    console.log(
      JSON.stringify(
        {
          mode: write ? 'write' : 'dry-run',
          tenantId,
          activities: activities.length,
          touchpoints: touchpoints.length,
          participations: participations.length,
        },
        null,
        2,
      ),
    );

    if (!write) {
      console.log('Dry run only. Re-run with --write after approval to persist migrated rows.');
      return;
    }

    for (const row of activities) {
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
          createdBy: row.created_by,
          updatedBy: row.updated_by,
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
          updatedBy: row.updated_by,
          updateTime: row.update_time,
        },
      });
    }

    for (const row of touchpoints) {
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
  } finally {
    await prisma.$disconnect();
  }
}

const args = parseArgs(process.argv.slice(2));

migrate(args.write, args.tenantId).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
