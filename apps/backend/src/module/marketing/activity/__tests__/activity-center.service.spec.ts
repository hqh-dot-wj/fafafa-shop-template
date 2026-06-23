import { Test, TestingModule } from '@nestjs/testing';
import { MktCampaign, MktCampaignKind, MktCampaignStatus } from '@prisma/client';
import { ActivityRepository } from '../activity.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityCenterService } from '../activity-center.service';

describe('ActivityCenterService', () => {
  let service: ActivityCenterService;

  const mockRepo = {
    findCenterRows: jest.fn(),
  };

  const mockPrisma = {
    sysTenant: {
      findMany: jest.fn(),
    },
  };

  function createActivity(
    overrides: Partial<MktCampaign> & { isEnabled?: boolean; triggerCondition?: Record<string, unknown> },
  ): MktCampaign {
    const { isEnabled, triggerCondition, ...campaignOverrides } = overrides;
    return {
      id: 'act_default',
      tenantId: 'tenant_001',
      type: 'FLASH_SALE',
      kind: MktCampaignKind.HANDLER,
      name: '默认活动',
      description: null,
      status: isEnabled === undefined || isEnabled ? MktCampaignStatus.PUBLISHED : MktCampaignStatus.DRAFT,
      startTime: new Date('2026-04-10T00:00:00.000Z'),
      endTime: new Date('2026-04-20T00:00:00.000Z'),
      priority: 0,
      policyJson: null,
      foundationJson: {},
      audienceJson: triggerCondition ?? {},
      stagesJson: {},
      rightsJson: {},
      deliveryJson: {},
      constraintsJson: {},
      ownerUserId: null,
      version: 1,
      createdBy: null,
      updatedBy: null,
      createTime: new Date('2026-04-01T00:00:00.000Z'),
      updateTime: new Date('2026-04-01T00:00:00.000Z'),
      ...campaignOverrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityCenterService,
        { provide: ActivityRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ActivityCenterService>(ActivityCenterService);
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date('2026-04-15T08:00:00.000Z'));
    mockPrisma.sysTenant.findMany.mockResolvedValue([{ tenantId: 'tenant_001', companyName: '演示租户' }]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Given 混合活动列表, When list, Then 支持 keyword/type/status/ownerUserId/timeRange 过滤', async () => {
    mockRepo.findCenterRows.mockResolvedValue([
      createActivity({
        id: 'act_published',
        name: '春节秒杀活动',
        isEnabled: true,
        triggerCondition: { ownerUserId: 'owner_001' },
        startTime: new Date('2026-04-12T00:00:00.000Z'),
        endTime: new Date('2026-04-18T00:00:00.000Z'),
      }),
      createActivity({
        id: 'act_draft',
        name: '草稿活动',
        type: 'GROUP_BUY',
        isEnabled: false,
        triggerCondition: { ownerUserId: 'owner_002' },
        startTime: null,
        endTime: null,
      }),
      createActivity({
        id: 'act_archived',
        name: '春节归档活动',
        isEnabled: false,
        triggerCondition: { ownerUserId: 'owner_001' },
        startTime: new Date('2026-04-01T00:00:00.000Z'),
        endTime: new Date('2026-04-05T00:00:00.000Z'),
      }),
    ]);

    const result = await service.list({
      pageNum: 1,
      pageSize: 20,
      keyword: '春节',
      status: 'PUBLISHED',
      type: 'FLASH_SALE',
      ownerUserId: 'owner_001',
      startTimeFrom: '2026-04-10T00:00:00.000Z',
      startTimeTo: '2026-04-30T23:59:59.999Z',
    });

    const page = result.data as { rows: Array<{ id: string; status: string; tenantName?: string }>; total: number };
    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      id: 'act_published',
      status: 'PUBLISHED',
      tenantName: '演示租户',
    });
  });

  it('Given 月份视图查询, When calendar, Then 返回按天聚合的排期和冲突信息', async () => {
    mockRepo.findCenterRows.mockResolvedValue([
      createActivity({
        id: 'act_alpha',
        name: '活动甲',
        isEnabled: true,
        startTime: new Date('2026-04-12T00:00:00.000Z'),
        endTime: new Date('2026-04-14T00:00:00.000Z'),
      }),
      createActivity({
        id: 'act_beta',
        name: '活动乙',
        isEnabled: true,
        startTime: new Date('2026-04-12T00:00:00.000Z'),
        endTime: new Date('2026-04-12T23:59:59.999Z'),
      }),
    ]);

    const result = await service.calendar({ month: '2026-04' });

    const calendar = result.data as {
      month: string;
      days: Array<{ date: string; total: number; hasConflict: boolean }>;
      conflicts: Array<{ date: string; count: number }>;
    };
    expect(calendar.month).toBe('2026-04');
    expect(calendar.days.length).toBeGreaterThan(0);
    expect(calendar.days.find((day) => day.date === '2026-04-12')).toMatchObject({
      total: 2,
      hasConflict: true,
    });
    expect(calendar.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-04-12',
          count: 2,
        }),
      ]),
    );
  });

  it('Given 时间窗查询, When dashboard, Then 返回 summary 和 trend', async () => {
    mockRepo.findCenterRows.mockResolvedValue([
      createActivity({
        id: 'act_published',
        isEnabled: true,
        startTime: new Date('2026-04-10T00:00:00.000Z'),
        endTime: new Date('2026-04-20T00:00:00.000Z'),
      }),
      createActivity({
        id: 'act_paused',
        isEnabled: false,
        startTime: new Date('2026-04-11T00:00:00.000Z'),
        endTime: new Date('2026-04-21T00:00:00.000Z'),
      }),
      createActivity({
        id: 'act_archived',
        isEnabled: false,
        startTime: new Date('2026-04-01T00:00:00.000Z'),
        endTime: new Date('2026-04-02T00:00:00.000Z'),
      }),
    ]);

    const result = await service.dashboard({
      rangeStart: '2026-04-01T00:00:00.000Z',
      rangeEnd: '2026-04-30T23:59:59.999Z',
    });

    const dashboard = result.data as {
      summary: { total: number; published: number; paused: number; archived: number; draft: number };
      trend: Array<{ date: string; total: number }>;
    };
    expect(dashboard.summary).toMatchObject({
      total: 3,
      published: 1,
      paused: 1,
      archived: 1,
      draft: 0,
    });
    expect(dashboard.trend).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-04-10',
          total: 1,
        }),
      ]),
    );
  });
});
