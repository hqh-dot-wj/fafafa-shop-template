import { expect, test } from '@playwright/test';
import {
  clearNotificationOverlay,
  expectMinLocatorCount,
  gotoAuthedListPage,
  gotoWhenDynamicRoutesReady,
  tableDataRows,
} from './helpers/assertions';

/**
 * 分销模块 E2E 测试
 *
 * 情况清单：
 * 【分销规则配置】D-01~D-08
 * 【分销等级】     L-01~L-11
 * 【分销员申请】   A-01~A-05
 * 【分销看板】     B-01
 */

async function setSwitchChecked(switchLocator: ReturnType<typeof tableDataRows>, checked: boolean): Promise<void> {
  const expected = String(checked);
  if ((await switchLocator.getAttribute('aria-checked')) !== expected) {
    await switchLocator.click();
    await expect(switchLocator).toHaveAttribute('aria-checked', expected);
  }
}

async function openFirstRowDrawer(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1);
  await tableDataRows(page).first().getByRole('button').first().click();
  const drawer = page.locator('.n-drawer');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  await clearNotificationOverlay(page);
  return drawer;
}

// ─────────────────────────────────────────────
// 分销规则配置
// ─────────────────────────────────────────────
test.describe('分销规则配置', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/store/distribution/distribution');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator('.n-form')).toBeVisible({ timeout: 35_000 });
    await clearNotificationOverlay(page);
  });

  test('D-01 页面加载：一级/二级比例字段可见', async ({ page }) => {
    await expect(page.locator('.n-form-item').filter({ hasText: /一级/ }).first()).toBeVisible();
    await expect(page.locator('.n-form-item').filter({ hasText: /二级/ }).first()).toBeVisible();
  });

  test('D-02 数据回填：一级比例字段有数值', async ({ page }) => {
    const level1Input = page.locator('.n-form-item').filter({ hasText: /一级/ }).first().locator('input');
    const val = await level1Input.inputValue();
    expect(val).not.toBe('');
    expect(Number(val)).toBeGreaterThanOrEqual(0);
  });

  test('D-03 一级比例极值 0：字段接受 0', async ({ page }) => {
    const level1Input = page.locator('.n-form-item').filter({ hasText: /一级/ }).first().locator('input');
    await level1Input.click({ clickCount: 3 });
    await level1Input.fill('0');
    await level1Input.blur();
    expect(Number(await level1Input.inputValue())).toBeGreaterThanOrEqual(0);
  });

  test('D-04 一级比例极值 100：字段接受 100', async ({ page }) => {
    const level1Input = page.locator('.n-form-item').filter({ hasText: /一级/ }).first().locator('input');
    await level1Input.click({ clickCount: 3 });
    await level1Input.fill('100');
    await level1Input.blur();
    expect(Number.parseFloat(await level1Input.inputValue())).toBe(100);
  });

  test('D-05 跨租户开关关闭：crossTenantRate 字段隐藏', async ({ page }) => {
    const crossSwitch = page
      .locator('.n-form-item')
      .filter({ hasText: /开启跨店分佣|Enable Cross Tenant Commission/i })
      .first()
      .locator('.n-switch');
    await expect(crossSwitch).toBeVisible({ timeout: 10_000 });
    await setSwitchChecked(crossSwitch, false);
    await expect(
      page.locator('.n-form-item').filter({ hasText: /跨店佣金折扣|Cross Tenant Commission Discount/i }),
    ).toBeHidden({ timeout: 5000 });
  });

  test('D-06 跨租户开关开启：crossTenantRate/crossMaxDaily 字段显示', async ({ page }) => {
    const crossSwitch = page
      .locator('.n-form-item')
      .filter({ hasText: /开启跨店分佣|Enable Cross Tenant Commission/i })
      .first()
      .locator('.n-switch');
    await expect(crossSwitch).toBeVisible({ timeout: 10_000 });
    await setSwitchChecked(crossSwitch, true);
    await expect(
      page.locator('.n-form-item').filter({ hasText: /跨店佣金折扣|Cross Tenant Commission Discount/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test('D-07 保存配置：出现成功提示', async ({ page }) => {
    await page.getByRole('button', { name: /保存|Save/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  test('D-08 历史记录表格：渲染且有"创建时间"列', async ({ page }) => {
    await expect(page.locator('.n-data-table')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.n-data-table').getByText(/创建时间/)).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// 分销等级
// ─────────────────────────────────────────────
test.describe('分销等级', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/distribution/distribution-level');
    await clearNotificationOverlay(page);
  });

  test('L-01 列表加载：标题"分销员等级"可见，表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('分销员等级')).toBeVisible();
  });

  test('L-02 新增 - 空表单提交：必填字段校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    await drawer.locator('.n-form-item').filter({ hasText: '等级名称' }).locator('input').clear();
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('L-03 新增 - levelId 极值 0：min=1 自动修正', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '等级编号' }).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('0');
    await input.blur();
    expect(Number(await input.inputValue())).toBeGreaterThanOrEqual(1);
  });

  test('L-04 新增 - levelId 极值 11：max=10 自动修正', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '等级编号' }).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('11');
    await input.blur();
    expect(Number(await input.inputValue())).toBeLessThanOrEqual(10);
  });

  test('L-05 新增 - 一级比例极值 0：字段接受 0', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '一级佣金比例' }).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('0');
    await input.blur();
    expect(Number.parseFloat(await input.inputValue())).toBe(0);
  });

  test('L-06 新增 - 一级比例极值 100：字段接受 100', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '一级佣金比例' }).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('100');
    await input.blur();
    expect(Number.parseFloat(await input.inputValue())).toBe(100);
  });

  test('L-07 新增 - 一级比例超出 100：max 限制自动修正', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '一级佣金比例' }).locator('input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('150');
    await input.blur();
    expect(Number(await input.inputValue())).toBeLessThanOrEqual(100);
  });

  test('L-08 新增 - 正常提交：填写完整后出现消息提示', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await clearNotificationOverlay(page);

    const uniqueLevelId = String(100 + (Date.now() % 890));
    const levelIdInput = drawer.locator('.n-form-item').filter({ hasText: '等级编号' }).locator('input');
    await levelIdInput.scrollIntoViewIfNeeded();
    await levelIdInput.fill(uniqueLevelId);

    const nameInput = drawer.locator('.n-form-item').filter({ hasText: '等级名称' }).locator('input');
    await nameInput.scrollIntoViewIfNeeded();
    await nameInput.fill(`测试等级${Date.now()}`);

    const rate1 = drawer.locator('.n-form-item').filter({ hasText: '一级佣金比例' }).locator('input');
    await rate1.scrollIntoViewIfNeeded();
    await rate1.fill('30');

    const rate2 = drawer.locator('.n-form-item').filter({ hasText: '二级佣金比例' }).locator('input');
    await rate2.scrollIntoViewIfNeeded();
    await rate2.fill('10');

    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('L-09 编辑 - levelId 字段禁用', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    const input = drawer.locator('.n-form-item').filter({ hasText: '等级编号' }).locator('input');
    await expect(input).toBeDisabled();
  });

  test('L-10 编辑 - 回填：levelName/level1Rate/level2Rate 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(drawer.locator('.n-form-item').filter({ hasText: '等级名称' }).locator('input')).not.toHaveValue('');
    await expect(drawer.locator('.n-form-item').filter({ hasText: '一级佣金比例' }).locator('input')).not.toHaveValue(
      '',
    );
    await expect(drawer.locator('.n-form-item').filter({ hasText: '二级佣金比例' }).locator('input')).not.toHaveValue(
      '',
    );
  });

  test('L-11 删除 - 确认弹窗出现后取消：数据行数不变', async ({ page }) => {
    const rows = await tableDataRows(page).count();
    expect(rows).toBeGreaterThan(0);
    const deleteBtn = tableDataRows(page).first().getByRole('button').last();
    await deleteBtn.click();
    const popconfirm = page.locator('.n-popconfirm');
    await expect(popconfirm).toBeVisible({ timeout: 3000 });
    await popconfirm.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(tableDataRows(page)).toHaveCount(rows);
  });
});

// ─────────────────────────────────────────────
// 分销员申请
// ─────────────────────────────────────────────
test.describe('分销员申请', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/store/distribution/distribution-application');
  });

  test('A-01 列表加载：标题"分销员申请列表"可见', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('分销员申请列表')).toBeVisible();
  });

  test('A-02 状态筛选 - 选择"待审核"：表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-select').first();
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.click();
    const option = page.locator('.n-base-select-option').getByText(/待审核/i);
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('A-03 状态筛选 - 选择"已通过"：表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-select').first();
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.click();
    const option = page.locator('.n-base-select-option').getByText(/已通过/i);
    await expect(option).toBeVisible({ timeout: 3000 });
    await option.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('A-04 状态筛选 - 重置：表格恢复全量', async ({ page }) => {
    const resetBtn = page.getByRole('button', { name: /重置|Reset/ });
    await expect(resetBtn).toBeVisible({ timeout: 5000 });
    await resetBtn.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('A-05 通过操作 - 确认弹窗出现后取消：不执行操作', async ({ page }) => {
    const approveBtn = tableDataRows(page).getByRole('button', { name: /通过/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 3000 });
    await approveBtn.click();
    const dialog = page.locator('.n-dialog, .n-modal');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(dialog).not.toBeVisible({ timeout: 2000 });
  });
});

// ─────────────────────────────────────────────
// 分销看板
// ─────────────────────────────────────────────
test.describe('分销看板', () => {
  test('B-01 页面加载：主内容区域可见，无白屏', async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/store/distribution/distribution-dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator('.n-card, .flex-col-stretch').first()).toBeVisible({ timeout: 35_000 });
  });
});
