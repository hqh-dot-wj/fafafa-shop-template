import { MktCampaignKind, MktCampaignStatus, MktTouchpointKind, Prisma, PrismaClient } from '@prisma/client';

import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../hunan-full/catalog-marketing';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

const POLICY_ACTIVITY_TYPES = new Set(['FIRST_ORDER', 'FULL_REDUCTION', 'MEMBER_DAY', 'PROMOTION_PRICE', 'BIRTHDAY']);

function resolveCampaignKind(type: string): MktCampaignKind {
  return POLICY_ACTIVITY_TYPES.has(type) ? MktCampaignKind.POLICY : MktCampaignKind.HANDLER;
}

function resolveCampaignStatus(isEnabled: boolean, startTime: Date | null, endTime: Date | null): MktCampaignStatus {
  const now = new Date();
  if (endTime && endTime.getTime() <= now.getTime()) return MktCampaignStatus.ARCHIVED;
  if (isEnabled) return MktCampaignStatus.PUBLISHED;
  if (startTime && startTime.getTime() <= now.getTime()) return MktCampaignStatus.PAUSED;
  return MktCampaignStatus.DRAFT;
}

export async function seedHunanActivityCenter(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanActivityCenter');
  console.log('[04-Selection] 湖南完整演示活动台账...');

  const seededActivities: Array<{ id: string; type: string }> = [];

  for (const activity of HUNAN_FULL_MARKETING_BLUEPRINT.activities) {
    const startTime = activity.startOffsetDays == null ? null : hunanFullAt(activity.startOffsetDays, 9, 0);
    const endTime = activity.endOffsetDays == null ? null : hunanFullAt(activity.endOffsetDays, 23, 0);
    const foundationJson = {
      startTime: startTime?.toISOString() ?? null,
      endTime: endTime?.toISOString() ?? null,
      isEnabled: activity.isEnabled,
      priority: activity.priority,
    } satisfies Prisma.InputJsonObject;
    const existing = await prisma.mktCampaign.findFirst({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        type: activity.type,
        OR: [{ createdBy: 'seed' }, { updatedBy: 'seed' }],
      },
      orderBy: { createTime: 'asc' },
    });
    const data = {
      kind: resolveCampaignKind(activity.type),
      name: activity.name,
      description: activity.description,
      status: resolveCampaignStatus(activity.isEnabled, startTime, endTime),
      startTime,
      endTime,
      priority: activity.priority,
      foundationJson,
      policyJson:
        resolveCampaignKind(activity.type) === MktCampaignKind.POLICY
          ? ({
              source: 'hunan-full-seed',
              type: activity.type,
              triggerCondition: activity.triggerCondition,
              rules: activity.rules,
              rewards: activity.rewards,
            } as unknown as Prisma.InputJsonValue)
          : undefined,
      audienceJson: activity.triggerCondition as unknown as Prisma.InputJsonValue,
      stagesJson: activity.rules as unknown as Prisma.InputJsonValue,
      rightsJson: activity.rewards as unknown as Prisma.InputJsonValue,
      deliveryJson: {},
      constraintsJson: {},
      ownerUserId:
        typeof activity.triggerCondition.ownerUserId === 'string' ? activity.triggerCondition.ownerUserId : null,
      updatedBy: 'seed',
    };
    const record = existing
      ? await prisma.mktCampaign.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.mktCampaign.create({
          data: {
            tenantId: HUNAN_FULL_TENANT_ID,
            type: activity.type,
            ...data,
            createdBy: 'seed',
          },
        });
    seededActivities.push({ id: record.id, type: activity.type });
  }

  const activityIdByType = new Map(seededActivities.map((item) => [item.type, item.id]));
  const seedManagedActivities = await prisma.mktCampaign.findMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      OR: [{ createdBy: 'seed' }, { updatedBy: 'seed' }],
    },
    select: { id: true },
  });
  const seedManagedActivityIds = [
    ...new Set([
      ...seededActivities.map((activity) => activity.id),
      ...seedManagedActivities.map((activity) => activity.id),
    ]),
  ];

  await prisma.mktCampaignTouchpoint.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      campaignId: { in: seedManagedActivityIds },
    },
  });

  const touchpointRows = HUNAN_FULL_MARKETING_BLUEPRINT.activityTouchpoints
    .map((touchpoint) => {
      const activityId = activityIdByType.get(touchpoint.activityType);
      if (!activityId) {
        return null;
      }

      return {
        tenantId: HUNAN_FULL_TENANT_ID,
        campaignId: activityId,
        kind: touchpoint.kind === 'MESSAGE' ? MktTouchpointKind.MESSAGE : MktTouchpointKind.SHARE,
        code: touchpoint.code,
        name: touchpoint.name,
        config: touchpoint.config as Prisma.InputJsonValue,
        isEnabled: touchpoint.isEnabled,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (touchpointRows.length > 0) {
    await prisma.mktCampaignTouchpoint.createMany({
      data: touchpointRows,
    });
  }

  await prisma.mktCampaignParticipation.deleteMany({
    where: {
      tenantId: HUNAN_FULL_TENANT_ID,
      campaignId: { in: seedManagedActivityIds },
    },
  });

  const participationMatrix = [
    {
      type: 'NEWCOMER_EXCLUSIVE',
      memberId: 'hf-member-regular-01',
      rewardsSnapshot: {
        state: 'SUCCESS',
        couponCodes: ['HF-CPN-NEW-20', 'HF-CPN-NEW-40'],
        entryScene: 'HF_SCENE_NEWCOMER',
      },
    },
    {
      type: 'NEWCOMER_EXCLUSIVE',
      memberId: 'hf-member-regular-15',
      rewardsSnapshot: {
        state: 'PENDING',
        reason: 'WAIT_FIRST_ORDER',
        entryScene: 'HF_SCENE_NEWCOMER',
      },
    },
    {
      type: 'FULL_REDUCTION',
      memberId: 'hf-member-regular-03',
      rewardsSnapshot: {
        state: 'SUCCESS',
        reduced: 40,
        orderSn: 'HF-ORDER-003',
      },
    },
    {
      type: 'FULL_REDUCTION',
      memberId: 'hf-member-regular-10',
      rewardsSnapshot: {
        state: 'FAILED',
        reason: 'RISK_CONTROL_BLOCK',
        orderSn: 'HF-ORDER-011',
      },
    },
    {
      type: 'FLASH_SALE',
      memberId: 'hf-member-regular-02',
      rewardsSnapshot: {
        state: 'SUCCESS',
        price: 29.9,
        orderSn: 'HF-ORDER-002',
      },
    },
    {
      type: 'FLASH_SALE',
      memberId: 'hf-member-regular-14',
      rewardsSnapshot: {
        state: 'FAILED',
        reason: 'OUT_OF_STOCK',
      },
    },
    {
      type: 'COURSE_GROUP',
      memberId: 'hf-member-regular-08',
      rewardsSnapshot: {
        state: 'ACTIVE',
        groupStatus: 'RECRUITING',
        targetCount: 2,
      },
    },
    {
      type: 'COURSE_GROUP',
      memberId: 'hf-member-regular-12',
      rewardsSnapshot: {
        state: 'TIMEOUT',
        groupStatus: 'FAILED',
      },
    },
    {
      type: 'MEMBER_UPGRADE',
      memberId: 'hf-member-l1-07',
      rewardsSnapshot: {
        state: 'SUCCESS',
        targetLevel: 2,
        orderSn: 'HF-ORDER-009',
      },
    },
    {
      type: 'MEMBER_UPGRADE',
      memberId: 'hf-member-regular-03',
      rewardsSnapshot: {
        state: 'PENDING_REVIEW',
        targetLevel: 1,
      },
    },
  ] as const;

  for (const participation of participationMatrix) {
    const activityId = activityIdByType.get(participation.type);
    if (!activityId) continue;

    await prisma.mktCampaignParticipation.create({
      data: {
        tenantId: HUNAN_FULL_TENANT_ID,
        campaignId: activityId,
        memberId: participation.memberId,
        rewardsSnapshot: participation.rewardsSnapshot,
      },
    });
  }

  console.log(
    `  ✓ ${seededActivities.length} 个活动台账、${touchpointRows.length} 个触点配置、${participationMatrix.length} 条参与样本`,
  );
}
