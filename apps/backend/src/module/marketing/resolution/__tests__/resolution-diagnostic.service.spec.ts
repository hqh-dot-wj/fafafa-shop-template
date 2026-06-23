import { BusinessException } from 'src/common/exceptions/business.exception';
import { ResponseCode } from 'src/common/response/response.interface';
import { ResolutionDiagnosticService } from '../resolution-diagnostic.service';

describe('ResolutionDiagnosticService', () => {
  const observability = {
    getTraceDiagnostics: jest.fn(),
  };
  const incidentService = {
    listIncidents: jest.fn(),
  };

  let service: ResolutionDiagnosticService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ResolutionDiagnosticService(observability as any, incidentService as any);
  });

  it('按 traceId 汇总场景样本、缓存事件目录和关联工单', async () => {
    observability.getTraceDiagnostics.mockResolvedValue({
      tenantId: '000000',
      traceId: 'trace-1',
      dates: ['20260428'],
      sceneResolve: [
        {
          date: '20260428',
          traceId: 'trace-1',
          hitCount: 1,
          sceneCode: 'HOME_FEATURED',
          moduleCount: 2,
          emptyModuleCount: 0,
          channel: 'MINIAPP',
          durationMs: 80,
          status: 'SUCCESS',
          recordedAt: '2026-04-28T00:00:00.000Z',
        },
      ],
      cacheInvalidation: [
        {
          date: '20260428',
          traceId: 'trace-1',
          hitCount: 1,
          eventType: 'scene.release.published',
          sceneCode: 'HOME_FEATURED',
          deletedKeys: 4,
          durationMs: 12,
          recordedAt: '2026-04-28T00:01:00.000Z',
        },
      ],
      persistentTrace: [
        {
          date: '20260428',
          traceId: 'trace-1',
          traceKind: 'CACHE_INVALIDATION',
          eventType: 'scene.release.published',
          status: 'SUCCESS',
          durationMs: 12,
          recordedAt: '2026-04-28T00:01:00.000Z',
        },
      ],
    });
    incidentService.listIncidents.mockResolvedValue({
      data: {
        rows: [
          {
            id: 'incident-1',
            traceId: 'trace-1',
            title: '相关工单',
          },
        ],
      },
    });

    const result = await service.getTraceDiagnostic({
      tenantId: '000000',
      traceId: 'trace-1',
      days: 3,
    });

    expect(observability.getTraceDiagnostics).toHaveBeenCalledWith({
      tenantId: '000000',
      traceId: 'trace-1',
      days: 3,
    });
    expect(incidentService.listIncidents).toHaveBeenCalledWith({
      tenantId: '000000',
      keyword: 'trace-1',
      pageNum: 1,
      pageSize: 20,
    });
    expect(result.found).toBe(true);
    expect(result.relatedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'scene.release.published',
        }),
      ]),
    );
    expect(result.relatedIncidents).toEqual([
      expect.objectContaining({
        traceId: 'trace-1',
      }),
    ]);
  });

  it('没有样本时仍返回查询日期和空关联结果', async () => {
    observability.getTraceDiagnostics.mockResolvedValue({
      tenantId: '000000',
      traceId: 'trace-missing',
      dates: ['20260428'],
      sceneResolve: [],
      cacheInvalidation: [],
      persistentTrace: [],
    });
    incidentService.listIncidents.mockResolvedValue({ data: { rows: [] } });

    const result = await service.getTraceDiagnostic({
      tenantId: '000000',
      traceId: 'trace-missing',
    });

    expect(result).toMatchObject({
      tenantId: '000000',
      traceId: 'trace-missing',
      dates: ['20260428'],
      found: false,
      sceneResolve: [],
      cacheInvalidation: [],
      persistentTrace: [],
      relatedEvents: [],
      relatedIncidents: [],
    });
  });

  it('空 traceId 不应继续查询观测样本或关联工单', async () => {
    await expect(
      service.getTraceDiagnostic({
        tenantId: '000000',
        traceId: '   ',
      }),
    ).rejects.toMatchObject<BusinessException>({
      errorCode: ResponseCode.PARAM_INVALID,
    });

    expect(observability.getTraceDiagnostics).not.toHaveBeenCalled();
    expect(incidentService.listIncidents).not.toHaveBeenCalled();
  });
});
