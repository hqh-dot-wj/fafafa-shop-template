import { BusinessException } from 'src/common/exceptions/business.exception';

type RouteRule = {
  path: string;
  requiredParams?: string[];
};

const MINIAPP_ROUTE_RULES: RouteRule[] = [
  { path: '/pages/index/index' },
  { path: '/pages/category/category' },
  { path: '/pages/product/detail', requiredParams: ['id'] },
  { path: '/pages/product/list' },
  { path: '/pages/marketing/detail', requiredParams: ['id'] },
  { path: '/pages/course-group/teams' },
  { path: '/pages/course-group/detail', requiredParams: ['teamId'] },
  { path: '/pages/distribution/entry' },
  { path: '/pages/distribution/index' },
  { path: '/pages/order/list' },
];

const RULE_BY_PATH = new Map(MINIAPP_ROUTE_RULES.map((rule) => [rule.path, rule]));

function safeTrim(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseQuery(queryString: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!queryString) return result;

  for (const segment of queryString.split('&')) {
    if (!segment) continue;
    const equalIndex = segment.indexOf('=');
    if (equalIndex < 0) {
      const key = safeTrim(safeDecode(segment));
      if (key) result[key] = '';
      continue;
    }
    const key = safeTrim(safeDecode(segment.slice(0, equalIndex)));
    if (!key) continue;
    const value = safeTrim(safeDecode(segment.slice(equalIndex + 1)));
    result[key] = value;
  }
  return result;
}

function buildQuery(params: Record<string, string>, preferredOrder: string[]): string {
  const consumed = new Set<string>();
  const pairs: string[] = [];

  for (const key of preferredOrder) {
    const value = safeTrim(params[key]);
    if (!value) continue;
    consumed.add(key);
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  const restKeys = Object.keys(params)
    .filter((key) => !consumed.has(key))
    .sort((a, b) => a.localeCompare(b));
  for (const key of restKeys) {
    const value = safeTrim(params[key]);
    if (!value) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  return pairs.join('&');
}

export function normalizeMiniappRoutePath(pathInput: string): { path: string; params: Record<string, string> } {
  const raw = safeTrim(pathInput);
  BusinessException.throwIf(!raw, '页面路由不能为空');

  const [basePathRaw, queryString = ''] = raw.split('?', 2);
  const basePath = basePathRaw.startsWith('pages/') ? `/${basePathRaw}` : basePathRaw;
  const rule = RULE_BY_PATH.get(basePath);
  BusinessException.throwIf(!rule, '页面路由不在白名单内');

  const params = parseQuery(queryString);
  const required = rule.requiredParams ?? [];
  for (const key of required) {
    const value = safeTrim(params[key]);
    BusinessException.throwIf(!value, `页面路由缺少必填参数：${key}`);
  }

  const query = buildQuery(params, required);
  return {
    path: query ? `${basePath}?${query}` : basePath,
    params,
  };
}

export function normalizeMiniappRoutePathOrDefault(inputPath: string | null | undefined, defaultPath: string): string {
  const candidate = safeTrim(inputPath) || safeTrim(defaultPath);
  return normalizeMiniappRoutePath(candidate).path;
}

export function normalizeStoredMiniappRoutePathOrDefault(
  inputPath: string | null | undefined,
  defaultPath: string,
): string {
  const candidate = safeTrim(inputPath);
  if (candidate) {
    try {
      return normalizeMiniappRoutePath(candidate).path;
    } catch {
      // Stored routes may predate the current whitelist; read paths degrade to a validated fallback.
    }
  }
  return normalizeMiniappRoutePath(safeTrim(defaultPath)).path;
}
