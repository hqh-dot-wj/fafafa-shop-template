export interface MarketingRouteParamSpec {
  key: string;
  label: string;
  required: boolean;
  description?: string;
  defaultValue?: string;
}

export interface MarketingRouteTarget {
  key: string;
  name: string;
  routeName: string;
  path: string;
  category: 'RECOMMEND' | 'AD' | 'ACTIVITY' | 'MEMBER' | 'ORDER' | 'DISTRIBUTION';
  description: string;
  params: MarketingRouteParamSpec[];
}

export interface MarketingRouteValidationResult {
  valid: boolean;
  reason?: string;
  targetKey?: string;
  targetName?: string;
  routeName?: string;
  normalizedPath?: string;
  params: Record<string, string>;
}

export const MARKETING_ROUTE_TARGETS: MarketingRouteTarget[] = [
  {
    key: 'home_index',
    name: '首页',
    routeName: 'pages/index/index',
    path: '/pages/index/index',
    category: 'AD',
    description: '首页默认入口，可用于横幅广告跳转',
    params: [],
  },
  {
    key: 'category_index',
    name: '分类页',
    routeName: 'pages/category/category',
    path: '/pages/category/category',
    category: 'AD',
    description: '分类页入口',
    params: [],
  },
  {
    key: 'product_detail',
    name: '商品详情',
    routeName: 'pages/product/detail',
    path: '/pages/product/detail',
    category: 'RECOMMEND',
    description: '推荐位、猜你喜欢、广告位常用落地页',
    params: [
      { key: 'id', label: '商品ID', required: true },
      { key: 'activityContextKey', label: '活动上下文', required: false },
      { key: 'entrySceneCode', label: '来源场景编码', required: false },
      { key: 'entryModuleCode', label: '来源模块编码', required: false },
      { key: 'entrySource', label: '来源标识', required: false, defaultValue: 'ad' },
    ],
  },
  {
    key: 'product_list',
    name: '商品列表',
    routeName: 'pages/product/list',
    path: '/pages/product/list',
    category: 'RECOMMEND',
    description: '拼课推荐/新人专享/秒杀专区统一列表页',
    params: [
      { key: 'sourceType', label: '来源类型', required: false, defaultValue: 'SCENE' },
      { key: 'sceneCode', label: '场景编码', required: false },
      { key: 'title', label: '页面标题', required: false },
      { key: 'activityType', label: '活动类型', required: false },
      { key: 'productId', label: '商品ID（定位）', required: false },
      { key: 'categoryId', label: '分类ID', required: false },
      { key: 'level1CategoryId', label: '一级分类ID', required: false },
      { key: 'entrySource', label: '来源标识', required: false },
    ],
  },
  {
    key: 'marketing_detail',
    name: '活动详情页',
    routeName: 'pages/marketing/detail',
    path: '/pages/marketing/detail',
    category: 'ACTIVITY',
    description: '广告位直达活动详情',
    params: [{ key: 'id', label: '活动ID', required: true }],
  },
  {
    key: 'course_group_teams',
    name: '拼课组队页',
    routeName: 'pages/course-group/teams',
    path: '/pages/course-group/teams',
    category: 'ACTIVITY',
    description: '拼课玩法主入口',
    params: [
      { key: 'productId', label: '商品ID', required: true },
      { key: 'activityContextKey', label: '活动上下文', required: false },
      { key: 'teamId', label: '团ID', required: false },
    ],
  },
  {
    key: 'course_group_detail',
    name: '拼课团详情页',
    routeName: 'pages/course-group/detail',
    path: '/pages/course-group/detail',
    category: 'ACTIVITY',
    description: '指定团详情入口',
    params: [{ key: 'teamId', label: '团ID', required: true }],
  },
  {
    key: 'distribution_entry',
    name: '分销入口',
    routeName: 'pages/distribution/entry',
    path: '/pages/distribution/entry',
    category: 'DISTRIBUTION',
    description: '广告位跳转分销入口',
    params: [],
  },
  {
    key: 'distribution_index',
    name: '分销中心',
    routeName: 'pages/distribution/index',
    path: '/pages/distribution/index',
    category: 'DISTRIBUTION',
    description: '分销主页面',
    params: [],
  },
  {
    key: 'order_list',
    name: '订单列表',
    routeName: 'pages/order/list',
    path: '/pages/order/list',
    category: 'ORDER',
    description: '活动闭环后的订单查看',
    params: [],
  },
];

const TARGET_BY_KEY = new Map(MARKETING_ROUTE_TARGETS.map((item) => [item.key, item]));
const TARGET_BY_PATH = new Map(MARKETING_ROUTE_TARGETS.map((item) => [item.path, item]));

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
  const handled = new Set<string>();
  const pairs: string[] = [];

  for (const key of preferredOrder) {
    const value = safeTrim(params[key]);
    if (!value) continue;
    handled.add(key);
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  const restKeys = Object.keys(params)
    .filter((key) => !handled.has(key))
    .sort((a, b) => a.localeCompare(b));
  for (const key of restKeys) {
    const value = safeTrim(params[key]);
    if (!value) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  return pairs.join('&');
}

function isUnsafeParamValue(value: string): boolean {
  return /[\r\n]/.test(value);
}

export function buildMarketingRoutePath(
  targetKey: string,
  paramsInput: Record<string, string | number | boolean | null | undefined> = {},
): string {
  const target = TARGET_BY_KEY.get(targetKey);
  if (!target) {
    return '';
  }

  const params: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(paramsInput)) {
    if (rawValue == null) continue;
    const value = safeTrim(String(rawValue));
    if (!value) continue;
    params[key] = value;
  }

  for (const spec of target.params) {
    if (!params[spec.key] && spec.defaultValue) {
      params[spec.key] = spec.defaultValue;
    }
  }

  const preferredOrder = target.params.map((item) => item.key);
  const query = buildQuery(params, preferredOrder);
  if (!query) return target.path;
  return `${target.path}?${query}`;
}

export function parseMarketingRoutePath(pathInput: string): MarketingRouteValidationResult {
  const rawPath = safeTrim(pathInput);
  if (!rawPath) {
    return {
      valid: false,
      reason: '路径为空',
      params: {},
    };
  }

  const [basePath, rawQuery = ''] = rawPath.split('?', 2);
  const normalizedBasePath = basePath.startsWith('pages/') ? `/${basePath}` : basePath;
  const target = TARGET_BY_PATH.get(normalizedBasePath);
  if (!target) {
    return {
      valid: false,
      reason: '路由不在营销白名单',
      params: parseQuery(rawQuery),
    };
  }

  const params = parseQuery(rawQuery);
  for (const spec of target.params) {
    const value = safeTrim(params[spec.key]);
    if (spec.required && !value) {
      return {
        valid: false,
        reason: `缺少必填参数：${spec.label}`,
        targetKey: target.key,
        targetName: target.name,
        routeName: target.routeName,
        params,
      };
    }
    if (value && isUnsafeParamValue(value)) {
      return {
        valid: false,
        reason: `参数非法：${spec.label}`,
        targetKey: target.key,
        targetName: target.name,
        routeName: target.routeName,
        params,
      };
    }
  }

  const normalizedPath = buildMarketingRoutePath(target.key, params);
  return {
    valid: true,
    targetKey: target.key,
    targetName: target.name,
    routeName: target.routeName,
    normalizedPath,
    params,
  };
}

export function getMarketingRouteTargetByKey(targetKey: string): MarketingRouteTarget | undefined {
  return TARGET_BY_KEY.get(targetKey);
}

export function getMarketingRouteTargetByPath(path: string): MarketingRouteTarget | undefined {
  const safePath = safeTrim(path);
  if (!safePath) return undefined;
  const normalizedPath = safePath.startsWith('pages/') ? `/${safePath}` : safePath;
  return TARGET_BY_PATH.get(normalizedPath);
}
