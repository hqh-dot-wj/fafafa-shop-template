import { expect, test } from '@playwright/test';

/**
 * 系统工具路由 E2E 冒烟测试（需登录）
 * 覆盖：表单构建、代码生成、接口文档
 */
const ROUTES = ['/tool/build', '/tool/gen', '/tool/swagger'];

test.describe('Tool routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
