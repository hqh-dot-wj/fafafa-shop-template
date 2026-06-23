import { request } from '@/service/request';

/**
 * 玩法模板接口，对应 backend PlayTemplateController。
 * 这里额外做分页归一化和写入白名单，保证页面不会把列表行对象或 UI-only 字段直接提交给后端 DTO。
 */
const MARKETING_TEMPLATE_LIST_MAX_PAGE_SIZE = 100;

function normalizeTemplateListParams(
  params?: Api.Marketing.PlayTemplateSearchParams,
): Api.Marketing.PlayTemplateSearchParams | undefined {
  if (!params) return undefined;

  const next: Record<string, unknown> = { ...params };

  if (next.pageSize !== null && next.pageSize !== undefined) {
    const pageSize = Number(next.pageSize);
    if (Number.isFinite(pageSize)) {
      next.pageSize = Math.min(Math.max(1, Math.floor(pageSize)), MARKETING_TEMPLATE_LIST_MAX_PAGE_SIZE);
    }
  }

  if (next.pageNum !== null && next.pageNum !== undefined) {
    const pageNum = Number(next.pageNum);
    if (Number.isFinite(pageNum)) {
      next.pageNum = Math.max(1, Math.floor(pageNum));
    }
  }

  return next as Api.Marketing.PlayTemplateSearchParams;
}

function parseTemplateListPayload(
  body: Api.Marketing.PlayTemplateList | Api.Marketing.PlayTemplate[] | null | undefined,
): { rows: Api.Marketing.PlayTemplate[]; total: number } {
  if (!body) return { rows: [], total: 0 };

  if (Array.isArray(body)) {
    return { rows: body, total: body.length };
  }

  const rows = body.rows ?? [];
  const total = typeof body.total === 'number' ? body.total : rows.length;

  return { rows, total };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function sanitizeTemplateWritePayload(
  data: Partial<Api.Marketing.PlayTemplateCreate & Api.Marketing.PlayTemplateUpdate & Record<string, unknown>>,
): Api.Marketing.PlayTemplateCreate {
  const payload: Api.Marketing.PlayTemplateCreate = {
    name: typeof data.name === 'string' ? data.name : '',
    unitName: typeof data.unitName === 'string' ? data.unitName : '',
    ruleSchema: (data.ruleSchema as Api.Marketing.PlayTemplateCreate['ruleSchema']) ?? { fields: [] },
  };

  const uiComponentId = normalizeOptionalString(data.uiComponentId);
  if (uiComponentId) {
    payload.uiComponentId = uiComponentId;
  }

  return payload;
}

export function fetchGetTemplateList(params?: Api.Marketing.PlayTemplateSearchParams) {
  return request<Api.Marketing.PlayTemplateList>({
    url: '/marketing/template/list',
    method: 'get',
    params: normalizeTemplateListParams(params),
  });
}

async function collectMarketingPlayTemplates(
  all: Api.Marketing.PlayTemplate[],
  pageNum: number,
): Promise<Api.Marketing.PlayTemplate[]> {
  if (pageNum > 100) {
    return all;
  }

  const { data, error } = await fetchGetTemplateList({
    pageNum,
    pageSize: MARKETING_TEMPLATE_LIST_MAX_PAGE_SIZE,
  });

  if (error || !data) {
    return all;
  }

  const { rows, total } = parseTemplateListPayload(data);
  all.push(...rows);

  if (rows.length < MARKETING_TEMPLATE_LIST_MAX_PAGE_SIZE || all.length >= total) {
    return all;
  }

  return collectMarketingPlayTemplates(all, pageNum + 1);
}

export async function fetchAllMarketingPlayTemplates(): Promise<Api.Marketing.PlayTemplate[]> {
  return collectMarketingPlayTemplates([], 1);
}

export function buildMarketingTemplateNameByCode(templates: Api.Marketing.PlayTemplate[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const template of templates) {
    if (template.code) {
      map[template.code] = template.name?.trim() || template.code;
    }
  }

  return map;
}

export function fetchCreateTemplate(data: Api.Marketing.PlayTemplateCreate) {
  return request<Api.Marketing.PlayTemplate>({
    url: '/marketing/template',
    method: 'post',
    data: sanitizeTemplateWritePayload(data),
  });
}

export function fetchUpdateTemplate(id: string, data: Api.Marketing.PlayTemplateUpdate) {
  return request<Api.Marketing.PlayTemplate>({
    url: `/marketing/template/${id}`,
    method: 'put',
    data: sanitizeTemplateWritePayload(data),
  });
}

export function fetchDeleteTemplate(id: string) {
  return request({
    url: `/marketing/template/${id}`,
    method: 'delete',
  });
}
