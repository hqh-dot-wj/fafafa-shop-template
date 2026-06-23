import { expect, test } from '@playwright/test';

const ROUTES = [
  '/marketing/ai-platform-prompt',
  '/marketing/template',
  '/marketing/asset',
  '/marketing/points/accounts',
  '/marketing/points/rules',
  '/marketing/points/tasks',
  '/marketing/points/statistics',
  '/marketing/coupon/template',
  '/marketing/coupon/distribution',
  '/marketing/coupon/usage',
  '/marketing/coupon/statistics',
  '/marketing/course-group/team',
  '/marketing/course-group/failure',
  '/marketing/course-group/commission'
];

test.describe('Marketing routes (authenticated)', () => {
  for (const routePath of ROUTES) {
    test(`${routePath} can be visited after login`, async ({ page }) => {
      await page.goto(routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).toBeVisible();
    });
  }
});
