import type { Router } from 'vue-router';

/** Vite 开发态动态导入失败、生产环境旧 chunk 404 等 */
export function isRouteChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Unable to preload CSS') ||
    /Loading chunk \d+ failed/i.test(msg)
  );
}

interface RecoverRouteChunkLoadErrorOptions {
  reloadContent: () => Promise<void>;
  /** 整页刷新；开发态仅在软重试仍失败时调用 */
  reloadBrowser: () => void;
  /** 开发态软重试：重新触发当前路由的懒加载 */
  retryNavigation?: () => Promise<void>;
  showMessage?: (message: string) => void;
  /** 为 false 时只做内容区 remount + 可选 retryNavigation，不整页刷新 */
  hardReloadBrowser?: boolean;
}

const DEV_CHUNK_RECOVERY_STORAGE_KEY = 'admin-web:chunk-recovery-dev';
const DEV_HARD_RELOAD_THRESHOLD = 2;
const DEV_HARD_RELOAD_WINDOW_MS = 12_000;

/** 开发态短时间内多次 chunk 失败才升级整页刷新，避免与 Vite dep 重优化叠加成刷新环 */
export function shouldHardReloadBrowserInDev(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(DEV_CHUNK_RECOVERY_STORAGE_KEY);
    const state: { count: number; at: number } = raw
      ? (JSON.parse(raw) as { count: number; at: number })
      : { count: 0, at: 0 };

    if (now - state.at > DEV_HARD_RELOAD_WINDOW_MS) {
      state.count = 0;
    }

    state.count += 1;
    state.at = now;
    sessionStorage.setItem(DEV_CHUNK_RECOVERY_STORAGE_KEY, JSON.stringify(state));

    return state.count >= DEV_HARD_RELOAD_THRESHOLD;
  } catch {
    return false;
  }
}

export function resetDevChunkRecoveryCounter() {
  try {
    sessionStorage.removeItem(DEV_CHUNK_RECOVERY_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
}

export async function recoverRouteChunkLoadError(options: RecoverRouteChunkLoadErrorOptions) {
  const hardReload = options.hardReloadBrowser ?? true;

  options.showMessage?.(hardReload ? '页面脚本加载失败，正在刷新页面' : '页面模块加载中断，正在重试…');

  try {
    await options.reloadContent();

    if (!hardReload) {
      await options.retryNavigation?.();
      return;
    }
  } catch (error) {
    console.error('[vue-router] content remount failed before browser reload', error);
  }

  options.reloadBrowser();
}

/** 避免同一轮失败触发多次恢复 */
let chunkErrorRecoveryLockUntil = 0;

/**
 * 动态路由 chunk 加载失败时，布局里 Transition(mode=out-in) 会先卸载旧页再等新页；
 * 新页永远挂不上则主区域一直空白，且后续 Tab 切换也常继续白屏。
 *
 * 生产：内容区 remount 后整页刷新以拉取最新模块图。
 * 开发：优先软重试（避免与 Vite「optimized dependencies changed」硬刷新叠加）；
 * 短时间连续失败再整页刷新。
 */
export function createChunkLoadErrorRecoveryGuard(router: Router) {
  router.onError((error) => {
    console.error('[vue-router]', error);

    if (!isRouteChunkLoadError(error)) return;

    const now = Date.now();
    if (now < chunkErrorRecoveryLockUntil) return;
    chunkErrorRecoveryLockUntil = now + 4000;

    const hardReloadBrowser = import.meta.env.PROD || shouldHardReloadBrowserInDev(now);

    recoverRouteChunkLoadError({
      hardReloadBrowser,
      reloadBrowser: () => window.location.reload(),
      reloadContent: async () => {
        const { useAppStore } = await import('@/store/modules/app');
        await useAppStore().reloadPage(80);
      },
      retryNavigation: async () => {
        const { fullPath, query, hash } = router.currentRoute.value;
        await router.replace({ path: fullPath, query, hash });
      },
      showMessage: window.$message?.warning ?? window.$message?.error,
    }).catch((err) => {
      console.error('[vue-router] chunk recovery failed', err);
    });
  });

  router.afterEach(() => {
    if (import.meta.env.DEV) {
      resetDevChunkRecoveryCounter();
    }
  });
}
