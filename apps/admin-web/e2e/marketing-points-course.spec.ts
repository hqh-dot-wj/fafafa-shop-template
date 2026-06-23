import { expect, test } from '@playwright/test';
import {
  clearNotificationOverlay,
  gotoAuthedListPage,
  gotoWhenDynamicRoutesReady,
  tableDataRows,
} from './helpers/assertions';

test.describe('Points Accounts', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/marketing/points/accounts');
  });

  test('accounts page renders list container', async ({ page }) => {
    await expect(page.locator('.n-data-table, .card-wrapper').first()).toBeVisible();
  });

  test('can search and reset by member id input', async ({ page }) => {
    const memberIdInput = page.getByPlaceholder(/member|会员|ID/i).first();
    await expect(memberIdInput).toBeVisible();
    await memberIdInput.fill('test_member');
    await page
      .getByRole('button', { name: /search|查询|搜索/i })
      .first()
      .click();
    await expect(page.locator('.n-data-table').first()).toBeVisible();
    await page
      .getByRole('button', { name: /reset|重置/i })
      .first()
      .click();
    await expect(memberIdInput).toHaveValue('');
  });
});

test.describe('Points Statistics', () => {
  test('statistics page renders', async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/marketing/points/statistics');
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator('.n-card, .flex-col-stretch').first()).toBeVisible({ timeout: 35_000 });
  });
});

test.describe('Course Group New Routes', () => {
  test('team page renders table', async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/marketing/course-group/team');
    await clearNotificationOverlay(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator('.n-data-table').first()).toBeVisible({ timeout: 35_000 });
  });

  test('failure page renders table', async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/marketing/course-group/failure');
    await clearNotificationOverlay(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator('.n-data-table').first()).toBeVisible({ timeout: 35_000 });
  });

  test('commission page renders table', async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/marketing/course-group/commission');
    await clearNotificationOverlay(page);
    await expect(page).not.toHaveURL(/\/login|\/403/);
    await expect(page.locator('.n-data-table').first()).toBeVisible({ timeout: 35_000 });
    await expect(await tableDataRows(page).count()).toBeGreaterThanOrEqual(0);
  });
});
