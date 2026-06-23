import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/** 去掉全局通知容器，避免遮挡后续点击（如 SSE「连接成功」反复弹出） */
export async function clearNotificationOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll('.n-notification-container').forEach((el) => el.remove());
  });
}

/** 列表页「搜索」区在 NCollapse 内时默认折叠，先展开再操作筛选项 */
export async function expandSearchPanelIfCollapsed(page: Page): Promise<void> {
  const header = page.locator('.n-collapse-item__header').filter({ hasText: /搜索|Search/i });
  if (!(await header.isVisible({ timeout: 5000 }).catch(() => false))) return;
  const item = page.locator('.n-collapse-item').filter({ has: header });
  const expanded =
    (await item.evaluate((el) => el.classList.contains('n-collapse-item--active')).catch(() => false)) ||
    (await header.getAttribute('aria-expanded')) === 'true';
  if (!expanded) {
    await header.click();
    await expect
      .poll(
        async () =>
          (await item.evaluate((el) => el.classList.contains('n-collapse-item--active')).catch(() => false)) ||
          (await header.getAttribute('aria-expanded')) === 'true',
        { timeout: 3000 },
      )
      .toBe(true);
  }
}

/**
 * Playwright 的 `toHaveCount` 只接受精确数字，用轮询实现「不少于 min 个」。
 */
export async function expectMinLocatorCount(
  locator: Locator,
  min: number,
  options?: { timeout?: number },
): Promise<void> {
  await expect
    .poll(async () => locator.count(), {
      timeout: options?.timeout ?? 10_000,
    })
    .toBeGreaterThanOrEqual(min);
}

/** Naive UI 表格数据行：在 tbody 内，避免点到表头行 */
export function tableDataRows(page: Page): Locator {
  return page.locator('.n-data-table tbody tr');
}

/**
 * 动态路由模式下，冷启动直接 deep link 可能先于 getRouters 注册子路由而落到 404。
 * 先进入首页并等待 getRouters 响应，再跳转目标路径（不用 networkidle，避免 SSE 等长连接永不空闲）。
 */
export async function gotoWhenDynamicRoutesReady(page: Page, path: string): Promise<void> {
  const routersDone = page
    .waitForResponse((res) => res.url().includes('getRouters') && res.ok(), { timeout: 25_000 })
    .catch(() => undefined);

  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  await routersDone;
  await expect(page.locator('body')).toBeVisible();

  await expect(page).not.toHaveURL(/\/login/);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
}

/**
 * 后台列表页：先 hydrate 动态路由，再校验非登录/403，并等待表格挂载（高并发下默认 35s）。
 */
export async function gotoAuthedListPage(page: Page, path: string, options?: { tableTimeout?: number }): Promise<void> {
  await gotoWhenDynamicRoutesReady(page, path);
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).not.toHaveURL(/\/403/);
  await expect(page.locator('.n-data-table').first()).toBeVisible({
    timeout: options?.tableTimeout ?? 35_000,
  });
}
