import { normalizeHttpMetricPath, sanitizePathSegment, shouldSkipHttpMetric } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor helpers', () => {
  it('应优先使用 route 模板路径，避免高基数', () => {
    const path = normalizeHttpMetricPath({
      route: { path: '/:id/detail' },
      baseUrl: '/api/client/order',
      path: '/api/client/order/123/detail',
      originalUrl: '/api/client/order/123/detail?expand=1',
      url: '/api/client/order/123/detail?expand=1',
    } as any);

    expect(path).toBe('/api/client/order/:id/detail');
  });

  it('应对 fallback 路径进行数字脱敏', () => {
    const path = normalizeHttpMetricPath({
      route: undefined,
      baseUrl: '',
      path: '/api/store/product/987654',
      originalUrl: '/api/store/product/987654?pageNum=1',
      url: '/api/store/product/987654?pageNum=1',
    } as any);

    expect(path).toBe('/api/store/product/:int');
  });

  it('应识别 uuid 和 token 段', () => {
    expect(sanitizePathSegment('550e8400-e29b-41d4-a716-446655440000')).toBe(':uuid');
    expect(sanitizePathSegment('f'.repeat(24))).toBe(':oid');
    expect(sanitizePathSegment('AbCdEfGhIjKlMnOpQrStUvWx')).toBe(':token');
  });

  it('应跳过 metrics 与 health 等非业务路径', () => {
    expect(shouldSkipHttpMetric('/api/metrics')).toBe(true);
    expect(shouldSkipHttpMetric('/api/health')).toBe(true);
    expect(shouldSkipHttpMetric('/api/client/product/list')).toBe(false);
  });
});
