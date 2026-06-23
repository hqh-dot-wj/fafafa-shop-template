import { MarketingEventType } from './marketing-event.types';
import { TouchpointOrchestratorService } from './touchpoint-orchestrator.service';

describe('TouchpointOrchestratorService', () => {
  const mockNotificationService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const mockTouchpointService = {
    findByActivityId: jest.fn(),
    findRuntimeTouchpointsByActivityType: jest.fn(),
  };

  const service = new TouchpointOrchestratorService(
    mockTouchpointService as never,
    mockNotificationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('translates instance success event into notification dispatch task', async () => {
    mockTouchpointService.findByActivityId.mockResolvedValue([
      {
        kind: 'MESSAGE',
        code: 'SUCCESS_WELCOME',
        config: {
          channels: ['IN_APP'],
          templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
          templateVersion: 'v1',
          quietHours: { start: '22:00', end: '08:00', timezone: 'Asia/Shanghai' },
          frequencyLimit: { perUserPerDay: 1, perActivityPerDay: 3 },
        },
      },
    ]);

    await service.dispatch({
      event: {
        tenantId: '000000',
        type: MarketingEventType.INSTANCE_SUCCESS,
        instanceId: 'inst_001',
        configId: 'activity_001',
        memberId: 'member_001',
        payload: {
          activityType: 'NEWCOMER_EXCLUSIVE',
          sceneCode: 'newcomer',
          content: 'activity success',
        },
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'IN_APP',
        template: 'MKT_ACTIVITY_SUCCESS_V1',
        dispatchContext: expect.objectContaining({
          bizType: 'MARKETING_ACTIVITY',
          activityId: 'activity_001',
          touchpointCode: 'ACTIVITY_SUCCESS',
          touchpointKind: 'MESSAGE',
        }),
      }),
    );
  });

  it('skips unsupported events and sends nothing', async () => {
    const result = await service.dispatch({
      event: {
        tenantId: '000000',
        type: MarketingEventType.INSTANCE_CREATED,
        instanceId: 'inst_001',
        configId: 'activity_001',
        memberId: 'member_001',
        payload: {},
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(result).toEqual({ planned: 0, sent: 0, skipped: 0 });
    expect(mockNotificationService.send).not.toHaveBeenCalled();
  });

  it('skips dry-run simulation events even when the event type supports touchpoints', async () => {
    const result = await service.plan({
      event: {
        tenantId: '000000',
        type: MarketingEventType.INSTANCE_PAID,
        instanceId: 'sim_001',
        configId: 'activity_001',
        memberId: 'member_001',
        payload: {
          simulation: true,
          dryRunOnly: true,
        },
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(result).toEqual({
      matched: false,
      reason: 'DRY_RUN_ONLY',
      tasks: [],
    });
    expect(mockTouchpointService.findByActivityId).not.toHaveBeenCalled();
    expect(mockNotificationService.send).not.toHaveBeenCalled();
  });

  it('falls back to runtime touchpoints when activity-specific touchpoints are empty', async () => {
    mockTouchpointService.findByActivityId.mockResolvedValue([]);
    mockTouchpointService.findRuntimeTouchpointsByActivityType.mockResolvedValue([
      {
        kind: 'MESSAGE',
        code: 'SUCCESS_WELCOME',
        config: {
          channels: ['IN_APP'],
          templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
          consentRequired: true,
        },
      },
    ]);

    await service.dispatch({
      event: {
        tenantId: '000000',
        type: MarketingEventType.INSTANCE_SUCCESS,
        instanceId: 'inst_002',
        configId: 'activity_002',
        memberId: 'member_002',
        payload: {
          activityType: 'NEWCOMER_EXCLUSIVE',
          consentGranted: true,
        },
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(mockTouchpointService.findRuntimeTouchpointsByActivityType).toHaveBeenCalledWith('NEWCOMER_EXCLUSIVE');
    expect(mockNotificationService.send).toHaveBeenCalledTimes(1);
  });

  it('maps course group formed event to course-group touchpoint code', async () => {
    mockTouchpointService.findByActivityId.mockResolvedValue([
      {
        kind: 'MESSAGE',
        code: 'COURSE_GROUP_FORMED',
        config: {
          channels: ['IN_APP'],
        },
      },
    ]);

    await service.dispatch({
      event: {
        tenantId: '000000',
        type: MarketingEventType.COURSE_GROUP_TEAM_FORMED,
        instanceId: 'team_001',
        configId: 'activity_001',
        memberId: 'leader_001',
        payload: {
          content: 'course group formed',
        },
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatchContext: expect.objectContaining({
          touchpointCode: 'COURSE_GROUP_TEAM_FORMED',
        }),
      }),
    );
  });

  it('returns missing target when no target can be resolved', async () => {
    mockTouchpointService.findByActivityId.mockResolvedValue([
      {
        kind: 'MESSAGE',
        code: 'SUCCESS_WELCOME',
        config: {
          channels: ['IN_APP'],
          templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
        },
      },
    ]);

    const result = await service.plan({
      event: {
        tenantId: '000000',
        type: MarketingEventType.INSTANCE_SUCCESS,
        instanceId: 'inst_003',
        configId: 'activity_003',
        memberId: '',
        payload: {},
        timestamp: new Date('2026-04-19T10:00:00+08:00'),
      },
    });

    expect(result).toEqual({
      matched: false,
      reason: 'MISSING_TARGET',
      tasks: [],
    });
  });
});
