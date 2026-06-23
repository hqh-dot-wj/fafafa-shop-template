import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isRouteChunkLoadError,
  recoverRouteChunkLoadError,
  resetDevChunkRecoveryCounter,
  shouldHardReloadBrowserInDev,
} from './chunk-error-recovery';

describe('chunk-error-recovery', () => {
  beforeEach(() => {
    resetDevChunkRecoveryCounter();
  });

  it('should recognize dynamic route chunk load errors', () => {
    expect(isRouteChunkLoadError(new Error('Failed to fetch dynamically imported module: /src/views/demo.vue'))).toBe(
      true,
    );
    expect(isRouteChunkLoadError(new Error('Unable to preload CSS for /assets/demo.css'))).toBe(true);
    expect(isRouteChunkLoadError(new Error('业务接口请求失败'))).toBe(false);
  });

  it('should reload browser even when content remount fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadContent = vi.fn().mockRejectedValue(new Error('reload content failed'));
    const reloadBrowser = vi.fn();
    const showMessage = vi.fn();

    await recoverRouteChunkLoadError({
      reloadBrowser,
      reloadContent,
      showMessage,
    });

    expect(showMessage).toHaveBeenCalledWith('页面脚本加载失败，正在刷新页面');
    expect(reloadContent).toHaveBeenCalledTimes(1);
    expect(reloadBrowser).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('should soft-retry without browser reload when hardReloadBrowser is false', async () => {
    const reloadContent = vi.fn().mockResolvedValue(undefined);
    const reloadBrowser = vi.fn();
    const retryNavigation = vi.fn().mockResolvedValue(undefined);
    const showMessage = vi.fn();

    await recoverRouteChunkLoadError({
      hardReloadBrowser: false,
      reloadBrowser,
      reloadContent,
      retryNavigation,
      showMessage,
    });

    expect(showMessage).toHaveBeenCalledWith('页面模块加载中断，正在重试…');
    expect(reloadContent).toHaveBeenCalledTimes(1);
    expect(retryNavigation).toHaveBeenCalledTimes(1);
    expect(reloadBrowser).not.toHaveBeenCalled();
  });

  it('should escalate to hard reload in dev only after repeated failures', () => {
    const base = 1_700_000_000_000;
    expect(shouldHardReloadBrowserInDev(base)).toBe(false);
    expect(shouldHardReloadBrowserInDev(base + 100)).toBe(true);
    resetDevChunkRecoveryCounter();
    expect(shouldHardReloadBrowserInDev(base + 20_000)).toBe(false);
  });
});
