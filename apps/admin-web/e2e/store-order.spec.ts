import { expect, test } from '@playwright/test';
import {
  expandSearchPanelIfCollapsed,
  expectMinLocatorCount,
  gotoAuthedListPage,
  tableDataRows,
} from './helpers/assertions';

/**
 * 门店订单模块 E2E 测试
 *
 * 情况清单：
 *
 * 【订单列表】
 *   O-01  列表加载：表格渲染
 *   O-02  搜索 - 按订单号过滤：表格刷新
 *   O-03  搜索 - 按手机号过滤：表格刷新
 *   O-04  搜索 - 订单状态六个选项均可选（待支付/已支付/已发货/已完成/已取消/已退款）
 *   O-05  搜索 - 订单类型两个选项均可选（实物/服务）
 *   O-06  搜索 - 重置：所有筛选条件清空
 *   O-07  搜索 - 无结果：显示空状态
 *
 * 【待派单列表】
 *   D-01  列表加载：标题"待派单列表"可见，表格渲染
 *   D-02  派单弹窗 - 打开：workerId 输入框可见
 *   D-03  派单弹窗 - workerId 为空提交：被拦截（warning 提示）
 *   D-04  派单弹窗 - workerId min=1：输入 0 不允许
 *   D-05  派单弹窗 - 取消：弹窗关闭
 */

async function openDispatchModal(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  const dispatchBtn = tableDataRows(page).first().getByRole('button').last();
  await dispatchBtn.click();
  const modal = page.locator('.n-modal, .n-dialog');
  await expect(modal).toBeVisible({ timeout: 3000 });
  return modal;
}

// ─────────────────────────────────────────────
// 订单列表
// ─────────────────────────────────────────────
test.describe('订单列表', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/order/list');
  });

  test('O-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('O-02 搜索 - 按订单号过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const orderSnInput = page.getByPlaceholder(/订单号/i);
    await expect(orderSnInput).toBeVisible({ timeout: 3000 });
    await orderSnInput.fill('TEST_ORDER_001');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('O-03 搜索 - 按手机号过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const phoneInput = page.getByPlaceholder(/手机号/i);
    await expect(phoneInput).toBeVisible({ timeout: 3000 });
    await phoneInput.fill('138');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('O-04 搜索 - 订单状态六个选项均可选', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const statusSelect = page.locator('.n-form-item').filter({ hasText: '订单状态' }).locator('.n-select');
    await expect(statusSelect).toBeVisible({ timeout: 3000 });
    await statusSelect.click();
    await expect(page.locator('.n-base-select-option').getByText('待支付')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.n-base-select-option').getByText('已支付')).toBeVisible();
    await expect(page.locator('.n-base-select-option').getByText('已发货')).toBeVisible();
    await expect(page.locator('.n-base-select-option').getByText('已完成')).toBeVisible();
    await expect(page.locator('.n-base-select-option').getByText('已取消')).toBeVisible();
    await expect(page.locator('.n-base-select-option').getByText('已退款')).toBeVisible();
    await page.locator('.n-base-select-option').getByText('待支付').click();
    await expect(statusSelect).toContainText('待支付');
  });

  test('O-05 搜索 - 订单类型两个选项均可选', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const typeSelect = page.locator('.n-form-item').filter({ hasText: '订单类型' }).locator('.n-select');
    await expect(typeSelect).toBeVisible({ timeout: 3000 });
    await typeSelect.click();
    await expect(page.locator('.n-base-select-option').getByText('实物商品')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.n-base-select-option').getByText('服务类')).toBeVisible();
    await page.locator('.n-base-select-option').getByText('服务类').click();
    await expect(typeSelect).toContainText('服务类');
  });

  test('O-06 搜索 - 重置：所有筛选条件清空', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const orderSnInput = page.getByPlaceholder(/订单号/i);
    await expect(orderSnInput).toBeVisible({ timeout: 3000 });
    await orderSnInput.fill('TEST');
    await page
      .getByRole('button', { name: /重置|Reset/ })
      .first()
      .click();
    await expect(orderSnInput).toHaveValue('');
  });

  test('O-07 搜索 - 无结果：显示空状态', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);

    const orderSnInput = page.getByPlaceholder(/订单号/i);
    await expect(orderSnInput).toBeVisible({ timeout: 3000 });
    await orderSnInput.fill('__不存在的订单号xyz__');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table-empty')).toBeVisible({ timeout: 8000 });
  });
});

// ─────────────────────────────────────────────
// 待派单列表
// ─────────────────────────────────────────────
test.describe('待派单列表', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/order/dispatch');
  });

  test('D-01 列表加载：标题"待派单列表"可见', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('待派单列表')).toBeVisible();
  });

  test('D-02 派单弹窗 - 打开：workerId 输入框可见', async ({ page }) => {
    const modal = await openDispatchModal(page);
    await expect(modal.locator('.n-input-number')).toBeVisible();
  });

  test('D-03 派单弹窗 - workerId 为空提交：被拦截', async ({ page }) => {
    const modal = await openDispatchModal(page);
    await modal.getByRole('button', { name: /确认派单|确认/ }).click();
    await expect(page.locator('.n-message--warning, .n-message--error')).toBeVisible({ timeout: 3000 });
  });

  test('D-05 派单弹窗 - 取消：弹窗关闭', async ({ page }) => {
    const modal = await openDispatchModal(page);
    await modal.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });
});
