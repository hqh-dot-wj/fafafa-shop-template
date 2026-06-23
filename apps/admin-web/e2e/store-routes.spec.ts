import { expect, test } from '@playwright/test';

/**
 * 门店模块路由 E2E 冒烟测试（需登录）
 * 覆盖：门店商品、库存、财务、分销配置，以及历史路径兼容跳转
 * 注：订单路由已在 order-routes.spec.ts 覆盖，分销路由已在 store-marketing-routes.spec.ts 覆盖
 */
const ROUTES = [
  '/store/product/list',
  '/store/product/market',
  '/store/stock',
  '/store/finance/dashboard',
  '/store/finance/commission',
  '/store/finance/ledger',
  '/store/finance/withdrawal',
  '/store/distribution/distribution',
];

const LEGACY_REDIRECTS = [
  { from: '/store/product-market', to: /\/store\/product\/market/ },
  { from: '/store/finance/distribution-config', to: /\/store\/distribution\/distribution/ },
];

test.describe('Store routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }

  for (const item of LEGACY_REDIRECTS) {
    test(`${item.from} 兼容跳转到新运营菜单路径`, async ({ page }) => {
      await page.goto(item.from);
      await expect(page).toHaveURL(item.to);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
