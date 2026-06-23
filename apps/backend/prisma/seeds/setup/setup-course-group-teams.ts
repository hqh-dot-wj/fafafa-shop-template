/**
 * 拼课团实例种子：为 StorePlayConfig 中的拼课配置创建 PlayInstance + CourseGroupBuyExtension
 *
 * 依赖：hunan-full 中的商品、会员、StorePlayConfig 已存在
 * 创建内容：
 *   - 创意绘画拼课：1 个 ACTIVE 团（2/8 人）+ 1 个 SUCCESS 团（8/8 人）
 *   - 篮球周末拼课：1 个 ACTIVE 团（3/10 人）
 *   - 共 3 个团实例，约 13 个团员 PlayInstance 行
 */
import { PlayInstanceStatus, PrismaClient } from '@prisma/client';

import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

const TENANT_ID = HUNAN_FULL_TENANT_ID;

const AVATARS = [
  'https://picsum.photos/seed/team-a1/100/100',
  'https://picsum.photos/seed/team-a2/100/100',
  'https://picsum.photos/seed/team-a3/100/100',
  'https://picsum.photos/seed/team-b1/100/100',
  'https://picsum.photos/seed/team-b2/100/100',
  'https://picsum.photos/seed/team-b3/100/100',
  'https://picsum.photos/seed/team-c1/100/100',
  'https://picsum.photos/seed/team-c2/100/100',
  'https://picsum.photos/seed/team-c3/100/100',
  'https://picsum.photos/seed/team-c4/100/100',
  'https://picsum.photos/seed/team-c5/100/100',
  'https://picsum.photos/seed/team-c6/100/100',
  'https://picsum.photos/seed/team-c7/100/100',
] as const;

interface TeamBlueprint {
  configId: string;
  templateCode: string;
  status: PlayInstanceStatus;
  leader: { memberId: string; avatar: string };
  members: Array<{ memberId: string; avatar: string }>;
  classAddress: string;
  classStartTime: string;
  totalLessons: number;
}

const TEAM_BLUEPRINTS: TeamBlueprint[] = [
  {
    configId: 'hf-config-course-art',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.ACTIVE,
    leader: { memberId: 'hf-member-l1-03', avatar: AVATARS[0] },
    members: [{ memberId: 'hf-member-regular-01', avatar: AVATARS[1] }],
    classAddress: '长沙市岳麓区体验教室A1',
    classStartTime: '2026-07-05T10:00:00+08:00',
    totalLessons: 8,
  },
  {
    configId: 'hf-config-course-art',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.SUCCESS,
    leader: { memberId: 'hf-member-l2-02', avatar: AVATARS[2] },
    members: [
      { memberId: 'hf-member-l1-04', avatar: AVATARS[3] },
      { memberId: 'hf-member-regular-02', avatar: AVATARS[4] },
      { memberId: 'hf-member-regular-03', avatar: AVATARS[5] },
      { memberId: 'hf-member-regular-04', avatar: AVATARS[6] },
      { memberId: 'hf-member-regular-05', avatar: AVATARS[7] },
      { memberId: 'hf-member-regular-06', avatar: AVATARS[8] },
      { memberId: 'hf-member-regular-07', avatar: AVATARS[9] },
    ],
    classAddress: '长沙市岳麓区体验教室A1',
    classStartTime: '2026-05-15T10:00:00+08:00',
    totalLessons: 8,
  },
  {
    configId: 'hf-config-course-basketball',
    templateCode: 'COURSE_GROUP_BUY',
    status: PlayInstanceStatus.ACTIVE,
    leader: { memberId: 'hf-member-l1-05', avatar: AVATARS[10] },
    members: [
      { memberId: 'hf-member-regular-08', avatar: AVATARS[11] },
      { memberId: 'hf-member-regular-09', avatar: AVATARS[12] },
    ],
    classAddress: '长沙市天心区篮球馆B2',
    classStartTime: '2026-07-02T15:00:00+08:00',
    totalLessons: 10,
  },
];

export async function setupCourseGroupTeams(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'setupCourseGroupTeams');
  console.log('[Setup] 拼课团实例种子...');

  let instanceCount = 0;
  let extensionCount = 0;

  for (const blueprint of TEAM_BLUEPRINTS) {
    const config = await prisma.storePlayConfig.findUnique({
      where: { id: blueprint.configId },
    });
    if (!config) {
      console.warn(`  ⚠ StorePlayConfig ${blueprint.configId} 不存在，跳过`);
      continue;
    }

    const now = new Date();
    const payTime = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const leaderInstance = await prisma.playInstance.create({
      data: {
        tenantId: TENANT_ID,
        memberId: blueprint.leader.memberId,
        configId: blueprint.configId,
        templateCode: blueprint.templateCode,
        instanceData: {
          role: 'LEADER',
          avatar: blueprint.leader.avatar,
          joinedAt: payTime.toISOString(),
          groupStatus: blueprint.status === PlayInstanceStatus.SUCCESS ? 'SUCCESS' : 'RECRUITING',
          currentCount: 1 + blueprint.members.length,
        },
        status: blueprint.status,
        payTime,
        endTime: blueprint.status === PlayInstanceStatus.SUCCESS ? now : null,
      },
    });
    instanceCount++;

    const groupId = leaderInstance.id;

    await prisma.courseGroupBuyExtension.create({
      data: {
        tenantId: TENANT_ID,
        instanceId: leaderInstance.id,
        groupId,
        totalLessons: blueprint.totalLessons,
        completedLessons: blueprint.status === PlayInstanceStatus.SUCCESS ? 3 : 0,
        classAddress: blueprint.classAddress,
        classStartTime: new Date(blueprint.classStartTime),
        leaderId: blueprint.leader.memberId,
        leaderDiscount: 100,
        status: blueprint.status === PlayInstanceStatus.SUCCESS ? 'COMPLETED' : 'ACTIVE',
      },
    });
    extensionCount++;

    for (let i = 0; i < blueprint.members.length; i++) {
      const member = blueprint.members[i];
      const memberPayTime = new Date(payTime.getTime() + (i + 1) * 30 * 60 * 1000);

      const memberInstance = await prisma.playInstance.create({
        data: {
          tenantId: TENANT_ID,
          memberId: member.memberId,
          configId: blueprint.configId,
          templateCode: blueprint.templateCode,
          instanceData: {
            role: 'MEMBER',
            avatar: member.avatar,
            joinedAt: memberPayTime.toISOString(),
            groupId,
            groupStatus: blueprint.status === PlayInstanceStatus.SUCCESS ? 'SUCCESS' : 'RECRUITING',
          },
          status: blueprint.status,
          payTime: memberPayTime,
          endTime: blueprint.status === PlayInstanceStatus.SUCCESS ? now : null,
        },
      });
      instanceCount++;

      await prisma.courseGroupBuyExtension.create({
        data: {
          tenantId: TENANT_ID,
          instanceId: memberInstance.id,
          groupId,
          totalLessons: blueprint.totalLessons,
          completedLessons: blueprint.status === PlayInstanceStatus.SUCCESS ? 3 : 0,
          classAddress: blueprint.classAddress,
          classStartTime: new Date(blueprint.classStartTime),
          leaderId: blueprint.leader.memberId,
          leaderDiscount: 0,
          status: blueprint.status === PlayInstanceStatus.SUCCESS ? 'COMPLETED' : 'ACTIVE',
        },
      });
      extensionCount++;
    }
  }

  console.log(`  ✓ ${instanceCount} 个 PlayInstance、${extensionCount} 个 CourseGroupBuyExtension`);
}
