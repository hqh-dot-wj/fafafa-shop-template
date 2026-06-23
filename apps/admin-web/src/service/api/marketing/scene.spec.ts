// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchCreateSceneFromTemplate,
  fetchPublishScene,
  fetchSaveScene,
  fetchSaveSceneModule,
  fetchSceneList,
  fetchSceneModuleList,
  fetchSceneTemplateList,
  fetchSyncSceneFromTemplate,
} from './scene';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Marketing Scene API', () => {
  it('fetchSceneList should GET /admin/marketing/scene/list', async () => {
    const res = await fetchSceneList({ pageNum: 1, pageSize: 10 });
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/list', method: 'get' });
  });

  it('fetchPublishScene should POST /admin/marketing/scene/:sceneCode/publish', async () => {
    const res = await fetchPublishScene('HOME_FEATURED');
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/HOME_FEATURED/publish', method: 'post' });
  });

  it('fetchSaveScene should POST /admin/marketing/scene', async () => {
    const res = await fetchSaveScene({
      sceneCode: 'HOME_FEATURED',
      sceneName: '首页推荐',
      sceneType: 'HOME',
      channelScope: ['MINIAPP'],
    });
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene', method: 'post' });
  });

  it('fetchSceneTemplateList should GET /admin/marketing/scene/template/list', async () => {
    const params = { pageNum: 1, pageSize: 20, isActive: 'true' };
    const res = await fetchSceneTemplateList(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/template/list', method: 'get', params });
  });

  it('fetchCreateSceneFromTemplate should POST /admin/marketing/scene/from-template', async () => {
    const res = await fetchCreateSceneFromTemplate({
      templateCode: 'NEW_CUSTOMER_ZONE',
      sceneCode: 'NEW_ZONE_001',
      sceneName: '新人专区',
    });
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/from-template', method: 'post' });
  });

  it('fetchSyncSceneFromTemplate should POST /admin/marketing/scene/:sceneId/sync-template', async () => {
    const res = await fetchSyncSceneFromTemplate('scene-1', { fields: ['modules.*.cardTemplateCode'] });
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/scene-1/sync-template', method: 'post' });
  });

  it('fetchSaveSceneModule should POST /admin/marketing/scene/:sceneCode/module', async () => {
    const res = await fetchSaveSceneModule('HOME_FEATURED', {
      moduleCode: 'FLASH_SALE',
      moduleName: '限时特卖',
      moduleType: 'PRODUCT_LIST',
      sourcePolicyCode: 'SRC_001',
      resolverPolicyCode: 'RSV_001',
      cardTemplateCode: 'CARD_A',
    });
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/HOME_FEATURED/module', method: 'post' });
  });

  it('fetchSceneModuleList should GET /admin/marketing/scene/module/list', async () => {
    const params = { pageNum: 1, pageSize: 10, sceneCode: 'HOME_FEATURED' };
    const res = await fetchSceneModuleList(params);
    expect(res.data).toMatchObject({ url: '/admin/marketing/scene/module/list', method: 'get', params });
  });
});
