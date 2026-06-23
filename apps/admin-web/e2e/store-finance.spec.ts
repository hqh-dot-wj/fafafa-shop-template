import { expect, test } from '@playwright/test';
import { gotoAuthedListPage, tableDataRows } from './helpers/assertions';

/**
 * 门店财务模块 E2E 测试
 *
 * 情况清单：
 *
 * 【佣金明细】
 *   C-01  列表加载：统计卡片（今日/本月/待结算）可见，表格渲染
 *   C-02  搜索 - 按订单号过滤：表格刷新
 *   C-03  搜索 - 状态筛选（冻结中/已结算/已取消）：表格刷新
 *   C-04  搜索 - 重置：输入框清空
 *
 * 【门店流水】
 *   L-01  列表加载：统计面板（总收入/总支出/净利润/待结算佣金）可见，表格渲染
 *   L-02  快捷筛选 - 点击"订单收入"：表格刷新
 *   L-03  快捷筛选 - 点击"佣金入账"：表格刷新
 *   L-04  快捷筛选 - 点击"全部"：恢复全量
 *   L-05  搜索 - 按交易类型过滤：表格刷新
 *
 * 【提现管理】
 *   W-01  列表加载：Tab（待审核/已通过/已驳回）可见，表格渲染
 *   W-02  Tab 切换 - 点击"已通过"：表格刷新
 *   W-03  Tab 切换 - 点击"已驳回"：表格刷新
 *   W-04  通过操作 - 审核弹窗打开：申请人/金额/备注字段可见
 *   W-05  通过操作 - 确认提交成功（有待审核数据时）
 *   W-06  驳回操作 - 审核弹窗打开：备注字段可见
 *   W-07  驳回操作 - 取消：弹窗关闭
 */

// ─────────────────────────────────────────────
// 佣金明细
// ─────────────────────────────────────────────
test.describe('佣金明细', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/finance/commission');
  });

  test('C-01 列表加载：统计卡片可见，表格渲染', async ({ page }) => {
    await expect(page.locator('.n-statistic').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('C-02 搜索 - 按订单号过滤：表格刷新', async ({ page }) => {
    const orderSnInput = page
      .locator('.n-form')
      .getByPlaceholder(/订单号/i)
      .first();
    await expect(orderSnInput).toBeVisible({ timeout: 5000 });
    await orderSnInput.fill('TEST');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('C-03 搜索 - 状态筛选：选择"已结算"后表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-form').locator('.n-select').first();
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.click();
    const option = page.locator('.n-base-select-option').getByText(/已结算|SETTLED/i);
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('C-04 搜索 - 重置：输入框清空', async ({ page }) => {
    const orderSnInput = page
      .locator('.n-form')
      .getByPlaceholder(/订单号/i)
      .first();
    await expect(orderSnInput).toBeVisible({ timeout: 5000 });
    await orderSnInput.fill('TEST');
    await page
      .getByRole('button', { name: /重置|Reset/ })
      .first()
      .click();
    await expect(orderSnInput).toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 门店流水
// ─────────────────────────────────────────────
test.describe('门店流水', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/finance/ledger');
  });

  test('L-01 列表加载：统计面板可见，表格渲染', async ({ page }) => {
    await expect(page.locator('.n-statistic').first()).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('L-02 快捷筛选 - 点击"订单收入"：表格刷新', async ({ page }) => {
    const tag = page.locator('.n-tag').getByText('订单收入');
    await expect(tag).toBeVisible({ timeout: 3000 });
    await tag.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('L-03 快捷筛选 - 点击"佣金入账"：表格刷新', async ({ page }) => {
    const tag = page.locator('.n-tag').getByText('佣金入账');
    await expect(tag).toBeVisible({ timeout: 3000 });
    await tag.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('L-04 快捷筛选 - 点击"全部"：恢复全量', async ({ page }) => {
    const tag = page.locator('.n-tag').getByText('订单收入');
    await expect(tag).toBeVisible({ timeout: 3000 });
    await tag.click();
    const allTag = page.locator('.n-tag').getByText('全部');
    await expect(allTag).toBeVisible({ timeout: 3000 });
    await allTag.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 提现管理
// ─────────────────────────────────────────────
test.describe('提现管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/finance/withdrawal');
  });

  test('W-01 列表加载：Tab 可见，表格渲染', async ({ page }) => {
    await expect(page.locator('.n-tabs')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('W-02 Tab 切换 - 点击"已通过"：表格刷新', async ({ page }) => {
    const approvedTab = page.locator('.n-tab').getByText('已通过');
    await expect(approvedTab).toBeVisible({ timeout: 3000 });
    await approvedTab.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('W-03 Tab 切换 - 点击"已驳回"：表格刷新', async ({ page }) => {
    const rejectedTab = page.locator('.n-tab').getByText('已驳回');
    await expect(rejectedTab).toBeVisible({ timeout: 3000 });
    await rejectedTab.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('W-04 通过操作 - 审核弹窗打开：申请人/金额字段可见', async ({ page }) => {
    const approveBtn = tableDataRows(page).getByRole('button', { name: /通过/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 3000 });
    await approveBtn.click();
    const modal = page.locator('.n-modal, .n-dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('p').filter({ hasText: '申请人' })).toBeVisible();
    await expect(modal.locator('p').filter({ hasText: '提现金额' })).toBeVisible();
  });

  test('W-06 驳回操作 - 审核弹窗打开：备注字段可见', async ({ page }) => {
    const rejectBtn = tableDataRows(page).getByRole('button', { name: /驳回/ }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 3000 });
    await rejectBtn.click();
    const modal = page.locator('.n-modal, .n-dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.locator('textarea')).toBeVisible();
  });

  test('W-07 驳回操作 - 取消：弹窗关闭', async ({ page }) => {
    const rejectBtn = tableDataRows(page).getByRole('button', { name: /驳回/ }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 3000 });
    await rejectBtn.click();
    const modal = page.locator('.n-modal, .n-dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await modal.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(modal).not.toBeVisible({ timeout: 2000 });
  });
});
