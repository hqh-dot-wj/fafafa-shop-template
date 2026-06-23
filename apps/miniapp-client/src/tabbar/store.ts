import type { CustomTabBarItem, CustomTabBarItemBadge } from './types';
import { reactive } from 'vue';

import { customTabbarList, nativeTabbarList, selectedTabbarStrategy, TABBAR_STRATEGY_MAP } from './config';

/**
 * 与 tabbarList 中 pagePath 对齐（小程序 + H5 共用）
 * - 小程序：多为 `/pages/...` 或 `pages/...`（route / switchTab）
 * - H5：可能出现 `#/pages/...`（hash）；部署子路径时 fullPath 可能带 Vite `base` 前缀
 */
function normalizeRoutePath(path: string): string {
  const [pathWithoutQuery = ''] = path.split('?');
  let raw = pathWithoutQuery.trim();
  if (raw.startsWith('#')) {
    raw = raw.slice(1);
  }
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && raw.startsWith(base)) {
    raw = raw.slice(base.length);
    if (!raw.startsWith('/')) {
      raw = `/${raw}`;
    }
  }
  if (!raw || raw === '/') {
    return raw === '/' ? '/' : '';
  }
  if (raw.startsWith('/')) {
    return raw;
  }
  if (raw.startsWith('pages/')) {
    return `/${raw}`;
  }
  return raw;
}

/** tabbarList 里面的 path 从 pages.config.ts 得到 */
const tabbarList = reactive<CustomTabBarItem[]>(customTabbarList.map((item) => ({ ...item })));

function getConfiguredTabbarItems() {
  if (selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NATIVE_TABBAR) {
    return nativeTabbarList;
  }
  if (selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR) {
    return tabbarList;
  }
  return [];
}

function findConfiguredTabbarIndex(path: string) {
  return getConfiguredTabbarItems().findIndex((item) => normalizeRoutePath(item.pagePath) === path);
}

export function isPageTabbar(path: string) {
  if (selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NO_TABBAR) {
    return false;
  }
  const _path = normalizeRoutePath(path);
  return findConfiguredTabbarIndex(_path) !== -1;
}

/**
 * 自定义 tabbar 的状态管理，原生 tabbar 无需关注本文件
 * tabbar 状态，增加 storageSync 保证刷新浏览器时在正确的 tabbar 页面
 * 使用reactive简单状态，而不是 pinia 全局状态
 */
const tabbarStore = reactive({
  curIdx: Number(uni.getStorageSync('app-tabbar-index')) || 0,
  prevIdx: Number(uni.getStorageSync('app-tabbar-index')) || 0,
  setCurIdx(idx: number) {
    this.curIdx = idx;
    uni.setStorageSync('app-tabbar-index', idx);
  },
  setTabbarItemBadge(idx: number, badge: CustomTabBarItemBadge) {
    if (tabbarList[idx]) {
      tabbarList[idx].badge = badge;
    }
  },
  setAutoCurIdx(path: string) {
    const normalized = normalizeRoutePath(path);
    // '/' 当做首页
    if (normalized === '/') {
      this.setCurIdx(0);
      return;
    }
    const index = findConfiguredTabbarIndex(normalized);
    if (index !== -1) {
      this.setCurIdx(index);
      return;
    }
    // 目标 path 与配置不一致时，用页面栈自顶向下找第一个 tab 页，避免 curIdx 卡在旧值（常见：首页仍高亮）
    const pagesPathList = getCurrentPages().map((item) => {
      const route = item.route ?? '';
      const r = route.startsWith('/') ? route : `/${route}`;
      return normalizeRoutePath(r);
    });
    for (let i = pagesPathList.length - 1; i >= 0; i--) {
      const stackPath = pagesPathList[i];
      if (!stackPath) continue;
      const stackIdx = findConfiguredTabbarIndex(stackPath);
      if (stackIdx !== -1) {
        this.setCurIdx(stackIdx);
        return;
      }
    }
    this.setCurIdx(0);
  },
  restorePrevIdx() {
    if (this.prevIdx === this.curIdx) return;
    this.setCurIdx(this.prevIdx);
    this.prevIdx = Number(uni.getStorageSync('app-tabbar-index')) || 0;
  },
});

export { tabbarList, tabbarStore };
