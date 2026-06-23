import { PlayInstanceStatus, PublishStatus } from '@prisma/client';
import { CourseGroupBuyService } from './course-group-buy.service';

describe('CourseGroupBuyService', () => {
  const instanceService = {
    findOne: jest.fn(),
    transitStatus: jest.fn(),
  };

  const assetService = {
    grantAsset: jest.fn(),
  };

  const prisma = {
    storePlayConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    playInstance: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    umsMember: {
      findFirst: jest.fn(),
    },
  };

  const extensionRepo = {
    findByInstanceId: jest.fn(),
    create: jest.fn(),
    createSchedules: jest.fn(),
  };

  const idempotencyService = {
    withTeamLock: jest.fn(async (_teamId: string, callback: () => Promise<unknown>) => callback()),
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
  };

  let service: CourseGroupBuyService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.storePlayConfig.findFirst.mockReset();
    prisma.storePlayConfig.findMany.mockReset();
    prisma.playInstance.findFirst.mockReset();
    prisma.playInstance.findMany.mockReset();
    prisma.playInstance.update.mockReset();
    prisma.umsMember.findFirst.mockReset();
    extensionRepo.findByInstanceId.mockReset();
    extensionRepo.create.mockReset();
    extensionRepo.createSchedules.mockReset();
    instanceService.findOne.mockReset();
    instanceService.transitStatus.mockReset();
    assetService.grantAsset.mockReset();
    idempotencyService.withTeamLock.mockReset();
    idempotencyService.withTeamLock.mockImplementation(
      async (_teamId: string, callback: () => Promise<unknown>) => callback(),
    );
    service = new CourseGroupBuyService(
      instanceService as any,
      assetService as any,
      prisma as any,
      extensionRepo as any,
      tenantHelper as any,
      idempotencyService as any,
    );
  });

  it('reconcileGroupByLeader should finalize formed teams and avoid duplicate schedules when leader schedules already exist', async () => {
    prisma.playInstance.findFirst
      .mockResolvedValueOnce({
        id: 'team-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
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
      })
      .mockResolvedValueOnce({
        id: 'team-1',
        tenantId: '000000',
        memberId: 'leader-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
        },
      });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-1',
      tenantId: '000000',
      serviceId: 'prod-1',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 5,
        totalLessons: 8,
        classStartTime: '2026-04-24T10:00:00.000Z',
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
        instanceData: {
          isLeader: true,
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
      },
      {
        id: 'member-1',
        tenantId: '000000',
        memberId: 'member-1',
        configId: 'cfg-1',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        instanceData: {
          parentId: 'team-1',
        },
      },
    ]);
    extensionRepo.findByInstanceId
      .mockResolvedValueOnce({
        id: 'ext-leader-1',
        tenantId: '000000',
        instanceId: 'team-1',
        schedules: [
          {
            id: 'schedule-1',
          },
        ],
      })
      .mockResolvedValueOnce(null);
    prisma.playInstance.update.mockResolvedValue({});

    const result = await service.reconcileGroupByLeader({
      leaderId: 'team-1',
      tenantId: '000000',
      reason: 'PAYMENT_SUCCESS',
    });

    expect(instanceService.transitStatus).toHaveBeenCalledWith('team-1', PlayInstanceStatus.SUCCESS);
    expect(instanceService.transitStatus).toHaveBeenCalledWith('member-1', PlayInstanceStatus.SUCCESS);
    expect(extensionRepo.createSchedules).not.toHaveBeenCalled();
    expect(result.projection.status).toMatchObject({
      displayStatus: 'FORMED',
      formedByVirtual: true,
    });
  });

  it('autoFillLeaderGroup should only append enough virtual members to reach minCount', async () => {
    const reconcileSpy = jest.spyOn(service, 'reconcileGroupByLeader').mockResolvedValue({
      projection: {
        counts: {
          effectiveMemberCount: 3,
        },
      },
    } as never);
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-2',
      tenantId: '000000',
      memberId: 'leader-2',
      configId: 'cfg-2',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: {
        isLeader: true,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [],
            },
          },
        },
      },
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-2',
      tenantId: '000000',
      serviceId: 'prod-2',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 6,
        enableVirtualFill: true,
        virtualFillWindowMinutes: 30,
        joinDeadline: '2026-04-23T12:20:00.000Z',
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-2',
        tenantId: '000000',
        memberId: 'leader-2',
        configId: 'cfg-2',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
          courseGroupTeam: {
            facts: {
              audits: {
                virtualFill: [],
              },
            },
          },
        },
      },
    ]);
    prisma.playInstance.update.mockResolvedValue({});

    await service.autoFillLeaderGroup({
      leaderId: 'team-2',
      tenantId: '000000',
      now: new Date('2026-04-23T12:00:00.000Z'),
    });

    expect(prisma.playInstance.update).toHaveBeenCalledWith({
      where: { id: 'team-2' },
      data: {
        instanceData: expect.objectContaining({
          courseGroupTeam: expect.objectContaining({
            facts: expect.objectContaining({
              audits: expect.objectContaining({
                virtualFill: expect.arrayContaining([
                  expect.objectContaining({ opType: 'ADD' }),
                  expect.objectContaining({ opType: 'ADD' }),
                ]),
              }),
            }),
          }),
        }),
      },
    });
    const updatePayload = prisma.playInstance.update.mock.calls[0]?.[0]?.data?.instanceData as {
      courseGroupTeam?: { facts?: { audits?: { virtualFill?: unknown[] } } };
    };
    expect(updatePayload.courseGroupTeam?.facts?.audits?.virtualFill).toHaveLength(2);
    expect(reconcileSpy).toHaveBeenCalledWith({
      leaderId: 'team-2',
      tenantId: '000000',
      reason: 'AUTO_FILL',
    });
  });

  it('manualFillLeaderGroup should respect admin permissions and only append enough virtual members to reach minCount', async () => {
    const reconcileSpy = jest.spyOn(service, 'reconcileGroupByLeader').mockResolvedValue({
      projection: {
        counts: {
          effectiveMemberCount: 3,
        },
      },
    } as never);
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-3',
      tenantId: '000000',
      memberId: 'leader-3',
      configId: 'cfg-3',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: {
        isLeader: true,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [],
              runtimeTransition: [],
            },
          },
        },
      },
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-3',
      tenantId: '000000',
      serviceId: 'prod-3',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 6,
        enableVirtualFill: true,
        allowAdminManualFill: true,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-3',
        tenantId: '000000',
        memberId: 'leader-3',
        configId: 'cfg-3',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
          courseGroupTeam: {
            facts: {
              audits: {
                virtualFill: [],
                runtimeTransition: [],
              },
            },
          },
        },
      },
      {
        id: 'member-3',
        tenantId: '000000',
        memberId: 'member-3',
        configId: 'cfg-3',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.PAID,
        instanceData: {
          parentId: 'team-3',
        },
      },
    ]);
    prisma.playInstance.update.mockResolvedValue({});

    const result = await service.manualFillLeaderGroup({
      leaderId: 'team-3',
      tenantId: '000000',
      count: 2,
      sourceType: 'ADMIN_MANUAL',
      createdByType: 'ADMIN',
      createdById: 'admin-1',
      reason: '后台人工补位',
    });

    expect(result).toMatchObject({
      applied: true,
      addedCount: 1,
    });
    const updatePayload = prisma.playInstance.update.mock.calls[0]?.[0]?.data?.instanceData as {
      courseGroupTeam?: { facts?: { audits?: { virtualFill?: Array<Record<string, unknown>> } } };
    };
    expect(updatePayload.courseGroupTeam?.facts?.audits?.virtualFill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opType: 'ADD',
          sourceType: 'ADMIN_MANUAL',
          createdByType: 'ADMIN',
          createdById: 'admin-1',
        }),
      ]),
    );
    expect(reconcileSpy).toHaveBeenCalledWith({
      leaderId: 'team-3',
      tenantId: '000000',
      reason: 'ADMIN_MANUAL_FILL',
    });
  });

  it('removeVirtualFillFromLeaderGroup should append remove fact and reconcile while team is still recruiting', async () => {
    const reconcileSpy = jest.spyOn(service, 'reconcileGroupByLeader').mockResolvedValue({
      projection: {
        counts: {
          effectiveMemberCount: 1,
        },
      },
    } as never);
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-4',
      tenantId: '000000',
      memberId: 'leader-4',
      configId: 'cfg-4',
      templateCode: 'COURSE_GROUP_BUY',
      status: PlayInstanceStatus.ACTIVE,
      instanceData: {
        isLeader: true,
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
              runtimeTransition: [],
            },
          },
        },
      },
    });
    prisma.storePlayConfig.findFirst.mockResolvedValue({
      id: 'cfg-4',
      tenantId: '000000',
      serviceId: 'prod-4',
      templateCode: 'COURSE_GROUP_BUY',
      status: PublishStatus.ON_SHELF,
      rules: {
        minCount: 3,
        maxCount: 6,
        enableVirtualFill: true,
        allowAdminManualFill: true,
      },
    });
    prisma.playInstance.findMany.mockResolvedValue([
      {
        id: 'team-4',
        tenantId: '000000',
        memberId: 'leader-4',
        configId: 'cfg-4',
        templateCode: 'COURSE_GROUP_BUY',
        status: PlayInstanceStatus.ACTIVE,
        instanceData: {
          isLeader: true,
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
                runtimeTransition: [],
              },
            },
          },
        },
      },
    ]);
    prisma.playInstance.update.mockResolvedValue({});

    const result = await service.removeVirtualFillFromLeaderGroup({
      leaderId: 'team-4',
      tenantId: '000000',
      virtualMemberId: 'vm-1',
      sourceType: 'ADMIN_MANUAL',
      createdByType: 'ADMIN',
      createdById: 'admin-2',
      reason: '后台撤销补位',
    });

    expect(result).toMatchObject({
      applied: true,
      removedVirtualMemberId: 'vm-1',
    });
    const updatePayload = prisma.playInstance.update.mock.calls[0]?.[0]?.data?.instanceData as {
      courseGroupTeam?: { facts?: { audits?: { virtualFill?: Array<Record<string, unknown>> } } };
    };
    expect(updatePayload.courseGroupTeam?.facts?.audits?.virtualFill).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          opType: 'REMOVE',
          virtualMemberId: 'vm-1',
          createdById: 'admin-2',
        }),
      ]),
    );
    expect(reconcileSpy).toHaveBeenCalledWith({
      leaderId: 'team-4',
      tenantId: '000000',
      reason: 'ADMIN_MANUAL_REMOVE',
    });
  });
});
