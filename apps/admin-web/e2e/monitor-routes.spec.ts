import { expect, test } from '@playwright/test';

/**
 * 系统监控路由 E2E 冒烟测试（需登录）
 * 覆盖：在线用户、操作日志、登录日志、定时任务、任务日志、服务监控、缓存监控
 */
const ROUTES = [
  '/monitor/online',
  '/monitor/operlog',
  '/monitor/logininfor',
  '/monitor/job',
  '/monitor/job-log',
  '/monitor/server',
  '/monitor/cache',
];

test.describe('Monitor routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
