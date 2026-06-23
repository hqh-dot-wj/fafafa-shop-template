import { expect, test } from '@playwright/test';
import {
  expandSearchPanelIfCollapsed,
  expectMinLocatorCount,
  gotoAuthedListPage,
  tableDataRows,
} from './helpers/assertions';

/**
 * 系统监控模块 E2E 测试
 *
 * 情况清单：
 *
 * 【定时任务】
 *   J-01  列表加载：表格渲染
 *   J-02  新增 - 空表单提交：jobName/invokeTarget/cronExpression 必填触发
 *   J-03  新增 - 正常提交：填写三个必填字段后成功
 *   J-04  新增 - 执行策略三个选项均可选（立即执行/执行一次/放弃执行）
 *   J-05  新增 - 是否并发两个选项均可选（允许/禁止）
 *   J-06  编辑 - 回填：jobName/invokeTarget/cronExpression 不为空
 *   J-07  编辑 - status 字段显示（新增时不显示）
 *   J-08  搜索 - 按任务名称过滤：表格刷新
 *   J-09  搜索 - 重置：输入框清空
 *
 * 【调度日志】
 *   L-01  列表加载：标题"调度日志"可见，表格渲染
 *   L-02  搜索 - 按任务名称过滤：表格刷新
 *   L-03  搜索 - 执行状态筛选：表格刷新
 *   L-04  清空日志 - 确认弹窗出现后取消：数据不删除
 *   L-05  查看详情 - 抽屉打开：详情内容可见
 */

async function openFirstRowDrawer(page: Parameters<typeof tableDataRows>[0]) {
  await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
  await tableDataRows(page).first().getByRole('button').first().click();
  const drawer = page.locator('.n-drawer');
  await expect(drawer).toBeVisible({ timeout: 5000 });
  return drawer;
}

// ─────────────────────────────────────────────
// 定时任务
// ─────────────────────────────────────────────
test.describe('定时任务', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/monitor/job');
  });

  test('J-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('J-02 新增 - 空表单提交：必填字段校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确定|Confirm/ }).click();
    await expectMinLocatorCount(drawer.locator('.n-form-item-feedback--error'), 1, { timeout: 3000 });
  });

  test('J-03 新增 - 正常提交：填写三个必填字段后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const ts = Date.now();
    await drawer.locator('.n-form-item').filter({ hasText: '任务名称' }).locator('input').fill(`测试任务${ts}`);
    await drawer.locator('.n-form-item').filter({ hasText: '调用方法' }).locator('input').fill(`testTask.run()`);
    await drawer.locator('.n-form-item').filter({ hasText: 'cron表达式' }).locator('input').fill('0/10 * * * * ?');

    await drawer.getByRole('button', { name: /确定|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('J-04 新增 - 执行策略三个选项均可选', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await expect(drawer.getByRole('radio', { name: /立即执行/ })).toBeVisible();
    await expect(drawer.getByRole('radio', { name: /执行一次/ })).toBeVisible();
    await expect(drawer.getByRole('radio', { name: /放弃执行/ })).toBeVisible();

    await drawer.getByRole('radio', { name: /执行一次/ }).click();
    await expect(drawer.getByRole('radio', { name: /执行一次/ })).toBeChecked();
  });

  test('J-05 新增 - 是否并发两个选项均可选', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    await expect(drawer.getByRole('radio', { name: /允许/ })).toBeVisible();
    await expect(drawer.getByRole('radio', { name: /禁止/ })).toBeVisible();

    await drawer.getByRole('radio', { name: /允许/ }).click();
    await expect(drawer.getByRole('radio', { name: /允许/ })).toBeChecked();
  });

  test('J-06 编辑 - 回填：jobName/invokeTarget 不为空', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(drawer.locator('.n-form-item').filter({ hasText: '任务名称' }).locator('input')).not.toHaveValue('');
    await expect(drawer.locator('.n-form-item').filter({ hasText: '调用方法' }).locator('input')).not.toHaveValue('');
  });

  test('J-07 编辑 - status 字段显示', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(drawer.locator('.n-form-item').filter({ hasText: '状态' })).toBeVisible();
  });

  test('J-08 搜索 - 按任务名称过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/任务名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('J-09 搜索 - 重置：输入框清空', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/任务名称/i)
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
// 调度日志
// ─────────────────────────────────────────────
test.describe('调度日志', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/monitor/job-log');
  });

  test('L-01 列表加载：标题"调度日志"可见', async ({ page }) => {
    await expect(page.locator('.n-card').getByText('调度日志')).toBeVisible();
  });

  test('L-02 搜索 - 按任务名称过滤：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const nameInput = page
      .locator('.n-form')
      .getByPlaceholder(/任务名称/i)
      .first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('测试');
    await page
      .getByRole('button', { name: /搜索|Search/ })
      .first()
      .click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('L-03 搜索 - 执行状态筛选：表格刷新', async ({ page }) => {
    await expandSearchPanelIfCollapsed(page);
    const statusSelect = page.locator('.n-form').locator('.n-select').first();
    await expect(statusSelect).toBeVisible({ timeout: 5000 });
    await statusSelect.click();
    const firstOption = page.locator('.n-base-select-option').first();
    await expect(firstOption).toBeVisible({ timeout: 3000 });
    await firstOption.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('L-04 清空日志 - 确认弹窗出现后取消：数据不删除', async ({ page }) => {
    const cleanBtn = page.getByRole('button', { name: /清空/ });
    await expect(cleanBtn).toBeVisible({ timeout: 3000 });
    const rowsBefore = await tableDataRows(page).count();
    await cleanBtn.click();
    const dialog = page.locator('.n-dialog, .n-modal');
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await dialog.getByRole('button', { name: /取消|Cancel/ }).click();
    await expect(tableDataRows(page)).toHaveCount(rowsBefore);
  });

  test('L-05 查看详情 - 抽屉打开：详情内容可见', async ({ page }) => {
    const drawer = await openFirstRowDrawer(page);
    await expect(drawer.locator('.n-descriptions, .n-form')).toBeVisible({ timeout: 3000 });
  });
});
