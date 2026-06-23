import type { MarketingJsonSchema } from '@libs/common-types';
import { request } from '@/service/request';

/**
 * 营销编排动态表单 Schema，对应 backend MarketingSchemaController。
 * 返回类型来自 @libs/common-types，页面只消费 schema 渲染表单，不在前端复刻后端规则结构。
 */
export function fetchCampaignPolicySchema(type: string) {
  return request<MarketingJsonSchema>({
    url: `/admin/marketing/schema/policy/${type}`,
    method: 'get',
  });
}

export function fetchPlayRuleSchema(code: string) {
  return request<MarketingJsonSchema>({
    url: `/admin/marketing/schema/play/${code}`,
    method: 'get',
  });
}

export function fetchSceneTemplateSchema(templateCode: string) {
  return request<MarketingJsonSchema>({
    url: `/admin/marketing/schema/scene-template/${templateCode}`,
    method: 'get',
  });
}
