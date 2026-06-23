// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import { fetchScenePreviewProducts } from './scene-placement';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Scene Placement API', () => {
  it('fetchScenePreviewProducts 应调用后台专用预览接口并透传模拟上下文', async () => {
    const params = {
      channel: 'ADMIN_PREVIEW' as const,
      memberId: 'member-1',
      clientVersion: '1.2.0',
      pageNum: 1,
      pageSize: 20,
    };

    const res = await fetchScenePreviewProducts('HOME_FEATURED', params);

    expect(res.data).toMatchObject({
      url: '/admin/scene/HOME_FEATURED/preview-products',
      method: 'get',
      params,
    });
  });
});
