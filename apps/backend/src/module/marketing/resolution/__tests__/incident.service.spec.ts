import { IncidentService } from '../incident.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { ResolutionObservabilityService } from '../resolution-observability.service';
import { InstanceProbeService } from '../../instance/instance-probe.service';
import { IncidentAction } from '../vo/incident.vo';

describe('IncidentService', () => {
  let service: IncidentService;
  let redisService: {
    get: jest.Mock;
    set: jest.Mock;
    scanKeysByMatch: jest.Mock;
    mget: jest.Mock;
  };
  let observabilityService: {
    getDashboard: jest.Mock;
  };
  let instanceProbeService: {
    listAbnormalProbes: jest.Mock;
  };

  beforeEach(() => {
    redisService = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => 'OK'),
      scanKeysByMatch: jest.fn(async () => []),
      mget: jest.fn(async () => []),
    };
    observabilityService = {
      getDashboard: jest.fn(async () => ({
        overview: {
          alerts: [
            {
              code: 'SCENE_RESOLVE_FAILURE_RATE',
              level: 'WARN',
              threshold: 5,
              actual: 12,
              message: 'fail rate high',
              incidentSeed: {
                type: 'METRIC_ALERT',
                referenceId: 'SCENE_RESOLVE_FAILURE_RATE',
                defaultLevel: 'HIGH',
              },
            },
          ],
        },
      })),
    };
    instanceProbeService = {
      listAbnormalProbes: jest.fn(async () => [
        {
          instanceId: 'inst-1',
          code: 'PROBE_STEP_MISSING',
          level: 'HIGH',
          message: '缺少 PAID 步骤',
          traceId: 'trace-1',
          occurredAt: '2026-04-19T08:00:00.000Z',
          context: { missingStep: 'INSTANCE_PAID' },
        },
      ]),
    };

    service = new IncidentService(
      redisService as unknown as RedisService,
      observabilityService as unknown as ResolutionObservabilityService,
      instanceProbeService as unknown as InstanceProbeService,
    );
  });

  it('应该把指标告警与探针异常聚合成排障工单', async () => {
    const result = await service.listIncidents({
      tenantId: '000000',
      status: 'OPEN',
      pageNum: 1,
      pageSize: 20,
    });
    const rows = result.data?.rows ?? [];

    expect(rows.map(row => row.type)).toEqual(expect.arrayContaining(['METRIC_ALERT', 'PROBE_STEP_MISSING']));
    expect(result.data?.total).toBe(2);
  });

  it('处理工单后应写入动作状态', async () => {
    await service.handleIncident(
      '000000',
      'metric:SCENE_RESOLVE_FAILURE_RATE',
      { action: IncidentAction.ACK, remark: '已通知值班同学' },
      'tester',
    );

    expect(redisService.set).toHaveBeenCalledTimes(1);
    const [key, payload] = redisService.set.mock.calls[0] ?? [];
    expect(String(key)).toContain('marketing:resolution:incident:action:000000:metric:SCENE_RESOLVE_FAILURE_RATE');
    expect(payload).toMatchObject({
      status: 'ACK',
      latestHandle: {
        action: 'ACK',
        operator: 'tester',
      },
    });
  });

  it('上报拼课 incident 后，列表应包含 course-group 特有类型', async () => {
    redisService.scanKeysByMatch.mockResolvedValue([
      'marketing:resolution:incident:report:000000:course-group:team-1:TEAM_EFFECT_APPLY_FAILED',
    ]);
    redisService.mget.mockResolvedValue([
      {
        id: 'course-group:team-1:TEAM_EFFECT_APPLY_FAILED',
        tenantId: '000000',
        type: 'TEAM_EFFECT_APPLY_FAILED',
        level: 'HIGH',
        status: 'OPEN',
        title: '拼课副作用补偿失败',
        message: '排课补偿失败',
        occurredAt: '2026-04-23T12:00:00.000Z',
      },
    ]);

    await service.reportIncident({
      id: 'course-group:team-1:TEAM_EFFECT_APPLY_FAILED',
      tenantId: '000000',
      type: 'TEAM_EFFECT_APPLY_FAILED' as any,
      level: 'HIGH' as any,
      status: 'OPEN' as any,
      title: '拼课副作用补偿失败',
      message: '排课补偿失败',
      occurredAt: '2026-04-23T12:00:00.000Z',
    });

    const result = await service.listIncidents({
      tenantId: '000000',
      pageNum: 1,
      pageSize: 20,
    });

    expect(redisService.set).toHaveBeenCalledWith(
      'marketing:resolution:incident:report:000000:course-group:team-1:TEAM_EFFECT_APPLY_FAILED',
      expect.objectContaining({
        type: 'TEAM_EFFECT_APPLY_FAILED',
      }),
      expect.any(Number),
    );
    expect(result.data?.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'TEAM_EFFECT_APPLY_FAILED',
          title: '拼课副作用补偿失败',
        }),
      ]),
    );
  });
});
