/**
 * AI 平台 Prompt 页面接口，前端归在 marketing 菜单下，后端实际对应 ai-content/AiPlatformPromptController。
 * 当前 DTO/VO 未进入 @libs/common-types，字段变更时需同步核对 apps/backend/src/module/ai-content/dto/platform-prompt.dto.ts。
 * @expires backend 导出 Prompt DTO/VO 并更新 OpenAPI 后切换至 generate-types。
 */
import { request } from '@/service/request';

export interface AiPlatformPromptRow {
  id: string;
  tenantId: string;
  tenantName: string;
  platformCode: string;
  platformName: string;
  icon: string | null;
  systemPrompt: string;
  outputSchema: Record<string, string>;
  maxLength: number | null;
  sortOrder: number;
  status: number;
  createTime: string;
  updateTime: string;
}

export interface AiPlatformPromptListParams {
  pageNum: number;
  pageSize: number;
  platformCode?: string | null;
  status?: number | null;
}

export interface AiPlatformPromptCreateBody {
  platformCode: string;
  platformName: string;
  icon?: string;
  /** 运营配置的系统提示词，后端按租户保存；前端不在这里做 Prompt 拼接。 */
  systemPrompt: string;
  /** 输出结构约束，页面按 key/value 编辑，后端负责持久化与使用。 */
  outputSchema: Record<string, string>;
  maxLength?: number;
  sortOrder?: number;
}

export type AiPlatformPromptUpdateBody = Omit<Partial<AiPlatformPromptCreateBody>, 'platformCode'>;

export function fetchAiPromptList(params: AiPlatformPromptListParams) {
  return request<{ rows: AiPlatformPromptRow[]; total: number }>({
    url: '/ai-platform-prompt/list',
    method: 'get',
    params: {
      pageNum: params.pageNum,
      pageSize: params.pageSize,
      platformCode: params.platformCode || undefined,
      status: params.status === null || params.status === undefined ? undefined : params.status,
    },
  });
}

export function fetchAiPromptDetail(id: string) {
  return request<AiPlatformPromptRow>({
    url: `/ai-platform-prompt/${id}`,
    method: 'get',
  });
}

export function fetchAiPromptCreate(data: AiPlatformPromptCreateBody) {
  return request<AiPlatformPromptRow>({
    url: '/ai-platform-prompt',
    method: 'post',
    data,
  });
}

export function fetchAiPromptUpdate(id: string, data: AiPlatformPromptUpdateBody) {
  return request<AiPlatformPromptRow>({
    url: `/ai-platform-prompt/${id}`,
    method: 'put',
    data,
  });
}

export function fetchAiPromptDelete(id: string) {
  return request<null>({
    url: `/ai-platform-prompt/${id}`,
    method: 'delete',
  });
}

export function fetchAiPromptUpdateStatus(id: string, status: number) {
  return request<null>({
    url: `/ai-platform-prompt/${id}/status`,
    method: 'put',
    data: { status },
  });
}
