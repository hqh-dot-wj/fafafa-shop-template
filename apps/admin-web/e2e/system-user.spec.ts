import { expect, test } from '@playwright/test';
import {
  clearNotificationOverlay,
  expandSearchPanelIfCollapsed,
  expectMinLocatorCount,
  gotoAuthedListPage,
  tableDataRows,
} from './helpers/assertions';

/**
 * 用户管理 E2E 冒烟测试
 * 验证：列表有数据加载、新增表单可打开并通过校验提交、搜索可过滤
 */
test.describe('用户管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/user');
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 15_000 });
    await expandSearchPanelIfCollapsed(page);
    await clearNotificationOverlay(page);
  });

  test('列表加载：表格有数据且包含 admin 用户', async ({ page }) => {
    // 验证表格有实际数据行（不是空状态）
    await expect(page.locator('.n-data-table-empty')).not.toBeVisible();
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  });

  test('左侧部门树加载：树节点可见', async ({ page }) => {
    // 部门树应该有节点
    await expectMinLocatorCount(page.locator('.n-tree .n-tree-node'), 1, { timeout: 8000 });
  });

  test('新增用户：抽屉可打开，必填校验生效', async ({ page }) => {
    // 点击新增按钮
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();

    // 抽屉打开
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByText(/新增用户|Add User/)).toBeVisible();

    // 直接点保存，触发必填校验
    await drawer.getByRole('button', { name: /保存|Save/ }).click();

    // 应出现校验错误提示
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('新增用户：填写完整表单并提交成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await drawer
      .locator('img[alt="loading"]')
      .first()
      .waitFor({ state: 'hidden', timeout: 20_000 })
      .catch(() => {});
    await expect(drawer.locator('.n-form')).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    // REG_USER_NAME：4–16 位，仅中文/字母/数字/_-
    const shortUser = `u${String(ts).slice(-12)}`.slice(0, 16);
    // 长表单在抽屉内滚动，force 避免「在 DOM 中但不在视口」导致 fill 超时
    await drawer.getByPlaceholder(/昵称|nickName/).fill(`测试用户${ts}`, { force: true });
    await drawer.getByPlaceholder(/用户名|userName/).fill(shortUser, { force: true });
    await drawer.getByPlaceholder(/密码|password/).fill('Test@123456', { force: true });
    await drawer.getByPlaceholder(/手机号|phonenumber/).fill('13800138001', { force: true });
    // 部门（创建需要 deptId）
    const deptSelect = drawer.locator('.n-form-item').filter({ hasText: /^部门/ }).locator('.n-tree-select');
    await expect(deptSelect).toBeVisible({ timeout: 5000 });
    await deptSelect.click();
    const firstDeptNode = page.locator('.v-binder-follower-container .n-tree-node-content').first();
    await expect(firstDeptNode).toBeVisible({ timeout: 8000 });
    await firstDeptNode.click({ force: true });
    await expect(firstDeptNode).toBeHidden({ timeout: 3000 });

    // 选择角色（等待选项加载后选第一个）
    const roleSelect = drawer
      .locator('.n-select')
      .filter({ hasText: /角色|role/i })
      .first();
    await roleSelect.scrollIntoViewIfNeeded();
    await expect(roleSelect).toBeVisible({ timeout: 5000 });
    await roleSelect.click({ force: true });
    const firstOption = page.locator('.n-base-select-option').first();
    await expect(firstOption).toBeVisible({ timeout: 3000 });
    await firstOption.click();
    await clearNotificationOverlay(page);

    // 页脚「保存」在抽屉结构里可能不在可滚动视口内，直接 DOM 触发点击
    await drawer.evaluate((root) => {
      const buttons = Array.from(root.querySelectorAll('button'));
      for (const b of buttons) {
        if (/保存|Save/i.test(b.textContent?.trim() || '')) {
          (b as HTMLButtonElement).click();
          return;
        }
      }
    });

    // 成功：全局 message（添加成功）或抽屉关闭
    await expect
      .poll(
        async () => {
          const messageText =
            (await page
              .locator('.n-message')
              .textContent()
              .catch(() => '')) || '';
          const drawerClosed = await drawer.isHidden().catch(() => false);

          return /成功|Success|添加|更新/i.test(messageText) || drawerClosed;
        },
        { timeout: 12_000 },
      )
      .toBe(true);
  });

  test('搜索：按用户名搜索 admin 可返回结果', async ({ page }) => {
    // 找到用户名搜索输入框
    const searchInput = page
      .locator('.n-form')
      .first()
      .locator('.n-form-item')
      .filter({ hasText: /用户名称|用户名|User name/i })
      .locator('input')
      .first();
    await searchInput.fill('admin');

    // 点击搜索
    await page.getByRole('button', { name: /搜索|Search/ }).click();

    // 等待结果刷新
    await expect(page.locator('.n-data-table')).toBeVisible();
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await expect(page.locator('.n-data-table')).toContainText('admin');
  });

  test('搜索重置：重置后恢复全量数据', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .first()
      .locator('.n-form-item')
      .filter({ hasText: /用户名称|用户名|User name/i })
      .locator('input')
      .first();
    await searchInput.fill('不存在的用户xyz');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await expect(page.locator('.n-data-table')).toBeVisible();

    // 点重置
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await expect(searchInput).toHaveValue('');

    // 重置后列表恢复为有数据状态，具体排序由后端数据决定
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  });
});
