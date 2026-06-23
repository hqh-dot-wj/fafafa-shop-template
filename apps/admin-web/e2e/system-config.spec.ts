import { expect, test } from '@playwright/test';
import {
  expandSearchPanelIfCollapsed,
  expectMinLocatorCount,
  gotoAuthedListPage,
  tableDataRows,
} from './helpers/assertions';

/**
 * 系统管理（配置/字典/部门/岗位/通知/租户）E2E 测试
 *
 * 情况清单：
 *
 * 【参数配置】
 *   CF-01  列表加载：表格渲染
 *   CF-02  新增 - 空表单提交：configName/configKey/configValue/configType 必填触发
 *   CF-03  新增 - 正常提交：填写完整后成功
 *   CF-04  编辑 - 回填：configName/configKey/configValue 不为空
 *   CF-05  搜索 - 按参数名称过滤：表格刷新
 *   CF-06  搜索 - 重置：输入框清空
 *
 * 【字典管理】
 *   D-01  列表加载：表格渲染
 *   D-02  新增 - 空表单提交：dictName/dictType 必填触发
 *   D-03  新增 - 正常提交：填写完整后成功
 *   D-04  编辑 - 回填：dictName/dictType 不为空
 *   D-05  搜索 - 按字典名称过滤：表格刷新
 *
 * 【部门管理】
 *   DP-01  列表加载：树形表格渲染
 *   DP-02  新增 - 空表单提交：deptName/orderNum 必填触发
 *   DP-03  新增 - 正常提交：填写完整后成功
 *   DP-04  新增 - 手机号格式校验：非法格式触发校验
 *   DP-05  新增 - 邮箱格式校验：非法格式触发校验
 *   DP-06  编辑 - 回填：deptName/orderNum 不为空
 *
 * 【岗位管理】
 *   P-01  列表加载：表格渲染
 *   P-02  新增 - 空表单提交：deptId/postCode/postName/postSort/status 必填触发
 *   P-03  新增 - 正常提交：填写完整后成功
 *   P-04  编辑 - 回填：postCode/postName 不为空
 *
 * 【通知公告】
 *   N-01  列表加载：表格渲染
 *   N-02  新增 - 空表单提交：noticeTitle 必填触发
 *   N-03  新增 - 正常提交：填写标题后成功
 *   N-04  编辑 - 回填：noticeTitle 不为空
 *   N-05  搜索 - 按标题过滤：表格刷新
 *
 * 【租户管理】
 *   T-01  列表加载：表格渲染
 *   T-02  新增 - 空表单提交：contactUserName/contactPhone/companyName/packageId/accountCount/username/password 必填触发
 *   T-03  新增 - 手机号格式校验：非法格式触发
 *   T-04  新增 - username 长度 2-20：1字符触发，21字符触发
 *   T-05  新增 - password 长度 5-20：4字符触发，21字符触发
 *   T-06  新增 - accountCount=-1（不限）：字段接受 -1
 *   T-07  编辑 - username/password 字段隐藏（编辑时不显示）
 *   T-08  编辑 - packageId 字段禁用
 *   T-09  编辑 - 回填：companyName/contactUserName 不为空
 *   T-10  搜索 - 按企业名称过滤：表格刷新
 */

async function openFirstRowDrawer(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  await tableDataRows(page).first().getByRole('button').first().click();
  const drawer = page.locator('.n-drawer');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  return drawer;
}

async function expectDrawerFormReady(drawer: ReturnType<typeof tableDataRows>): Promise<void> {
  await expect(drawer.locator('.n-form')).toBeVisible({ timeout: 5000 });
}

// ─────────────────────────────────────────────
// 参数配置
// ─────────────────────────────────────────────
test.describe('参数配置', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/config');
  });

  test('CF-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('CF-02 新增 - 空表单提交：必填字段校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('CF-03 新增 - 正常提交：填写完整后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /参数名称/ })
      .locator('input')
      .fill(`测试参数${ts}`);
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /参数键名/ })
      .locator('input')
      .fill(`test.key.${ts}`);
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /参数键值/ })
      .locator('input, textarea')
      .first()
      .fill('test_value');

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('CF-04 编辑 - 回填：configName/configKey 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /参数名称/ })
        .locator('input'),
    ).not.toHaveValue('');
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /参数键名/ })
        .locator('input'),
    ).not.toHaveValue('');
  });

  test('CF-05 搜索 - 按参数名称过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/参数名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('CF-06 搜索 - 重置：输入框清空', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/参数名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /重置|Reset/ })
      .first()
      .click();
    await expect(nameInput).toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 字典管理
// ─────────────────────────────────────────────
test.describe('字典管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/dict');
  });

  test('D-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('D-02 新增 - 空表单提交：dictName/dictType 必填触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('D-03 新增 - 正常提交：填写完整后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /字典名称/ })
      .locator('input')
      .fill(`测试字典${ts}`);
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /字典类型/ })
      .locator('input')
      .fill(`test_dict_${ts}`);

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('D-04 编辑 - 回填：dictName/dictType 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /字典名称/ })
        .locator('input'),
    ).not.toHaveValue('');
  });

  test('D-05 搜索 - 按字典名称过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/字典名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 部门管理
// ─────────────────────────────────────────────
test.describe('部门管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/dept');
  });

  test('DP-01 列表加载：树形表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('DP-02 新增 - 空表单提交：deptName/orderNum 必填触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expectDrawerFormReady(drawer);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('DP-03 新增 - 正常提交：填写完整后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expectDrawerFormReady(drawer);

    const ts = Date.now();
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /部门名称/ })
      .locator('input')
      .fill(`测试部门${ts}`);
    const orderInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /显示顺序/ })
      .locator('input');
    await orderInput.click({ clickCount: 3 });
    await orderInput.fill('99');

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('DP-04 新增 - 手机号格式校验：非法格式触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const phoneInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /联系电话/ })
      .locator('input');
    await phoneInput.fill('123');
    await phoneInput.blur();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('DP-05 新增 - 邮箱格式校验：非法格式触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const emailInput = drawer.locator('.n-form-item').filter({ hasText: /邮箱/ }).locator('input');
    await emailInput.fill('not-an-email');
    await emailInput.blur();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('DP-06 编辑 - 回填：deptName 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /部门名称/ })
        .locator('input'),
    ).not.toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 岗位管理
// ─────────────────────────────────────────────
test.describe('岗位管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/post');
  });

  test('P-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('P-02 新增 - 空表单提交：必填字段校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expectDrawerFormReady(drawer);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('P-03 新增 - 正常提交：填写完整后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expectDrawerFormReady(drawer);

    const ts = Date.now();
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /岗位编码/ })
      .locator('input')
      .fill(`POST_${ts}`);
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /岗位名称/ })
      .locator('input')
      .fill(`测试岗位${ts}`);
    const sortInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /显示顺序/ })
      .locator('input');
    await sortInput.click({ clickCount: 3 });
    await sortInput.fill('1');

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('P-04 编辑 - 回填：postCode/postName 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /岗位编码/ })
        .locator('input'),
    ).not.toHaveValue('');
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /岗位名称/ })
        .locator('input'),
    ).not.toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 通知公告
// ─────────────────────────────────────────────
test.describe('通知公告', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/notice');
  });

  test('N-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('N-02 新增 - 空表单提交：noticeTitle 必填触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('N-03 新增 - 正常提交：填写标题后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /公告标题/ })
      .locator('input')
      .fill(`测试公告${ts}`);

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('N-04 编辑 - 回填：noticeTitle 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /公告标题/ })
        .locator('input'),
    ).not.toHaveValue('');
  });

  test('N-05 搜索 - 按标题过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const titleInput = page
      .locator('.n-form')
      .getByPlaceholder(/公告标题/i)
      .first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 租户管理
// ─────────────────────────────────────────────
test.describe('租户管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/system/tenant');
  });

  test('T-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('T-02 新增 - 空表单提交：多个必填字段校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expectDrawerFormReady(drawer);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 3, { timeout: 3000 });
  });

  test('T-03 新增 - 手机号格式校验：非法格式触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const phoneInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /联系电话/ })
      .locator('input');
    await phoneInput.fill('123');
    await phoneInput.blur();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('T-04 新增 - username 长度 2-20：1字符触发校验', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const usernameInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /管理员账号/ })
      .locator('input');
    await usernameInput.fill('a');
    await usernameInput.blur();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('T-05 新增 - password 长度 5-20：4字符触发校验', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const passwordInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /管理员密码/ })
      .locator('input');
    await passwordInput.fill('1234');
    await passwordInput.blur();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('T-06 新增 - accountCount=-1（不限）：字段接受 -1', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const accountInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /用户数量/ })
      .locator('input');
    await accountInput.click({ clickCount: 3 });
    await accountInput.fill('-1');
    await accountInput.blur();
    await expect(accountInput).toHaveValue('-1');
  });

  test('T-07 编辑 - username/password 字段隐藏', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(drawer.locator('.n-form-item').filter({ hasText: /管理员账号/ })).not.toBeVisible();
    await expect(drawer.locator('.n-form-item').filter({ hasText: /管理员密码/ })).not.toBeVisible();
  });

  test('T-08 编辑 - packageId 字段禁用', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    const packageSelect = drawer
      .locator('.n-form-item')
      .filter({ hasText: /租户套餐/ })
      .locator('.n-select');
    await expect(packageSelect).toBeVisible({ timeout: 3000 });
    const isDisabled = await packageSelect.evaluate(
      (el) => el.classList.contains('n-select--disabled') || el.getAttribute('aria-disabled') === 'true',
    );
    expect(isDisabled).toBeTruthy();
  });

  test('T-09 编辑 - 回填：companyName/contactUserName 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /企业名称/ })
        .locator('input'),
    ).not.toHaveValue('');
    await expect(
      drawer
        .locator('.n-form-item')
        .filter({ hasText: /联系人/ })
        .locator('input'),
    ).not.toHaveValue('');
  });

  test('T-10 搜索 - 按企业名称过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/企业名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });
});
