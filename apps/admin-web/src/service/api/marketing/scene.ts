import { request } from '@/service/request';

/**
 * 营销场景管理接口，对应 backend MarketingSceneController。
 * 旧 /admin/scene alias 仅服务历史入口和预览能力，本文件保持使用 /admin/marketing/scene 正式前缀。
 */
export function fetchSceneList(params?: Api.Marketing.SceneSearchParams) {
  return request<Api.Marketing.SceneList>({ url: '/admin/marketing/scene/list', method: 'get', params });
}

export function fetchSceneModuleList(params?: Api.Marketing.SceneModuleListSearchParams) {
  return request<Api.Marketing.SceneModuleList>({
    url: '/admin/marketing/scene/module/list',
    method: 'get',
    params,
  });
}

export function fetchSceneTemplateList(params?: Api.Marketing.SceneTemplateSearchParams) {
  return request<Api.Marketing.SceneTemplateList>({
    url: '/admin/marketing/scene/template/list',
    method: 'get',
    params,
  });
}

export function fetchSaveScene(data: Api.Marketing.SaveSceneParams) {
  return request({ url: '/admin/marketing/scene', method: 'post', data });
}

export function fetchCreateSceneFromTemplate(data: Api.Marketing.CreateSceneFromTemplateParams) {
  return request({ url: '/admin/marketing/scene/from-template', method: 'post', data });
}

export function fetchSyncSceneFromTemplate(sceneId: string, data: Api.Marketing.SyncSceneFromTemplateParams) {
  return request({ url: `/admin/marketing/scene/${sceneId}/sync-template`, method: 'post', data });
}

export function fetchSaveSceneModule(sceneCode: string, data: Api.Marketing.SaveSceneModuleParams) {
  return request({ url: `/admin/marketing/scene/${sceneCode}/module`, method: 'post', data });
}

export function fetchPublishScene(sceneCode: string) {
  return request({ url: `/admin/marketing/scene/${sceneCode}/publish`, method: 'post' });
}

export function fetchScenePublishPrecheck(sceneCode: string) {
  return request<Api.Marketing.ScenePublishPrecheckResult>({
    url: `/admin/marketing/scene/${sceneCode}/precheck`,
    method: 'get',
  });
}
