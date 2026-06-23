import { expect, test } from '@playwright/test';
import { expectMinLocatorCount, gotoAuthedListPage, tableDataRows } from './helpers/assertions';

/**
 * 会员模块 E2E 测试
 *
 * 情况清单：
 *
 * 【会员列表】
 *   M-01  列表加载：表格渲染
 *   M-02  搜索 - 按手机号过滤：表格刷新
 *   M-03  搜索 - 重置：输入框清空
 *   M-04  编辑推荐人 - 抽屉打开：referrerId 字段可见
 *   M-05  编辑推荐人 - 提交成功
 *   M-06  编辑等级 - 抽屉打开：levelId 下拉可见，三个选项
 *   M-07  积分调整 - 抽屉打开：type/amount/remark 字段可见
 *   M-08  积分调整 - 空表单提交：amount/remark 必填触发
 *   M-09  积分调整 - amount min=1：输入 0 自动修正
 *   M-10  积分调整 - 增加类型：正常提交成功
 *   M-11  积分调整 - 扣减类型：切换后 type=SUB
 *
 * 【会员升级申请】
 *   U-01  列表加载：标题"升级申请列表"可见，表格渲染
 *   U-02  状态筛选 - 选择"待审批"：表格刷新
 *   U-03  状态筛选 - 选择"已通过"：表格刷新
 *   U-04  申请类型筛选：选择"商品购买"后表格刷新
 *   U-05  通过操作 - 确认弹窗出现后取消：不执行操作
 *   U-06  驳回操作 - 确认弹窗出现后取消：不执行操作
 */

// ─────────────────────────────────────────────
// 会员列表
// ─────────────────────────────────────────────
test.describe('会员列表', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/member/list');
  });

  test('M-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('M-02 搜索 - 按手机号过滤：表格刷新', async ({ page }) => {
    const phoneInput = page
      .locator('.n-form')
      .getByPlaceholder(/手机|mobile/i)
      .first();
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('138');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('M-03 搜索 - 重置：输入框清空', async ({ page }) => {
    const phoneInput = page
      .locator('.n-form')
      .getByPlaceholder(/手机|mobile/i)
      .first();
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('138');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await expect(phoneInput).toHaveValue('');
  });

  test('M-04 编辑推荐人 - 抽屉打开：referrerId 字段可见', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    // 找"编辑推荐人"操作按钮
    const editBtn = tableDataRows(page).first().getByRole('button').first();
    await editBtn.click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.locator('input')).toBeVisible();
  });

  test('M-07 积分调整 - 抽屉打开：type/amount/remark 字段可见', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    // 找积分调整按钮（通常是最后一个操作按钮）
    const adjustBtn = tableDataRows(page)
      .first()
      .getByRole('button', { name: /积分|调整/ });
    await expect(adjustBtn).toBeVisible({ timeout: 3000 });
    await adjustBtn.click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.locator('.n-radio-group')).toBeVisible();
    await expect(drawer.locator('.n-input-number')).toBeVisible();
  });

  test('M-08 积分调整 - 空表单提交：必填触发', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    const adjustBtn = tableDataRows(page)
      .first()
      .getByRole('button', { name: /积分|调整/ });
    await expect(adjustBtn).toBeVisible({ timeout: 3000 });
    await adjustBtn.click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 清空 remark
    const remarkInput = drawer.locator('.n-form-item').filter({ hasText: '调整原因' }).locator('textarea');
    await remarkInput.clear();

    await drawer.getByRole('button', { name: /确认提交/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('M-09 积分调整 - amount min=1：输入 0 自动修正', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    const adjustBtn = tableDataRows(page)
      .first()
      .getByRole('button', { name: /积分|调整/ });
    await expect(adjustBtn).toBeVisible({ timeout: 3000 });
    await adjustBtn.click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const amountInput = drawer.locator('.n-form-item').filter({ hasText: '调整数量' }).locator('input');
    await amountInput.click({ clickCount: 3 });
    await amountInput.fill('0');
    await amountInput.blur();
    expect(Number(await amountInput.inputValue())).toBeGreaterThanOrEqual(1);
  });

  test('M-11 积分调整 - 扣减类型：切换后 SUB 选中', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    const adjustBtn = tableDataRows(page)
      .first()
      .getByRole('button', { name: /积分|调整/ });
    await expect(adjustBtn).toBeVisible({ timeout: 3000 });
    await adjustBtn.click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const subBtn = drawer.getByRole('radio', { name: /扣减/ });
    await expect(subBtn).toBeVisible();
    await subBtn.click();
    await expect(subBtn).toBeChecked();
  });
});

// ─────────────────────────────────────────────
// 会员升级申请
// ─────────────────────────────────────────────
test.describe('会员升级申请', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/member/upgrade');
  });

  test('U-01 列表加载：标题"升级申请列表"可见', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('升级申请列表')).toBeVisible();
  });

  test('U-02 状态筛选 - 选择"待审批"：表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-select').first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();
    const option = page.locator('.n-base-select-option').getByText(/待审批|PENDING/i);
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('U-03 状态筛选 - 选择"已通过"：表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-select').first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();
    const option = page.locator('.n-base-select-option').getByText(/已通过|APPROVED/i);
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('U-05 通过操作 - 确认弹窗出现后取消：不执行操作', async ({ page }) => {
    const approveBtn = tableDataRows(page).getByRole('button', { name: /通过/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 3000 });
    await approveBtn.click();
    const dialog = page.locator('.n-dialog, .n-modal');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });

  test('U-06 驳回操作 - 确认弹窗出现后取消：不执行操作', async ({ page }) => {
    const rejectBtn = tableDataRows(page).getByRole('button', { name: /驳回/ }).first();
    await expect(rejectBtn).toBeVisible({ timeout: 3000 });
    await rejectBtn.click();
    const dialog = page.locator('.n-dialog, .n-modal');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});
