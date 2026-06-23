import { expect, test } from '@playwright/test';

/**
 * 门店订单路由 E2E 冒烟测试（需登录）
 * 对齐参考：docs/design/order-frontend-backend-alignment.md（原 apps/backend 需求文档已按治理移除）
 * 覆盖：订单列表、履约派单、订单详情，以及订单待派单历史路径兼容跳转
 *
 * 使用 setup 项目预置的认证状态，验证登录后可访问各路由
 */
const ROUTES = ['/store/order/list', '/store/fulfillment/service-dispatch', '/store/order/detail'];

test.describe('Store Order routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  test('/store/order/dispatch 登录后跳转到履约派单', async ({ page }) => {
    await page.goto('/store/order/dispatch');
    await expect(page).toHaveURL(/\/store\/fulfillment\/service-dispatch/);
    await expect(page.locator('body')).toBeVisible();
  });
});
