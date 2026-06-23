/**
 * 验收专用拼课团：招募中 1 人 / 已成团 2 人（ACTIVE，非 SUCCESS 误标）
 */
import { PlayInstanceStatus, PrismaClient } from '@prisma/client';

import { ACC_TENANT_ID } from './shared';

const CONFIG_ID = 'hf-config-course-art';
const TAG = 'acc-acceptance-team';

export async function seedAcceptanceCourseGroupTeams(prisma: PrismaClient): Promise<void> {
  const staleInstances = await prisma.playInstance.findMany({
    where: { tenantId: ACC_TENANT_ID, configId: CONFIG_ID },
    select: { id: true, instanceData: true },
  });
  const staleIds = staleInstances
    .filter((row) => {
      const data = row.instanceData as Record<string, unknown> | null;
      return data?.acceptanceTag === TAG;
    })
    .map((row) => row.id);
  if (staleIds.length > 0) {
    await prisma.courseGroupBuyExtension.deleteMany({
      where: { instanceId: { in: staleIds } },
    });
    await prisma.playInstance.deleteMany({ where: { id: { in: staleIds } } });
  }

  const config = await prisma.storePlayConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!config) {
    console.warn('  ⚠ [Acceptance] hf-config-course-art 不存在，跳过验收团');
    return;
  }

  const recruiting = {
    tag: 'acc-team-art-recruiting',
    status: PlayInstanceStatus.ACTIVE,
    leader: { memberId: 'hf-member-regular-07', avatar: 'https://picsum.photos/seed/acc-recruit/100/100' },
    members: [] as Array<{ memberId: string; avatar: string }>,
    classStartTime: '2026-07-05T10:00:00+08:00',
  };

  const formed = {
    tag: 'acc-team-art-formed',
    status: PlayInstanceStatus.ACTIVE,
    leader: { memberId: 'hf-member-l1-03', avatar: 'https://picsum.photos/seed/acc-formed-a/100/100' },
    members: [{ memberId: 'hf-member-regular-01', avatar: 'https://picsum.photos/seed/acc-formed-b/100/100' }],
    classStartTime: '2026-07-05T10:00:00+08:00',
  };

  for (const blueprint of [recruiting, formed]) {
    await createTeam(prisma, blueprint);
  }

  console.log('  ✓ [Acceptance] 拼课验收团（招募中 1 人 + 已成团 2 人）');
}

async function createTeam(
  prisma: PrismaClient,
  blueprint: {
    tag: string;
    status: PlayInstanceStatus;
    leader: { memberId: string; avatar: string };
    members: Array<{ memberId: string; avatar: string }>;
    classStartTime: string;
  },
): Promise<void> {
  const payTime = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const totalCount = 1 + blueprint.members.length;

  const leaderInstance = await prisma.playInstance.create({
    data: {
      tenantId: ACC_TENANT_ID,
      memberId: blueprint.leader.memberId,
      configId: CONFIG_ID,
      templateCode: 'COURSE_GROUP_BUY',
      status: blueprint.status,
      payTime,
      instanceData: {
        role: 'LEADER',
        avatar: blueprint.leader.avatar,
        acceptanceTag: TAG,
        acceptanceTeamKey: blueprint.tag,
        groupStatus: 'RECRUITING',
        currentCount: totalCount,
      },
    },
  });

  const groupId = leaderInstance.id;

  await prisma.courseGroupBuyExtension.create({
    data: {
      tenantId: ACC_TENANT_ID,
      instanceId: leaderInstance.id,
      groupId,
      totalLessons: 8,
      completedLessons: 0,
      classAddress: '长沙市岳麓区体验教室A1',
      classStartTime: new Date(blueprint.classStartTime),
      leaderId: blueprint.leader.memberId,
      leaderDiscount: 100,
      status: 'ACTIVE',
    },
  });

  for (let i = 0; i < blueprint.members.length; i++) {
    const member = blueprint.members[i]!;
    const memberPayTime = new Date(payTime.getTime() + (i + 1) * 30 * 60 * 1000);
    const memberInstance = await prisma.playInstance.create({
      data: {
        tenantId: ACC_TENANT_ID,
        memberId: member.memberId,
        configId: CONFIG_ID,
        templateCode: 'COURSE_GROUP_BUY',
        status: blueprint.status,
        payTime: memberPayTime,
        instanceData: {
          role: 'MEMBER',
          avatar: member.avatar,
          groupId,
          acceptanceTag: TAG,
          acceptanceTeamKey: blueprint.tag,
          groupStatus: 'RECRUITING',
        },
      },
    });

    await prisma.courseGroupBuyExtension.create({
      data: {
        tenantId: ACC_TENANT_ID,
        instanceId: memberInstance.id,
        groupId,
        totalLessons: 8,
        completedLessons: 0,
        classAddress: '长沙市岳麓区体验教室A1',
        classStartTime: new Date(blueprint.classStartTime),
        leaderId: blueprint.leader.memberId,
        leaderDiscount: 0,
        status: 'ACTIVE',
      },
    });
  }
}
