/**
 * 路由登录策略：黑名单（默认匿名可访问，列表内须登录），与 miniapp `DEFAULT_NO_NEED_LOGIN` 一致。
 */

export const LOGIN_PATH = '/login';

/** 须登录才可访问的路由前缀（Phase 3.1 壳；后续 Phase 按业务扩展）。 */
export const PROTECTED_ROUTE_PREFIXES = [
  '/cart',
  '/me',
  '/order',
  '/pay',
  '/address',
  '/coupon',
  '/distribution',
  '/wallet',
];

export function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === '/') return '/';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function isLoginRoute(path: string): boolean {
  return normalizeRoutePath(path) === LOGIN_PATH;
}

export function isProtectedRoute(path: string): boolean {
  const normalized = normalizeRoutePath(path);
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
