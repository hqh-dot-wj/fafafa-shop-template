import { pathToRegexp } from 'path-to-regexp';

/** 与 JwtAuthGuard 放行语义对齐：免 tenant-id 的「全局」接口 */
export type TenantPathPolicyKind = 'exempt' | 'client_default_super' | 'strict_admin';

export interface RouteWhitelistItem {
  path: string;
  method: string;
}

/**
 * 去掉全局 prefix（如 /api）后的路径，用于与 Controller 路径对齐
 */
export function normalizeStrippedPath(
  originalUrl: string | undefined,
  url: string | undefined,
  globalPrefix: string,
): string {
  const raw = (originalUrl ?? url ?? '/').split('?')[0] ?? '/';
  const pref = globalPrefix.endsWith('/') ? globalPrefix.slice(0, -1) : globalPrefix;
  let p = raw;
  if (pref && p.startsWith(pref)) {
    p = p.slice(pref.length) || '/';
  }
  return p.startsWith('/') ? p : `/${p}`;
}

/**
 * 配置项 TENANT_EXEMPT_PATH_PREFIXES：路径等于前缀或为其子路径时视为 exempt
 */
export function matchesConfiguredExemptPrefix(strippedPath: string, prefixes: readonly string[] | undefined): boolean {
  if (!prefixes?.length) {
    return false;
  }
  for (const raw of prefixes) {
    let p = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    if (!p.startsWith('/')) {
      p = `/${p}`;
    }
    if (strippedPath === p || strippedPath.startsWith(`${p}/`)) {
      return true;
    }
  }
  return false;
}

function matchesPermWhitelist(
  strippedPath: string,
  method: string,
  whitelist: RouteWhitelistItem[] | undefined,
): boolean {
  if (!whitelist?.length) {
    return false;
  }
  const upper = method.toUpperCase();
  return whitelist.some((route) => {
    if (route.method && route.method.toUpperCase() !== upper) {
      return false;
    }
    try {
      return !!pathToRegexp(route.path).exec(strippedPath);
    } catch {
      return false;
    }
  });
}

function isInfrastructureExemptPath(strippedPath: string): boolean {
  if (strippedPath === '/health' || strippedPath.startsWith('/health/')) {
    return true;
  }
  if (strippedPath === '/metrics' || strippedPath.startsWith('/metrics/')) {
    return true;
  }
  if (strippedPath === '/auth' || strippedPath.startsWith('/auth/')) {
    return true;
  }
  if (strippedPath === '/swagger-ui' || strippedPath.startsWith('/swagger-ui/')) {
    return true;
  }
  if (strippedPath === '/api-docs' || strippedPath.startsWith('/api-docs/')) {
    return true;
  }
  if (strippedPath === '/resource' || strippedPath.startsWith('/resource/')) {
    return true;
  }
  return false;
}

/** MainController @Controller('/') 下登录前接口（与 Jwt 白名单、NotRequireAuth 语义一致） */
function isLegacyMainPublicPath(strippedPath: string, method: string): boolean {
  const upper = method.toUpperCase();
  const legacy: Record<string, Set<string>> = {
    '/login': new Set(['POST']),
    '/logout': new Set(['POST']),
    '/register': new Set(['POST']),
    '/registerUser': new Set(['GET']),
    '/captchaImage': new Set(['GET']),
  };
  const allowed = legacy[strippedPath];
  return allowed ? allowed.has(upper) : false;
}

/**
 * C 端小程序等：未传 tenant-id 时回落超级租户（与产品约定一致）
 */
function isClientLoosePath(strippedPath: string, method: string): boolean {
  if (strippedPath === '/client' || strippedPath.startsWith('/client/')) {
    return true;
  }
  if (strippedPath === '/lbs/region' || strippedPath.startsWith('/lbs/region/')) {
    return true;
  }
  if (strippedPath === '/store/distribution/commission/preview' && method.toUpperCase() === 'POST') {
    return true;
  }
  return false;
}

/**
 * 在未解析到 tenant-id 时，决定当前请求是否必须用头、或允许按 C 端/全局规则回落。
 */
export function resolveTenantPathPolicy(
  strippedPath: string,
  method: string,
  permWhitelist: RouteWhitelistItem[] | undefined,
  configExemptPrefixes?: readonly string[],
): TenantPathPolicyKind {
  if (matchesConfiguredExemptPrefix(strippedPath, configExemptPrefixes)) {
    return 'exempt';
  }
  if (matchesPermWhitelist(strippedPath, method, permWhitelist)) {
    return 'exempt';
  }
  if (isInfrastructureExemptPath(strippedPath)) {
    return 'exempt';
  }
  if (isLegacyMainPublicPath(strippedPath, method)) {
    return 'exempt';
  }
  if (isClientLoosePath(strippedPath, method)) {
    return 'client_default_super';
  }
  return 'strict_admin';
}
