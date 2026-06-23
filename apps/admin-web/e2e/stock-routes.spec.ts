import { expect, test } from '@playwright/test';

/**
 * 门店库存路由 E2E 冒烟测试（需登录）
 * 对齐参考：docs/design/stock-frontend-backend-alignment.md（原 apps/backend 需求文档已按治理移除）
 * 覆盖：库存管理
 *
 * 使用 setup 项目预置的认证状态，验证登录后可访问各路由
 */
const ROUTES = ['/store/stock'];

test.describe('Store Stock routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
