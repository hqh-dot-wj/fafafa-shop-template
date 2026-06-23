import { PlayInstanceStatus, PublishStatus } from '@prisma/client';
import { CourseGroupLifecycleService } from '../services/lifecycle.service';
import { CourseGroupMemberService } from '../services/member.service';
import { CourseGroupReadService } from '../services/read.service';
import { FailureResolutionService } from '../services/failure-resolution.service';
import { TeamCourseRuntimeService } from '../services/team-course-runtime.service';

type CourseGroupTestFacade = {
  listProductTeams: CourseGroupReadService['listProductTeams'];
  getTeamDetail: CourseGroupReadService['getTeamDetail'];
  getStoreTeamCourseSummary: CourseGroupReadService['getStoreTeamCourseSummary'];
  listStoreTeams: CourseGroupReadService['listStoreTeams'];
  getStoreTeamMembers: CourseGroupMemberService['getStoreTeamMembers'];
  getJoinPreview: CourseGroupMemberService['getJoinPreview'];
  inspectClientTeamMember: CourseGroupMemberService['inspectClientTeamMember'];
  markStoreTeamAttendance: CourseGroupMemberService['markStoreTeamAttendance'];
  openTeam: CourseGroupLifecycleService['openTeam'];
  closeTeam: CourseGroupLifecycleService['closeTeam'];
};

describe('CourseGroup split services', () => {
  const prisma = {
    storePlayConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    pmsProduct: {
      findMany: jest.fn(),
    },
    sysTenant: {
      findMany: jest.fn(),
    },
    playInstance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    umsMember: {
      findMany: jest.fn(),
    },
    omsOrderItem: {
      findMany: jest.fn(),
    },
    finCommission: {
      findMany: jest.fn(),
    },
    courseGroupBuyExtension: {
      findFirst: jest.fn(),
    },
    courseSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    courseAttendance: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  const playInstanceService = {
    create: jest.fn(),
    transitStatus: jest.fn(),
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
  };

  let service: CourseGroupTestFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    const readService = new CourseGroupReadService(prisma as any, tenantHelper as any);
    const memberService = new CourseGroupMemberService(
      readService,
      new TeamCourseRuntimeService(prisma as any, tenantHelper as any),
      new FailureResolutionService(playInstanceService as any),
    );
    const lifecycleService = new CourseGroupLifecycleService(
      playInstanceService as any,
      { appendProxyOpenAudit: jest.fn() } as any,
      readService,
    );
    service = {
      listProductTeams: readService.listProductTeams.bind(readService),
      getTeamDetail: readService.getTeamDetail.bind(readService),
      getStoreTeamCourseSummary: readService.getStoreTeamCourseSummary.bind(readService),
      listStoreTeams: readService.listStoreTeams.bind(readService),
      getStoreTeamMembers: memberService.getStoreTeamMembers.bind(memberService),
      getJoinPreview: memberService.getJoinPreview.bind(memberService),
      inspectClientTeamMember: memberService.inspectClientTeamMember.bind(memberService),
      markStoreTeamAttendance: memberService.markStoreTeamAttendance.bind(memberService),
      openTeam: lifecycleService.openTeam.bind(lifecycleService),
      closeTeam: lifecycleService.closeTeam.bind(lifecycleService),
    };
  });

  it('listProductTeams should expose allowProxyOpen from store rule instead of hard-coded true', async () => {
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: '000000',
      serviceId: 'prod-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        allowStaffProxyOpen: false,
        allowQualifiedUserOpen: true,
        minCount: 2,
        maxCount: 8,
        classAddress: '长沙教学点',
      },
    });
    prisma.storePlayConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-1',
        tenantId: '000000',
        serviceId: 'prod-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PublishStatus.ON_SHELF,
        rules: {
          allowStaffProxyOpen: false,
          minCount: 2,
          maxCount: 8,
          classAddress: '长沙教学点',
        },
      },
    ]);
    prisma.pmsProduct.findMany.mockResolvedValue([
      {
        productId: 'prod-1',
        name: '拼课商品',
        mainImages: ['https://example.com/prod-1.png'],
      },
    ]);
    prisma.sysTenant.findMany.mockResolvedValue([{ tenantId: '000000', companyName: '湖南科技有限公司' }]);
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: { isLeader: true },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
    prisma.umsMember.findMany.mockResolvedValue([]);

    const result = await service.listProductTeams({
      memberId: 'viewer-1',
      tenantId: '000000',
      productId: 'prod-1',
      pageNum: 1,
      pageSize: 20,
    });

    expect(result.data).toMatchObject({
      allowProxyOpen: false,
    });
  });

  it('join-preview should compute recruit status by effective paid members only', async () => {
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: { isLeader: true },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: '000000',
      serviceId: 'prod-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 2,
        maxCount: 3,
        price: 39.9,
        originalPrice: 59.9,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: { isLeader: true },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'member-timeout-1',
        tenantId: '000000',
        memberId: 'member-timeout-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.TIMEOUT,
        instanceData: { parentId: 'team-1' },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'member-timeout-2',
        tenantId: '000000',
        memberId: 'member-timeout-2',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.TIMEOUT,
        instanceData: { parentId: 'team-1' },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.getJoinPreview({
      memberId: 'visitor-1',
      tenantId: '000000',
      teamId: 'team-1',
    });

    expect(result.data).toMatchObject({
      teamId: 'team-1',
      joinable: true,
      reasonCode: 'JOINABLE',
      reasonText: '可参团',
      joinBlockReasonCode: 'JOINABLE',
      joinBlockReasonText: '可参团',
    });
  });

  it('join-preview should expose viewer already joined reason', async () => {
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-joined-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-joined-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: { isLeader: true },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-joined-1',
      tenantId: '000000',
      serviceId: 'prod-joined-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 2,
        maxCount: 5,
        price: 39.9,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-joined-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-joined-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: { isLeader: true },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.getJoinPreview({
      memberId: 'leader-1',
      tenantId: '000000',
      teamId: 'team-joined-1',
    });

    expect(result.data).toMatchObject({
      teamId: 'team-joined-1',
      joinable: false,
      reasonCode: 'VIEWER_ALREADY_JOINED',
      reasonText: '你已在团内',
      message: '你已在团内',
    });
  });

  it('join-preview should treat virtual fill facts as effective members instead of stale legacy counts', async () => {
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-virtual-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-virtual-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: {
        isLeader: true,
        currentCount: 1,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-1',
                  displayName: '虚拟成员1',
                  sourceType: 'AUTO',
                  createdByType: 'SYSTEM',
                  createdById: 'system',
                  createdAt: '2026-04-23T10:00:00.000Z',
                },
              ],
            },
          },
        },
      },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-virtual-1',
      tenantId: '000000',
      serviceId: 'prod-virtual-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 5,
        price: 39.9,
        originalPrice: 59.9,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-virtual-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-virtual-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
          currentCount: 1,
          courseGroupTeam: {
            facts: {
              audits: {
                virtualFill: [
                  {
                    auditId: 'vf-add-1',
                    opType: 'ADD',
                    virtualMemberId: 'vm-1',
                    displayName: '虚拟成员1',
                    sourceType: 'AUTO',
                    createdByType: 'SYSTEM',
                    createdById: 'system',
                    createdAt: '2026-04-23T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'member-real-1',
        tenantId: '000000',
        memberId: 'member-real-1',
        configId: 'cfg-virtual-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        instanceData: { parentId: 'team-virtual-1' },
        createTime: new Date('2026-04-01T00:01:00.000Z'),
        updateTime: new Date('2026-04-01T00:01:00.000Z'),
      },
    ]);

    const result = await service.getJoinPreview({
      memberId: 'visitor-1',
      tenantId: '000000',
      teamId: 'team-virtual-1',
    });

    expect(result.data).toMatchObject({
      teamId: 'team-virtual-1',
      joinable: false,
      remainingSlots: 2,
      reasonCode: 'TEAM_FORMED',
      reasonText: '团队已成团',
    });
  });

  it('openTeam should respect legacy allowOpen field when allowQualifiedUserOpen is missing', async () => {
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-legacy-1',
      tenantId: '000000',
      serviceId: 'prod-legacy-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        allowOpen: false,
        allowProxyOpen: true,
      },
    });

    await expect(
      service.openTeam({
        memberId: 'member-1',
        tenantId: '000000',
        productId: 'prod-legacy-1',
      }),
    ).rejects.toMatchObject({
      response: {
        msg: '当前活动未开放用户开团',
      },
    });

    expect(playInstanceService.create).not.toHaveBeenCalled();
  });

  it('closeTeam should always return CLOSED payload', async () => {
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-close-1',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: { isLeader: true },
    });
    playInstanceService.transitStatus.mockResolvedValue(undefined);

    const result = await service.closeTeam({
      tenantId: '000000',
      teamId: 'team-close-1',
    });

    expect(playInstanceService.transitStatus).toHaveBeenCalledWith('team-close-1', PlayInstanceStatus.FAILED, {
      closedByStore: true,
      runtimeStatus: 'CLOSED',
      runtimeUpdatedAt: expect.any(String),
    });
    expect(result.data).toMatchObject({
      teamId: 'team-close-1',
      status: 'CLOSED',
      teamStatus: 'CLOSED',
    });
  });

  it('listStoreTeams should expose split member counts and finance evidence instead of legacy mixed metrics', async () => {
    prisma.storePlayConfig.findMany.mockResolvedValue([
      {
        id: 'cfg-team-1',
        tenantId: '000000',
        serviceId: 'prod-team-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PublishStatus.ON_SHELF,
        rules: {
          minCount: 3,
          maxCount: 6,
          classAddress: '长沙校区',
          revenueHint: '按真实支付结算',
        },
      },
    ]);
    prisma.pmsProduct.findMany.mockResolvedValue([
      {
        productId: 'prod-team-1',
        name: '少儿拼课',
        mainImages: ['https://example.com/team-1.png'],
      },
    ]);
    prisma.sysTenant.findMany.mockResolvedValue([{ tenantId: '000000', companyName: '湖南科技有限公司' }]);
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-summary-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-team-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        orderItemId: null,
        instanceData: {
          isLeader: true,
          currentCount: 1,
          courseGroupTeam: {
            facts: {
              audits: {
                virtualFill: [
                  {
                    auditId: 'vf-add-1',
                    opType: 'ADD',
                    virtualMemberId: 'vm-1',
                    displayName: '后台补位1',
                    sourceType: 'ADMIN_MANUAL',
                    createdByType: 'ADMIN',
                    createdById: 'admin-1',
                    createdAt: '2026-04-23T10:00:00.000Z',
                  },
                ],
              },
            },
          },
        },
        createTime: new Date('2026-04-01T00:00:00.000Z'),
        updateTime: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        id: 'member-summary-1',
        tenantId: '000000',
        memberId: 'member-1',
        configId: 'cfg-team-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        orderItemId: 101,
        instanceData: { parentId: 'team-summary-1' },
        createTime: new Date('2026-04-01T00:01:00.000Z'),
        updateTime: new Date('2026-04-01T00:01:00.000Z'),
      },
    ]);
    prisma.umsMember.findMany.mockResolvedValue([
      {
        memberId: 'leader-1',
        nickname: '团长A',
        avatar: 'https://example.com/avatar-a.png',
        mobile: '13800000000',
      },
    ]);
    prisma.omsOrderItem.findMany.mockResolvedValue([
      {
        id: 101,
        playInstanceId: 'member-summary-1',
        totalAmount: { toNumber: () => 49.9 },
        orderItemFinalPaid: { toNumber: () => 45.5 },
      },
    ]);
    prisma.finCommission.findMany.mockResolvedValue([
      {
        orderItemId: 101,
        playInstanceId: 'member-summary-1',
        commissionBase: { toNumber: () => 45.5 },
        amount: { toNumber: () => 4.55 },
      },
    ]);

    const result = await service.listStoreTeams({
      tenantId: '000000',
      pageNum: 1,
      pageSize: 20,
    });

    expect(result.data.rows[0]).toMatchObject({
      teamId: 'team-summary-1',
      currentMembers: 3,
      paidMembers: 2,
      realMemberCount: 2,
      virtualMemberCount: 1,
      effectiveMemberCount: 3,
      realPaidMemberCount: 2,
      realPaidAmount: 45.5,
      commissionBaseAmount: 45.5,
      commissionAmount: 4.55,
      formedByVirtual: true,
      financeEvidenceReady: false,
    });
  });

  it('store members should include virtual member detail while client detail should keep virtual identity hidden', async () => {
    const leader = {
      id: 'team-store-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-store-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      orderItemId: null,
      instanceData: {
        isLeader: true,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-store-1',
                  displayName: '后台补位1',
                  sourceType: 'ADMIN_MANUAL',
                  createdByType: 'ADMIN',
                  createdById: 'admin-1',
                  createdAt: '2026-04-23T10:00:00.000Z',
                },
              ],
            },
          },
        },
      },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    };
    prisma.playInstance.findFirst.mockResolvedValueOnce(leader).mockResolvedValueOnce(leader);
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-store-1',
      tenantId: '000000',
      serviceId: 'prod-store-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 6,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      leader,
      {
        id: 'member-store-1',
        tenantId: '000000',
        memberId: 'member-1',
        configId: 'cfg-store-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        orderItemId: 201,
        instanceData: {
          parentId: 'team-store-1',
        },
        createTime: new Date('2026-04-01T00:01:00.000Z'),
        updateTime: new Date('2026-04-01T00:01:00.000Z'),
      },
    ]);
    prisma.umsMember.findMany.mockResolvedValue([
      {
        memberId: 'leader-1',
        nickname: '团长A',
        avatar: 'https://example.com/avatar-a.png',
        mobile: '13800000000',
      },
      {
        memberId: 'member-1',
        nickname: '学员B',
        avatar: 'https://example.com/avatar-b.png',
        mobile: '13900000000',
      },
    ]);
    prisma.omsOrderItem.findMany.mockResolvedValue([
      {
        id: 201,
        playInstanceId: 'member-store-1',
        totalAmount: { toNumber: () => 68 },
        orderItemFinalPaid: { toNumber: () => 60 },
      },
    ]);
    prisma.finCommission.findMany.mockResolvedValue([]);

    const storeMembers = await service.getStoreTeamMembers({
      tenantId: '000000',
      teamId: 'team-store-1',
    });
    const clientDetail = await service.getTeamDetail({
      memberId: 'visitor-1',
      tenantId: '000000',
      teamId: 'team-store-1',
    });

    expect(storeMembers.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memberId: 'member-1',
          memberType: 'REAL',
          participatesInOrder: true,
          participatesInAttendance: true,
          participatesInCommission: true,
        }),
        expect.objectContaining({
          memberId: 'vm-store-1',
          memberType: 'VIRTUAL',
          sourceType: 'ADMIN_MANUAL',
          participatesInOrder: false,
          participatesInAttendance: false,
          participatesInCommission: false,
        }),
      ]),
    );
    expect(clientDetail.data.members).toEqual(
      expect.arrayContaining([
        expect.not.objectContaining({
          memberType: expect.anything(),
        }),
      ]),
    );
  });

  it('client leader inspect should reveal virtual member identity only to the leader', async () => {
    const leader = {
      id: 'team-inspect-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-inspect-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      orderItemId: null,
      instanceData: {
        isLeader: true,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-inspect-1',
                  displayName: '后台补位1',
                  sourceType: 'ADMIN_MANUAL',
                  createdByType: 'ADMIN',
                  createdById: 'admin-1',
                  createdAt: '2026-04-23T10:00:00.000Z',
                },
              ],
            },
          },
        },
      },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    };
    prisma.playInstance.findFirst.mockResolvedValue(leader);
    prisma.playInstance.findMany.mockResolvedValue([
      leader,
      {
        id: 'member-inspect-1',
        tenantId: '000000',
        memberId: 'member-1',
        configId: 'cfg-inspect-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        orderItemId: 301,
        instanceData: { parentId: 'team-inspect-1' },
        createTime: new Date('2026-04-01T00:01:00.000Z'),
        updateTime: new Date('2026-04-01T00:01:00.000Z'),
      },
    ]);
    prisma.umsMember.findMany.mockResolvedValue([
      {
        memberId: 'leader-1',
        nickname: '团长A',
        avatar: 'https://example.com/avatar-a.png',
        mobile: '13800000000',
      },
      {
        memberId: 'member-1',
        nickname: '学员B',
        avatar: 'https://example.com/avatar-b.png',
        mobile: '13900000000',
      },
    ]);

    await expect(
      service.inspectClientTeamMember({
        memberId: 'member-1',
        tenantId: '000000',
        teamId: 'team-inspect-1',
        targetMemberId: 'vm-inspect-1',
      }),
    ).rejects.toMatchObject({
      response: {
        msg: '仅团长可查看成员补位信息',
      },
    });

    const result = await service.inspectClientTeamMember({
      memberId: 'leader-1',
      tenantId: '000000',
      teamId: 'team-inspect-1',
      targetMemberId: 'vm-inspect-1',
    });

    expect(result.data).toMatchObject({
      memberId: 'vm-inspect-1',
      memberType: 'VIRTUAL',
      isVirtual: true,
      sourceType: 'ADMIN_MANUAL',
      participatesInOrder: false,
      participatesInAttendance: false,
      participatesInCommission: false,
    });
  });

  it('store course summary should resolve course runtime by team id', async () => {
    const leader = {
      id: 'team-course-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-course-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.SUCCESS,
      orderItemId: null,
      instanceData: { isLeader: true },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    };
    prisma.playInstance.findFirst.mockResolvedValue(leader);
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-course-1',
      tenantId: '000000',
      serviceId: 'prod-course-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 2,
        maxCount: 6,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([leader]);
    prisma.courseGroupBuyExtension.findFirst.mockResolvedValue({
      id: 'ext-course-1',
      instanceId: 'team-course-1',
      tenantId: '000000',
      totalLessons: 6,
      completedLessons: 1,
      classAddress: '长沙校区',
      classStartTime: new Date('2026-05-01T09:00:00.000Z'),
      classEndTime: new Date('2026-05-06T11:00:00.000Z'),
      status: 'ACTIVE',
      schedules: [{ id: 'schedule-1', status: 'COMPLETED' }],
      attendances: [{ id: 'attendance-1', memberId: 'leader-1' }],
    });

    const result = await (service as any).getStoreTeamCourseSummary({
      tenantId: '000000',
      teamId: 'team-course-1',
    });

    expect(result.data).toMatchObject({
      teamId: 'team-course-1',
      extensionId: 'ext-course-1',
      totalLessons: 6,
      completedLessons: 1,
      pendingLessons: 5,
      completedScheduleCount: 1,
      attendanceMarkedMemberCount: 1,
    });
  });

  it('store attendance marking should reject virtual fill members', async () => {
    const leader = {
      id: 'team-attendance-1',
      tenantId: '000000',
      memberId: 'leader-1',
      configId: 'cfg-attendance-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      orderItemId: null,
      instanceData: {
        isLeader: true,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-attendance-1',
                  displayName: '后台补位1',
                  sourceType: 'ADMIN_MANUAL',
                  createdByType: 'ADMIN',
                  createdById: 'admin-1',
                  createdAt: '2026-04-23T10:00:00.000Z',
                },
              ],
            },
          },
        },
      },
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
    };
    prisma.playInstance.findFirst.mockResolvedValue(leader);
    prisma.playInstance.findMany.mockResolvedValue([leader]);
    prisma.umsMember.findMany.mockResolvedValue([
      {
        memberId: 'leader-1',
        nickname: '团长A',
        avatar: '',
        mobile: '13800000000',
      },
    ]);

    await expect(
      (service as any).markStoreTeamAttendance({
        tenantId: '000000',
        teamId: 'team-attendance-1',
        memberId: 'vm-attendance-1',
        date: '2026-05-01',
      }),
    ).rejects.toMatchObject({
      response: {
        msg: '仅真实履约成员可标记到课',
      },
    });

    expect(prisma.courseAttendance.upsert).not.toHaveBeenCalled();
  });
});
