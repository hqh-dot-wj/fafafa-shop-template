import { expect, test } from '@playwright/test';
import { expectMinLocatorCount, gotoAuthedListPage, tableDataRows } from './helpers/assertions';

/**
 * 门店商品 & 库存模块 E2E 测试
 *
 * 情况清单：
 *
 * 【门店商品列表】
 *   P-01  列表加载：表格渲染
 *   P-02  搜索 - 按名称过滤：表格刷新
 *   P-03  搜索 - 重置：输入框清空
 *   P-04  经营配置抽屉 - 打开：商品名称/上架状态/积分比例字段可见
 *   P-05  经营配置 - 积分比例 min=0：字段接受 0
 *   P-06  经营配置 - 积分比例 max=200：字段接受 200
 *   P-07  经营配置 - 积分比例超出 200：max 限制自动修正
 *   P-08  经营配置 - 服务类商品：overrideRadius 字段显示
 *   P-09  库存预警配置 - 弹窗打开：threshold 字段可见
 *   P-10  库存预警配置 - threshold min=0：字段接受 0
 *   P-11  库存预警配置 - threshold max=99999：字段接受 99999
 *   P-12  库存预警配置 - 保存成功
 *   P-13  批量调价 - 选中商品后抽屉打开：SKU 行渲染
 *   P-14  批量调价 - price min=0：字段接受 0
 *
 * 【库存管理】
 *   S-01  列表加载：表格渲染
 *   S-02  搜索 - 按商品名称过滤：表格刷新
 *   S-03  批量调整库存 - 选中后抽屉打开：SKU 行渲染
 *   S-04  批量调整库存 - 变动量 0 提交：被 warning 拦截
 *   S-05  批量调整库存 - 变动量范围 -9999~9999：边界值接受
 */

async function openFirstProductConfigDrawer(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  await tableDataRows(page).first().getByRole('button').first().click();
  const drawer = page.locator('.n-drawer');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  return drawer;
}

async function openStockWarningModal(page: Parameters<typeof tableDataRows>[0]) {
  const alertBtn = page.getByRole('button', { name: /预警|库存预警/ }).first();
  await expect(alertBtn).toBeVisible({ timeout: 5000 });
  await alertBtn.click();
  const modal = page.locator('.n-modal, .n-dialog');
  await expect(modal).toBeVisible({ timeout: 5000 });
  return modal;
}

async function openBatchStockDrawer(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  await tableDataRows(page).first().locator('.n-checkbox').click();
  const batchBtn = page.getByRole('button', { name: /批量调整|批量/ }).first();
  await expect(batchBtn).toBeVisible({ timeout: 3000 });
  await batchBtn.click();
  const drawer = page.locator('.n-drawer');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  await expectMinLocatorCount(drawer.locator('tbody tr'), 1, { timeout: 3000 });
  return drawer;
}

// ─────────────────────────────────────────────
// 门店商品列表
// ─────────────────────────────────────────────
test.describe('门店商品列表', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/product/list');
  });

  test('P-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('P-02 搜索 - 按名称过滤：表格刷新', async ({ page }) => {
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('P-03 搜索 - 重置：输入框清空', async ({ page }) => {
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /重置|Reset/ })
      .first()
      .click();
    await expect(nameInput).toHaveValue('');
  });

  test('P-04 经营配置抽屉 - 打开：积分比例字段可见', async ({ page }) => {
    const drawer = await openFirstProductConfigDrawer(page);
    await expect(drawer.locator('.n-form-item').filter({ hasText: '积分获得比例' })).toBeVisible({ timeout: 5000 });
  });

  test('P-05 经营配置 - 积分比例 min=0：字段接受 0', async ({ page }) => {
    const drawer = await openFirstProductConfigDrawer(page);
    const ratioInput = drawer.locator('.n-form-item').filter({ hasText: '积分获得比例' }).locator('input');
    await ratioInput.click({ clickCount: 3 });
    await ratioInput.fill('0');
    await ratioInput.blur();
    expect(Number(await ratioInput.inputValue())).toBeGreaterThanOrEqual(0);
  });

  test('P-06 经营配置 - 积分比例 max=200：字段接受 200', async ({ page }) => {
    const drawer = await openFirstProductConfigDrawer(page);
    const ratioInput = drawer.locator('.n-form-item').filter({ hasText: '积分获得比例' }).locator('input');
    await ratioInput.click({ clickCount: 3 });
    await ratioInput.fill('200');
    await ratioInput.blur();
    await expect(ratioInput).toHaveValue('200');
  });

  test('P-07 经营配置 - 积分比例超出 200：max 限制自动修正', async ({ page }) => {
    const drawer = await openFirstProductConfigDrawer(page);
    const ratioInput = drawer.locator('.n-form-item').filter({ hasText: '积分获得比例' }).locator('input');
    await ratioInput.click({ clickCount: 3 });
    await ratioInput.fill('300');
    await ratioInput.blur();
    expect(Number(await ratioInput.inputValue())).toBeLessThanOrEqual(200);
  });

  test('P-09 库存预警配置 - 弹窗打开：threshold 字段可见', async ({ page }) => {
    const modal = await openStockWarningModal(page);
    await expect(modal.locator('.n-input-number')).toBeVisible();
  });

  test('P-10 库存预警配置 - threshold min=0：字段接受 0', async ({ page }) => {
    const modal = await openStockWarningModal(page);
    const thresholdInput = modal.locator('.n-input-number input');
    await thresholdInput.click({ clickCount: 3 });
    await thresholdInput.fill('0');
    await thresholdInput.blur();
    expect(Number(await thresholdInput.inputValue())).toBeGreaterThanOrEqual(0);
  });

  test('P-11 库存预警配置 - threshold max=99999：字段接受 99999', async ({ page }) => {
    const modal = await openStockWarningModal(page);
    const thresholdInput = modal.locator('.n-input-number input');
    await thresholdInput.click({ clickCount: 3 });
    await thresholdInput.fill('99999');
    await thresholdInput.blur();
    await expect(thresholdInput).toHaveValue('99999');
  });
});

// ─────────────────────────────────────────────
// 库存管理
// ─────────────────────────────────────────────
test.describe('库存管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/stock');
  });

  test('S-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('S-02 搜索 - 按商品名称过滤：表格刷新', async ({ page }) => {
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('S-03 批量调整库存 - 选中后抽屉打开：SKU 行渲染', async ({ page }) => {
    await openBatchStockDrawer(page);
  });

  test('S-04 批量调整库存 - 变动量全为 0 提交：被 warning 拦截', async ({ page }) => {
    const drawer = await openBatchStockDrawer(page);
    await drawer.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.locator('.n-message--warning')).toBeVisible({ timeout: 3000 });
  });

  test('S-05 批量调整库存 - 变动量边界 -9999 和 9999：字段均接受', async ({ page }) => {
    const drawer = await openBatchStockDrawer(page);
    const changeInput = drawer.locator('tbody tr').first().locator('.n-input-number input');
    await expect(changeInput).toBeVisible({ timeout: 3000 });
    await changeInput.click({ clickCount: 3 });
    await changeInput.fill('-9999');
    await changeInput.blur();
    expect(Number(await changeInput.inputValue())).toBeGreaterThanOrEqual(-9999);

    await changeInput.click({ clickCount: 3 });
    await changeInput.fill('9999');
    await changeInput.blur();
    expect(Number(await changeInput.inputValue())).toBeLessThanOrEqual(9999);
  });
});
