import { LOGIN_PAGE } from '@/router/config';

interface ToLoginPageOptions {
  /**
   * 跳转模式, uni.navigateTo | uni.reLaunch
   * @default 'navigateTo'
   */
  mode?: 'navigateTo' | 'reLaunch';
  /**
   * 查询参数
   * @example '?redirect=/pages/home/index'
   */
  queryString?: string;
}

interface CurrentPageLike {
  route?: string;
  options?: Record<string, unknown>;
  $page?: {
    fullPath?: string;
    options?: Record<string, unknown>;
  };
}

function getSafeLastPage(): CurrentPageLike | undefined {
  if (typeof getCurrentPages !== 'function') return undefined;
  const pages = getCurrentPages();
  return pages[pages.length - 1] as CurrentPageLike | undefined;
}

function normalizeRoutePath(route: string): string {
  return route.startsWith('/') ? route : `/${route}`;
}

function stringifyPageOptions(options: Record<string, unknown> | undefined): string {
  if (!options) return '';
  return Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export function getCurrentPageFullPath(): string {
  const currentPage = getSafeLastPage();
  const fullPath = currentPage?.$page?.fullPath;
  if (fullPath) return normalizeRoutePath(fullPath);

  const route = currentPage?.route;
  if (!route) return '';

  const query = stringifyPageOptions(currentPage?.options ?? currentPage?.$page?.options);
  const path = normalizeRoutePath(route);
  return query ? `${path}?${query}` : path;
}

export function buildLoginRedirectQueryString(redirectPath = getCurrentPageFullPath()): string {
  if (!redirectPath) return '';
  const path = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
  const routeOnly = path.split('?')[0];
  if (routeOnly === LOGIN_PAGE) return '';
  return `?redirect=${encodeURIComponent(path)}`;
}

/** 内联简易 debounce，避免小程序 require('./debounce.js') 解析失败 */
function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): T & { flush: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  const flush = () => {
    if (lastArgs !== null) {
      fn(...lastArgs);
      lastArgs = null;
    }
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };
  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, ms);
  };
  debounced.flush = flush;
  debounced.cancel = cancel;
  return debounced as T & { flush: () => void; cancel: () => void };
}

/**
 * 跳转到登录页, 带防抖处理
 *
 * 如果要立即跳转，不做延时，可以使用 `toLoginPage.flush()` 方法
 */
export const toLoginPage = debounce((options: ToLoginPageOptions = {}) => {
  const { mode = 'navigateTo', queryString = '' } = options;

  const url = `${LOGIN_PAGE}${queryString}`;

  // 获取当前页面路径
  const currentPath = getCurrentPageFullPath().split('?')[0];
  // 如果已经在登录页，则不跳转
  if (currentPath === LOGIN_PAGE) {
    return;
  }

  if (mode === 'navigateTo') {
    uni.navigateTo({ url });
  } else {
    uni.reLaunch({ url });
  }
}, 500);
