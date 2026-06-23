import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolutionTraceDiagnostic } from './resolution';
import { fetchResolutionTraceDiagnostic } from './resolution';

const requestMock = vi.hoisted(() => vi.fn());

vi.mock('@/service/request', () => ({
  request: requestMock,
}));

describe('Marketing Resolution API', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it('Trace 诊断应指向只读聚合接口并透传查询参数', async () => {
    const diagnostic: ResolutionTraceDiagnostic = {
      tenantId: 'tenant-1',
      traceId: 'trace-1',
      dates: ['20260428'],
      found: true,
      sceneResolve: [],
      cacheInvalidation: [],
      persistentTrace: [],
      relatedEvents: [],
      relatedIncidents: [],
    };
    const params = { traceId: 'trace-1', days: 3 };
    requestMock.mockResolvedValue({ data: diagnostic, error: null });

    const result = await fetchResolutionTraceDiagnostic(params);

    expect(requestMock).toHaveBeenCalledWith({
      url: '/marketing/resolution/diagnostics/trace',
      method: 'get',
      params,
    });
    expect(result).toEqual(diagnostic);
  });

  it('Trace 诊断接口无 data 时应返回 null', async () => {
    requestMock.mockResolvedValue({ data: undefined, error: null });

    const result = await fetchResolutionTraceDiagnostic({ traceId: 'missing-trace', days: 7 });

    expect(result).toBeNull();
  });
});
