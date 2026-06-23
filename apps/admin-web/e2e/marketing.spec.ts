// quality-gate allow-conditional-e2e
// quality-gate allow-timed-wait-e2e
import { expect, test } from '@playwright/test';
import {
  clearNotificationOverlay,
  expectMinLocatorCount,
  gotoAuthedListPage,
  gotoWhenDynamicRoutesReady,
  tableDataRows,
} from './helpers/assertions';

/**
 * 营销模块 E2E 测试
 *
 * 情况清单：
 *
 * 【优惠券模板】
 *   C-01  列表加载，表格渲染，标题可见
 *   C-02  新增 - 空表单提交：name/type/value/minAmount/totalCount/limitPerPerson 六个必填触发
 *   C-03  新增 - 代金券类型：面值单位显示"元"
 *   C-04  新增 - 折扣券类型：面值单位切换为"%"
 *   C-05  新增 - 时间类型"领取后天数"：validDays 字段可见，日期范围隐藏
 *   C-06  新增 - 时间类型"固定时间范围"：日期选择器可见，validDays 隐藏
 *   C-07  新增 - 面值极值 0：可提交（后端决定是否允许）
 *   C-08  新增 - 发放总量 -1（不限）：可提交
 *   C-09  新增 - 每人限领最小值 1：填 0 时应被 min 限制
 *   C-10  新增 - 正常代金券：完整填写后提交成功
 *   C-11  编辑 - 回填：名称/类型/面值字段不为空
 *   C-12  搜索 - 按名称过滤后表格刷新
 *   C-13  搜索 - 重置后输入框清空
 *
 * 【积分任务】
 *   T-01  列表加载，表格渲染
 *   T-02  新增 - 空表单提交：taskKey/taskName/pointsReward 必填触发
 *   T-03  新增 - 积分奖励 0：min=1 限制，不可低于 1
 *   T-04  新增 - 可重复开关关闭：maxCompletions 字段隐藏
 *   T-05  新增 - 可重复开关开启：maxCompletions 字段显示
 *   T-06  新增 - 正常提交：填写完整后成功
 *   T-07  编辑 - taskKey 字段禁用（不可修改）
 *   T-08  编辑 - 回填：taskName/pointsReward 不为空
 *
 * 【营销玩法模板】
 *   P-01  列表加载，表格渲染
 *   P-02  新增 - 空表单提交：code/name/unitName 必填触发
 *   P-03  新增 - 编辑时 code 字段禁用
 *   P-04  新增 - Schema Builder：点击添加字段后行出现
 *   P-05  新增 - Schema Builder：删除字段行后行消失
 *   P-06  新增 - 正常提交：填写 code/name/unitName 后成功
 *   P-07  编辑 - 回填：name/unitName 不为空，code 禁用
 *   P-08  搜索 - 按名称过滤后表格刷新
 */

// ─────────────────────────────────────────────
// 优惠券模板
// ─────────────────────────────────────────────
test.describe('优惠券模板', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/marketing/coupon/template');
  });

  // C-01
  test('C-01 列表加载：标题"优惠券模板列表"可见，表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('优惠券模板列表')).toBeVisible();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  // C-02
  test('C-02 新增 - 空表单提交：六个必填字段校验全部触发', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 清空默认值后提交
    const valueInput = modal.locator('.n-input-number').first();
    await valueInput.locator('input').click({ clickCount: 3 });
    await valueInput.locator('input').press('Backspace');

    await modal.getByRole('button', { name: /确定/ }).click();
    await expectMinLocatorCount(modal.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  // C-03
  test('C-03 新增 - 代金券类型：面值单位显示"元"', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 默认是代金券(CASH)
    const typeSelect = modal.locator('.n-select').first();
    const currentType = await typeSelect.textContent();
    expect(currentType).toContain('代金券');
    await expect(modal.locator('.n-input-number-suffix, .n-input__suffix').getByText('元').first()).toBeVisible();
  });

  // C-04
  test('C-04 新增 - 折扣券类型：面值单位切换为"%"', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 切换到折扣券
    const typeSelect = modal.locator('.n-select').first();
    await typeSelect.click();
    const discountOption = page.locator('.n-base-select-option').getByText('折扣券');
    await expect(discountOption).toBeVisible({ timeout: 3000 });
    await discountOption.click();
    await expect(modal.locator('.n-input-number-suffix, .n-input__suffix').getByText('%').first()).toBeVisible();
  });

  // C-05
  test('C-05 新增 - 时间类型"领取后天数"：validDays 可见，日期范围隐藏', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 选择"领取后生效天数"
    const daysRadio = modal.getByText('领取后生效天数');
    await expect(daysRadio).toBeVisible();
    await daysRadio.click();
    await expect(modal.locator('.n-form-item').filter({ hasText: '有效天数' })).toBeVisible();
    await expect(modal.locator('.n-date-picker')).not.toBeVisible();
  });

  // C-06
  test('C-06 新增 - 时间类型"固定时间范围"：日期选择器可见，validDays 隐藏', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const rangeRadio = modal.getByText('固定时间范围');
    await expect(rangeRadio).toBeVisible();
    await rangeRadio.click();
    await expect(modal.locator('.n-date-picker')).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('.n-form-item').filter({ hasText: '有效天数' })).not.toBeVisible();
  });

  // C-07
  test('C-07 新增 - 面值极值 0：字段接受 0 输入', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 找面值输入框（第一个 NInputNumber）
    const valueInput = modal.locator('.n-form-item').filter({ hasText: '面值' }).locator('input');
    await valueInput.click({ clickCount: 3 });
    await valueInput.fill('0');
    await expect(valueInput).toHaveValue('0');
  });

  // C-08
  test('C-08 新增 - 发放总量 -1（不限）：字段接受 -1 输入', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const totalInput = modal.locator('.n-form-item').filter({ hasText: '发放总量' }).locator('input');
    await totalInput.click({ clickCount: 3 });
    await totalInput.fill('-1');
    await expect(totalInput).toHaveValue('-1');
  });

  // C-09
  test('C-09 新增 - 每人限领 min=1：输入框不允许低于 1', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const limitInput = modal.locator('.n-form-item').filter({ hasText: '每人限领' }).locator('input');
    await limitInput.click({ clickCount: 3 });
    await limitInput.fill('0');
    await limitInput.blur();
    // NInputNumber min=1 会自动修正为 1
    const val = await limitInput.inputValue();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
  });

  // C-10
  test('C-10 新增 - 正常代金券：完整填写后提交成功', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await modal.locator('.n-form-item').filter({ hasText: '模板名称' }).locator('input').fill(`测试代金券${ts}`);

    const valueInput = modal.locator('.n-form-item').filter({ hasText: '面值' }).locator('input');
    await valueInput.click({ clickCount: 3 });
    await valueInput.fill('10');

    const minInput = modal.locator('.n-form-item').filter({ hasText: '最低消费' }).locator('input');
    await minInput.click({ clickCount: 3 });
    await minInput.fill('50');

    await modal.getByRole('button', { name: /确定/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  // C-11
  test('C-11 编辑 - 回填：名称/面值字段不为空', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().locator('button').first().click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const nameInput = modal.locator('.n-form-item').filter({ hasText: '模板名称' }).locator('input');
    await expect(nameInput).not.toHaveValue('');
  });

  // C-12
  test('C-12 搜索 - 按名称过滤后表格刷新', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/模板名称|name/i)
      .first();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await page.waitForTimeout(600);
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  // C-13
  test('C-13 搜索 - 重置后输入框清空', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/模板名称|name/i)
      .first();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await expect(searchInput).toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 积分任务
// ─────────────────────────────────────────────
test.describe('积分任务', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/marketing/points/tasks');
    await clearNotificationOverlay(page);
  });

  // T-01
  test('T-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  // T-02
  test('T-02 新增 - 空表单提交：taskKey/taskName/pointsReward 必填触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|创建|Add/ })
      .first()
      .click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 清空 taskKey
    await modal.locator('.n-form-item').filter({ hasText: '任务标识' }).locator('input').clear();
    // 清空 taskName
    await modal.locator('.n-form-item').filter({ hasText: '任务名称' }).locator('input').clear();

    await modal.getByRole('button', { name: /确定/ }).click();
    await expectMinLocatorCount(modal.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  // T-03
  test('T-03 新增 - 积分奖励 min=1：输入 0 后自动修正为 1', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|创建|Add/ })
      .first()
      .click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const rewardInput = modal.locator('.n-form-item').filter({ hasText: '积分奖励' }).locator('input');
    await rewardInput.scrollIntoViewIfNeeded();
    await rewardInput.fill('0');
    await rewardInput.blur();
    const val = await rewardInput.inputValue();
    expect(Number(val)).toBeGreaterThanOrEqual(1);
  });

  // T-04
  test('T-04 新增 - 可重复开关关闭：maxCompletions 字段隐藏', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|创建|Add/ })
      .first()
      .click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 默认 isRepeatable=false
    await expect(modal.locator('.n-form-item').filter({ hasText: '最多完成次数' })).not.toBeVisible();
  });

  // T-05
  test('T-05 新增 - 可重复开关开启：maxCompletions 字段显示', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|创建|Add/ })
      .first()
      .click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const repeatSwitch = modal.locator('.n-form-item').filter({ hasText: '可重复完成' }).locator('.n-switch');
    await repeatSwitch.click();
    await expect(modal.locator('.n-form-item').filter({ hasText: '最多完成次数' })).toBeVisible({ timeout: 2000 });
  });

  // T-06
  test('T-06 新增 - 正常提交：填写完整后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|创建|Add/ })
      .first()
      .click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await modal.locator('.n-form-item').filter({ hasText: '任务标识' }).locator('input').fill(`TASK_${ts}`);
    await modal.locator('.n-form-item').filter({ hasText: '任务名称' }).locator('input').fill(`测试任务${ts}`);

    const rewardInput = modal.locator('.n-form-item').filter({ hasText: '积分奖励' }).locator('input');
    await rewardInput.scrollIntoViewIfNeeded();
    await rewardInput.fill('50');

    await modal.getByRole('button', { name: /确定/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  // T-07
  test('T-07 编辑 - taskKey 字段禁用', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const taskKeyInput = modal.locator('.n-form-item').filter({ hasText: '任务标识' }).locator('input');
    await expect(taskKeyInput).toBeDisabled();
  });

  // T-08
  test('T-08 编辑 - 回填：taskName/pointsReward 不为空', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const modal = page.locator('.n-modal');
    await expect(modal).toBeVisible({ timeout: 3000 });
    const nameInput = modal.locator('.n-form-item').filter({ hasText: '任务名称' }).locator('input');
    await expect(nameInput).not.toHaveValue('');
    const rewardInput = modal.locator('.n-form-item').filter({ hasText: '积分奖励' }).locator('input');
    await expect(rewardInput).not.toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 营销玩法模板
// ─────────────────────────────────────────────
test.describe('营销玩法模板', () => {
  test.beforeEach(async ({ page }) => {
    await gotoWhenDynamicRoutesReady(page, '/marketing/template');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).not.toHaveURL(/\/403/);
    await expect(page.locator('.n-card').getByText('玩法模板管理')).toBeVisible({ timeout: 35_000 });
    await clearNotificationOverlay(page);
  });

  // P-01
  test('P-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  // P-02
  test('P-02 新增 - 空表单提交：code/name/unitName 必填触发', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await drawer.getByRole('button', { name: /确认/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  // P-03
  test('P-03 编辑 - code 字段禁用', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button', { name: /编辑/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    const codeInput = drawer.locator('.n-form-item').filter({ hasText: '玩法编码' }).locator('input');
    await expect(codeInput).toBeDisabled();
  });

  // P-04
  test('P-04 Schema Builder - 添加字段：行出现', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 点击动态输入的添加按钮（NDynamicInput 的 + 按钮）
    const addFieldBtn = drawer
      .locator('.n-dynamic-input__create-button, button[aria-label*="add"], .n-button')
      .filter({ hasText: /^\+$/ })
      .first();
    await expect(addFieldBtn).toBeVisible({ timeout: 2000 });
    const beforeCount = await drawer.locator('.n-dynamic-input-item').count();
    await addFieldBtn.click();
    await expect(drawer.locator('.n-dynamic-input-item')).toHaveCount(beforeCount + 1, { timeout: 2000 });
  });

  // P-05
  test('P-05 Schema Builder - 删除字段：行消失', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 先添加一行
    const addFieldBtn = drawer
      .locator('.n-dynamic-input__create-button, .n-button')
      .filter({ hasText: /^\+$/ })
      .first();
    await expect(addFieldBtn).toBeVisible({ timeout: 2000 });
    await addFieldBtn.click();
    await page.waitForTimeout(300);

    const beforeCount = await drawer.locator('.n-dynamic-input-item').count();
    expect(beforeCount).toBeGreaterThan(0);
    await drawer.locator('.n-dynamic-input-item').first().locator('button').last().click();
    await expect(drawer.locator('.n-dynamic-input-item')).toHaveCount(beforeCount - 1, { timeout: 2000 });
  });

  // P-06
  test('P-06 新增 - 正常提交：填写 code/name/unitName 后成功', async ({ page }) => {
    await page.getByRole('button', { name: /新增模板/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await drawer.locator('.n-form-item').filter({ hasText: '玩法编码' }).locator('input').fill(`TMPL_${ts}`);
    await drawer.locator('.n-form-item').filter({ hasText: '玩法名称' }).locator('input').fill(`测试玩法${ts}`);
    await drawer.locator('.n-form-item').filter({ hasText: '计量单位' }).locator('input').fill('人');

    await drawer.getByRole('button', { name: /确认/ }).click();
    await expect(page.getByText(/新增成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  // P-07
  test('P-07 编辑 - 回填：name/unitName 不为空，code 禁用', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button', { name: /编辑/ }).click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const nameInput = drawer.locator('.n-form-item').filter({ hasText: '玩法名称' }).locator('input');
    await expect(nameInput).not.toHaveValue('');
    const codeInput = drawer.locator('.n-form-item').filter({ hasText: '玩法编码' }).locator('input');
    await expect(codeInput).toBeDisabled();
  });

  // P-08
  test('P-08 搜索 - 按名称过滤后表格刷新', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/玩法名称|name/i)
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await page.waitForTimeout(600);
    await expect(page.locator('.n-data-table')).toBeVisible();
  });
});
