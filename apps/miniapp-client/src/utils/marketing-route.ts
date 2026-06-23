import { parseMarketingRoutePath } from '@libs/common-constants';

// 营销配置下发的跳转路径先经过 common-constants 白名单解析，避免场景/活动配置直接驱动任意小程序路由。
const TABBAR_PATHS = new Set(['/pages/index/index', '/pages/category/category', '/pages/cart/cart', '/pages/me/me']);

function safeTrim(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeInternalPath(path: string): string | undefined {
  const trimmed = safeTrim(path);
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/pages/')) return trimmed;
  if (trimmed.startsWith('pages/')) return `/${trimmed}`;
  return undefined;
}

export function navigateByMarketingRoute(path: string): boolean {
  const rawPath = safeTrim(path);
  if (!rawPath) return false;

  const internalPath = normalizeInternalPath(rawPath);
  if (internalPath) {
    const parsed = parseMarketingRoutePath(internalPath);
    if (!parsed.valid || !parsed.normalizedPath) {
      uni.showToast({ title: parsed.reason || '跳转路径无效', icon: 'none' });
      return false;
    }
    const [routeOnly = ''] = parsed.normalizedPath.split('?');
    if (TABBAR_PATHS.has(routeOnly)) {
      uni.switchTab({ url: routeOnly });
      return true;
    }
    uni.navigateTo({ url: parsed.normalizedPath });
    return true;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    // #ifdef H5
    window.location.href = rawPath;
    return true;
    // #endif
    // #ifndef H5
    uni.showToast({ title: '暂不支持外链跳转', icon: 'none' });
    return false;
    // #endif
  }

  uni.showToast({ title: '跳转路径无效', icon: 'none' });
  return false;
}
