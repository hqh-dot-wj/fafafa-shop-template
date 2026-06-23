import { PlayInstanceStatus } from '@prisma/client';
import { CourseGroupSceneExplainService } from '../services/course-group-scene-explain.service';
import type { ResolvedProduct } from '../services/primary-offer-resolver.service';
import type { UserMarketingContext } from '../dto/user-marketing-context.dto';

describe('CourseGroupSceneExplainService', () => {
  const prisma = {
    playInstance: {
      findMany: jest.fn(),
    },
    courseGroupBuyExtension: {
      findMany: jest.fn(),
    },
  };

  const ctx: UserMarketingContext = {
    tenantId: '000000',
    memberId: 'viewer-1',
    channel: 'MINIAPP',
    now: new Date('2026-04-28T00:00:00.000Z'),
    isNewcomer: false,
  };

  let service: CourseGroupSceneExplainService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.courseGroupBuyExtension.findMany.mockResolvedValue([]);
    service = new CourseGroupSceneExplainService(prisma as any);
  });

  it('attaches no-recruiting-team explain when course-group product has no team', async () => {
    prisma.playInstance.findMany.mockResolvedValue([]);

    const result = await service.attach([buildProduct()], ctx);

    expect(prisma.playInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: '000000',
          templateCode: 'COURSE_GROUP_BUY',
          configId: { in: ['cfg-1'] },
        }),
      }),
    );
    expect((result[0] as any).courseGroupJoinExplain).toMatchObject({
      joinable: false,
      reasonCode: 'NO_RECRUITING_TEAM',
      reasonText: '暂无可加入团队，可先开团',
    });
    expect((result[0] as any).primaryOffer.courseGroupJoinExplain).toMatchObject({
      reasonCode: 'NO_RECRUITING_TEAM',
    });
    expect((result[0] as any).explain).toContainEqual(
      expect.objectContaining({
        domain: 'COURSE_GROUP',
        code: 'NO_RECRUITING_TEAM',
        severity: 'WARN',
      }),
    );
  });

  it('prefers a joinable recruiting team and exposes candidate team id', async () => {
    prisma.playInstance.findMany.mockResolvedValue([
      buildInstance({ id: 'team-1', memberId: 'leader-1', instanceData: { isLeader: true } }),
      buildInstance({
        id: 'member-1',
        memberId: 'member-1',
        status: PlayInstanceStatus.PAID,
        instanceData: { parentId: 'team-1' },
      }),
    ]);

    const result = await service.attach([buildProduct()], ctx);

    expect((result[0] as any).courseGroupJoinExplain).toMatchObject({
      joinable: true,
      reasonCode: 'JOINABLE',
      reasonText: '离您最近，还差1人即可成团',
      candidateTeamId: 'team-1',
      teamStatus: 'RECRUITING',
      effectiveMemberCount: 2,
      remainingToForm: 1,
    });
  });

  it('uses virtual-fill projection reason when team is formed by virtual member', async () => {
    prisma.playInstance.findMany.mockResolvedValue([
      buildInstance({
        id: 'team-virtual-1',
        memberId: 'leader-1',
        instanceData: {
          isLeader: true,
          courseGroupTeam: {
            facts: {
              audits: {
                virtualFill: [
                  {
                    auditId: 'vf-1',
                    opType: 'ADD',
                    virtualMemberId: 'vm-1',
                    displayName: '补位成员',
                    sourceType: 'AUTO',
                    createdByType: 'SYSTEM',
                    createdById: 'system',
                    createdAt: '2026-04-28T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
      }),
      buildInstance({
        id: 'member-1',
        memberId: 'member-1',
        status: PlayInstanceStatus.PAID,
        instanceData: { parentId: 'team-virtual-1' },
      }),
    ]);

    const result = await service.attach([buildProduct()], ctx);

    expect((result[0] as any).courseGroupJoinExplain).toMatchObject({
      joinable: false,
      reasonCode: 'TEAM_FORMED',
      reasonText: '已补位成团',
      formedByVirtual: true,
      teamStatus: 'FORMED',
    });
  });

  function buildProduct(): ResolvedProduct {
    return {
      productId: 'prod-1',
      productName: '拼课商品',
      primaryOffer: {
        activityType: 'COURSE_GROUP_BUY',
        configId: 'cfg-1',
      },
      activityCandidates: [
        {
          configId: 'cfg-1',
          templateCode: 'COURSE_GROUP_BUY',
          displayPriority: 10,
          status: 'ON_SHELF',
          rules: {
            minCount: 3,
            maxCount: 5,
          },
        },
      ],
    };
  }

  function buildInstance(input: {
    id: string;
    memberId: string;
    status?: PlayInstanceStatus;
    instanceData?: Record<string, unknown>;
  }) {
    return {
      id: input.id,
      tenantId: '000000',
      memberId: input.memberId,
      configId: 'cfg-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: input.status ?? PlayInstanceStatus.ACTIVE,
      instanceData: input.instanceData ?? {},
      createTime: new Date('2026-04-28T09:00:00.000Z'),
      updateTime: new Date('2026-04-28T09:00:00.000Z'),
    };
  }
});
