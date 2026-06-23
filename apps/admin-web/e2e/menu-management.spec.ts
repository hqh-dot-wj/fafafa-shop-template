import { expect, test } from '@playwright/test';
import { gotoWhenDynamicRoutesReady } from './helpers/assertions';

/**
 * 菜单管理 E2E 操作测试
 * 测试：新增目录、新增子菜单（使用独立 E2E 路径，避免与真实「门店分销」路由混淆）
 *
 * 使用 admin/admin123 账号，需具备 system:menu:add 权限
 */

const E2E_MENU_FIXTURE = [
  { menuName: 'E2E菜单测试根', path: 'e2e-menu-root', component: '', isDir: true },
  {
    menuName: 'E2E子菜单页',
    path: 'e2e-menu-root/child-page',
    component: 'home/index',
    isDir: false,
  },
];

test.describe('菜单管理 - 页面操作', () => {
  test.setTimeout(60000);
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/system/menu');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    await page.waitForSelector('.menu-tree, .n-tree', { timeout: 10000 });
  });

  test('新增一级菜单（目录）', async ({ page }) => {
    const { menuName, path } = E2E_MENU_FIXTURE[0];

    const addBtn = page
      .locator('.n-card')
      .filter({ hasText: /菜单列表|主类目|根目录/ })
      .locator('button')
      .first();
    await addBtn.click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const form = page.locator('.n-drawer');
    await form
      .getByPlaceholder(/请输入菜单名称|Please enter/)
      .first()
      .fill(menuName);
    await form
      .getByPlaceholder(/请输入路由地址|Please enter/)
      .first()
      .fill(path);

    await page.getByRole('button', { name: /保存|Save/ }).click();

    await expect(page.getByText(/添加成功|新增成功|Add Success/)).toBeVisible({ timeout: 5000 });
  });

  test('新增子菜单（菜单类型）', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/请输入菜单名称|请输入/);
    await searchInput.fill('E2E菜单测试');

    const treeNode = page
      .locator('.n-tree, .menu-tree')
      .getByText(/E2E菜单测试根/)
      .first();
    await expect(treeNode).toBeVisible({ timeout: 10_000 });
    await treeNode.click({ timeout: 10000 });

    const addChildButton = page.getByRole('button', { name: /新增子菜单|Add Child Menu/ });
    await expect(addChildButton).toBeVisible({ timeout: 5000 });
    await addChildButton.click();

    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const item = E2E_MENU_FIXTURE[1];
    const form = page.locator('.n-drawer');
    await form
      .getByPlaceholder(/请输入菜单名称|Please enter/)
      .first()
      .fill(item.menuName);
    await form
      .getByPlaceholder(/请输入路由地址|Please enter/)
      .first()
      .fill(item.path);

    const componentInput = form.locator('.n-input-group:has-text("views/")').locator('input');
    await expect(componentInput).toBeVisible({ timeout: 3000 });
    await componentInput.fill(item.component);

    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.getByText(/新增成功|添加成功|Add success/)).toBeVisible({ timeout: 5000 });
  });
});
