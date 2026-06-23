import { expect, test } from '@playwright/test';

/**
 * 会员模块路由 E2E 冒烟测试（需登录）
 * 覆盖：会员列表、会员升级
 */
const ROUTES = ['/member/list', '/member/upgrade'];

test.describe('Member routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
