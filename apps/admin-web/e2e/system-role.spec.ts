import { expect, test } from '@playwright/test';
import {
  clearNotificationOverlay,
  expandSearchPanelIfCollapsed,
  expectMinLocatorCount,
  gotoAuthedListPage,
  tableDataRows,
} from './helpers/assertions';

/**
 * 角色管理 E2E 冒烟测试
 * 验证：列表有数据、新增表单校验、编辑已有角色、搜索过滤
 */
test.describe('角色管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/role');
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 15_000 });
    await expandSearchPanelIfCollapsed(page);
    await clearNotificationOverlay(page);
  });

  test('列表加载：表格有数据且不显示空状态', async ({ page }) => {
    await expect(page.locator('.n-data-table-empty')).not.toBeVisible();
    // 超级管理员角色必然存在
    await expect(
      page
        .locator('.n-data-table')
        .getByText(/超级管理员|admin/i)
        .first(),
    ).toBeVisible();
  });

  test('新增角色：抽屉可打开，必填校验生效', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByText(/新增角色/)).toBeVisible();

    // 直接提交触发校验
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('新增角色：填写完整信息并提交成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await expect(drawer.locator('.n-tree').first()).toBeVisible({ timeout: 8000 });

    const ts = Date.now();
    await drawer.getByPlaceholder(/角色名称/).fill(`测试角色${ts}`);
    await drawer.getByPlaceholder(/权限字符/).fill(`test_role_${ts}`);

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();

    await expect(page.getByText(/新增成功|添加成功/i)).toBeVisible({ timeout: 8000 });
  });

  test('编辑角色：点击编辑按钮可打开抽屉并回填数据', async ({ page }) => {
    // 找第一个非超管角色的编辑按钮（超管行没有操作按钮）
    const editBtn = tableDataRows(page).nth(1).getByRole('button').first();
    await editBtn.click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByText(/编辑角色/)).toBeVisible();

    // 角色名称应该已回填（不为空）
    const roleNameInput = drawer.getByPlaceholder(/角色名称/);
    await expect(roleNameInput).not.toHaveValue('');
  });

  test('搜索：按角色名称搜索可过滤结果', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .first()
      .locator('.n-form-item')
      .filter({ hasText: /角色名称|Role name/i })
      .locator('input')
      .first();
    await searchInput.fill('管理');
    await page.getByRole('button', { name: /搜索|Search/ }).click();

    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  });
});
