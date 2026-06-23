import { expect, test } from '@playwright/test';
import { expectMinLocatorCount, gotoAuthedListPage, tableDataRows } from './helpers/assertions';

/**
 * 商品模块 E2E 测试
 *
 * 情况清单：
 *
 * 【品牌管理】
 *   B-01  列表加载：表格渲染
 *   B-02  新增 - 空表单提交：name 必填校验触发
 *   B-03  新增 - 正常提交：填写名称后成功
 *   B-04  新增 - 超长名称（100字符）：提交后出现消息（成功或后端拦截）
 *   B-05  新增 - 仅空格名称：提交后出现校验或后端拦截
 *   B-06  编辑 - 回填：name 字段不为空
 *   B-07  编辑 - 修改名称后保存成功
 *   B-08  搜索 - 按名称过滤后表格刷新
 *   B-09  搜索 - 重置后输入框清空
 *
 * 【商品分类】
 *   C-01  列表加载：表格渲染
 *   C-02  新增 - 空表单提交：name 必填校验触发
 *   C-03  新增 - 正常提交（无父分类）：填写名称后成功
 *   C-04  新增 - 选择父分类：层级自动联动（不报错）
 *   C-05  新增 - bindType 两个选项均可选（REAL/SERVICE）
 *   C-06  编辑 - 回填：name 字段不为空
 *
 * 【商品属性模板】
 *   A-01  列表加载：表格渲染
 *   A-02  新增 - 空模板名提交：必填校验触发
 *   A-03  新增 - 添加属性行：行出现，包含名称/类型/输入方式字段
 *   A-04  新增 - 属性名为空提交：被 message 错误拦截
 *   A-05  新增 - 删除属性行：行消失
 *   A-06  新增 - 属性输入方式"选择"：inputList 字段启用
 *   A-07  新增 - 属性输入方式"手动"：inputList 字段禁用
 *   A-08  新增 - 正常提交（无属性行）：填写模板名后成功
 *   A-09  编辑 - 回填：模板名不为空，属性行已渲染
 *
 * 【标准商品库】
 *   P-01  列表加载：左侧分类树含"全部商品"根节点
 *   P-02  分类树筛选：点击根节点触发表格刷新
 *   P-03  搜索 - 有结果：按名称搜索后表格刷新
 *   P-04  搜索 - 无结果：显示空状态
 *   P-05  搜索 - 重置：输入框清空
 *   P-06  发布状态筛选：选择"上架"后表格刷新
 *   P-07  新增商品：点击新增跳转到创建页
 *   P-08  编辑商品：点击编辑跳转到创建页（带 id 参数）
 */

// ─────────────────────────────────────────────
// 品牌管理
// ─────────────────────────────────────────────
test.describe('品牌管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/pms/brand');
  });

  test('B-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('B-02 新增 - 空表单提交：name 必填校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('B-03 新增 - 正常提交：填写名称后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByPlaceholder(/品牌名称|brandName/).fill(`测试品牌${Date.now()}`);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  test('B-04 新增 - 超长名称（100字符）：提交后出现消息', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByPlaceholder(/品牌名称|brandName/).fill('A'.repeat(100));
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message')).toBeVisible({ timeout: 8000 });
  });

  test('B-05 新增 - 仅空格名称：提交后出现校验或后端拦截', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByPlaceholder(/品牌名称|brandName/).fill('   ');
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    // 前端校验或后端拦截，均应出现提示
    await expect(drawer.locator('.n-form-item-feedback--error').or(page.locator('.n-message'))).toBeVisible({
      timeout: 5000,
    });
  });

  test('B-06 编辑 - 回填：name 字段不为空', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByPlaceholder(/品牌名称|brandName/)).not.toHaveValue('');
  });

  test('B-07 编辑 - 修改名称后保存成功', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    const nameInput = drawer.getByPlaceholder(/品牌名称|brandName/);
    await nameInput.click({ clickCount: 3 });
    await nameInput.fill(`编辑品牌${Date.now()}`);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  test('B-08 搜索 - 按名称过滤后表格刷新', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/品牌名称|name/i)
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('B-09 搜索 - 重置后输入框清空', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/品牌名称|name/i)
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await expect(searchInput).toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 商品分类
// ─────────────────────────────────────────────
test.describe('商品分类管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/pms/category');
  });

  test('C-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('C-02 新增 - 空表单提交：name 必填校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('C-03 新增 - 正常提交（无父分类）：填写名称后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByPlaceholder(/分类名称|categoryName/)).toBeVisible({ timeout: 5000 });
    await drawer.getByPlaceholder(/分类名称|categoryName/).fill(`测试分类${Date.now()}`);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  test('C-04 新增 - 选择父分类：层级自动联动，不报错', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByPlaceholder(/分类名称|categoryName/)).toBeVisible({ timeout: 5000 });

    const parentSelect = drawer.locator('.n-tree-select').first();
    await expect(parentSelect).toBeVisible();
    await parentSelect.click();
    const firstNode = page.locator('.n-tree-select-menu .n-tree-node').first();
    await expect(firstNode).toBeVisible({ timeout: 3000 });
    await firstNode.click();
    // 选择后不应出现错误
    await expect(drawer.locator('.n-form-item-feedback--error')).not.toBeVisible();
  });

  test('C-05 新增 - bindType 两个选项均可选', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const bindTypeSelect = drawer
      .locator('.n-form-item')
      .filter({ hasText: /绑定类型|bindType/ })
      .locator('.n-select');
    await expect(bindTypeSelect).toBeVisible();
    await bindTypeSelect.click();
    await expect(page.locator('.n-base-select-option').getByText(/实物商品|REAL/i)).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.n-base-select-option').getByText(/服务商品|SERVICE/i)).toBeVisible();
    await page
      .locator('.n-base-select-option')
      .getByText(/实物商品|REAL/i)
      .click();
    await expect(bindTypeSelect).toContainText(/实物|REAL/i);
  });

  test('C-06 编辑 - 回填：name 字段不为空', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await expect(drawer.getByPlaceholder(/分类名称|categoryName/)).not.toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 商品属性模板
// ─────────────────────────────────────────────
test.describe('商品属性管理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/pms/attribute');
  });

  test('A-01 列表加载：表格渲染', async ({ page }) => {
    await expect(page.locator('.n-card')).toBeVisible();
  });

  test('A-02 新增 - 空模板名提交：必填校验触发', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(drawer.locator('.n-form-item-feedback--error')).toBeVisible({ timeout: 3000 });
  });

  test('A-03 新增 - 添加属性行：行出现，包含名称/类型字段', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const addAttrBtn = drawer.getByRole('button', { name: /添加属性|addAttribute/ });
    await expect(addAttrBtn).toBeVisible();
    await addAttrBtn.click();
    await expectMinLocatorCount(drawer.locator('tbody tr'), 1, { timeout: 3000 });
    // 行内应有名称输入框
    await expect(drawer.locator('tbody tr').first().locator('input').first()).toBeVisible();
  });

  test('A-04 新增 - 属性名为空提交：被 message 错误拦截', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    // 填写模板名
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /模板名称|name/i })
      .first()
      .locator('input')
      .fill(`模板${Date.now()}`);

    const addAttrBtn = drawer.getByRole('button', { name: /添加属性|addAttribute/ });
    await expect(addAttrBtn).toBeVisible();
    await addAttrBtn.click();
    await expectMinLocatorCount(drawer.locator('tbody tr'), 1, { timeout: 3000 });
    // 属性名留空直接提交
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.locator('.n-message--error')).toBeVisible({ timeout: 3000 });
  });

  test('A-05 新增 - 删除属性行：行消失', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const addAttrBtn = drawer.getByRole('button', { name: /添加属性|addAttribute/ });
    await expect(addAttrBtn).toBeVisible();
    const beforeCount = await drawer.locator('tbody tr').count();
    await addAttrBtn.click();
    await expect(drawer.locator('tbody tr')).toHaveCount(beforeCount + 1, { timeout: 3000 });
    // 点行内删除按钮
    await drawer.locator('tbody tr').first().getByRole('button').last().click();
    await expect(drawer.locator('tbody tr')).toHaveCount(beforeCount, { timeout: 2000 });
  });

  test('A-06 新增 - 属性输入方式"选择"：inputList 字段启用', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const addAttrBtn = drawer.getByRole('button', { name: /添加属性|addAttribute/ });
    await expect(addAttrBtn).toBeVisible();
    await addAttrBtn.click();
    await expectMinLocatorCount(drawer.locator('tbody tr'), 1, { timeout: 3000 });

    // 找输入方式下拉（第三列 select）
    const inputTypeSelect = drawer.locator('tbody tr').first().locator('.n-select').nth(1);
    await expect(inputTypeSelect).toBeVisible();
    await inputTypeSelect.click();
    const selectOption = page.locator('.n-base-select-option').getByText(/选择|select/i);
    await expect(selectOption).toBeVisible({ timeout: 3000 });
    await selectOption.click();
    // inputList 输入框应变为可用
    const inputListField = drawer.locator('tbody tr').first().locator('input').last();
    await expect(inputListField).not.toBeDisabled();
  });

  test('A-07 新增 - 属性输入方式"手动"：inputList 字段禁用', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });

    const addAttrBtn = drawer.getByRole('button', { name: /添加属性|addAttribute/ });
    await expect(addAttrBtn).toBeVisible();
    await addAttrBtn.click();
    await expectMinLocatorCount(drawer.locator('tbody tr'), 1, { timeout: 3000 });

    // 默认 inputType=0（手动），inputList 应禁用
    const inputListField = drawer.locator('tbody tr').first().locator('input').last();
    await expect(inputListField).toBeDisabled();
  });

  test('A-08 新增 - 正常提交（无属性行）：填写模板名后成功', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await drawer
      .locator('.n-form-item')
      .filter({ hasText: /模板名称|name/i })
      .first()
      .locator('input')
      .fill(`测试属性模板${Date.now()}`);
    await drawer.getByRole('button', { name: /确认|Confirm/ }).click();
    await expect(page.getByText(/更新成功|updateSuccess/i)).toBeVisible({ timeout: 8000 });
  });

  test('A-09 编辑 - 回填：模板名不为空', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    await tableDataRows(page).first().getByRole('button').first().click();
    const drawer = page.locator('.n-drawer');
    await expect(drawer).toBeVisible({ timeout: 5000 });
    const nameInput = drawer
      .locator('.n-form-item')
      .filter({ hasText: /模板名称|name/i })
      .first()
      .locator('input');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await expect(nameInput).not.toHaveValue('');
  });
});

// ─────────────────────────────────────────────
// 标准商品库
// ─────────────────────────────────────────────
test.describe('标准商品库', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthedListPage(page, '/pms/global-product');
  });

  test('P-01 列表加载：左侧分类树含"全部商品"根节点', async ({ page }) => {
    await expect(page.locator('.n-tree').getByText('全部商品')).toBeVisible({ timeout: 8000 });
  });

  test('P-02 分类树筛选：点击根节点触发表格刷新', async ({ page }) => {
    await expectMinLocatorCount(page.locator('.n-tree .n-tree-node'), 1, { timeout: 8000 });
    await page.locator('.n-tree').getByText('全部商品').click();
    await expect(page.locator('.n-data-table')).toBeVisible({ timeout: 5000 });
  });

  test('P-03 搜索 - 有结果：按名称搜索后表格刷新', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await searchInput.fill('商品');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('P-04 搜索 - 无结果：显示空状态或 0 条数据', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await searchInput.fill('__不存在的商品xyz__');
    await page.getByRole('button', { name: /搜索|Search/ }).click();
    await expect
      .poll(
        async () => {
          const isEmpty = await page.locator('.n-data-table-empty').isVisible();
          const rowCount = await tableDataRows(page).count();
          return isEmpty || rowCount === 0;
        },
        { timeout: 8000 },
      )
      .toBe(true);
  });

  test('P-05 搜索 - 重置：输入框清空', async ({ page }) => {
    const searchInput = page
      .locator('.n-form')
      .getByPlaceholder(/商品名称|name/i)
      .first();
    await searchInput.fill('测试');
    await page.getByRole('button', { name: /重置|Reset/ }).click();
    await expect(searchInput).toHaveValue('');
  });

  test('P-06 发布状态筛选：选择"上架"后表格刷新', async ({ page }) => {
    const statusSelect = page.locator('.n-form').locator('.n-select').first();
    await expect(statusSelect).toBeVisible();
    await statusSelect.click();
    const onShelfOption = page.locator('.n-base-select-option').getByText(/上架|ON_SHELF/i);
    await expect(onShelfOption).toBeVisible({ timeout: 3000 });
    await onShelfOption.click();
    await expect(page.locator('.n-data-table')).toBeVisible();
  });

  test('P-07 新增商品：点击新增跳转到创建页', async ({ page }) => {
    await page
      .getByRole('button', { name: /新增|Add/ })
      .first()
      .click();
    await expect(page).toHaveURL(/global-product-create/, { timeout: 5000 });
  });

  test('P-08 编辑商品：点击编辑跳转到创建页（带 id 参数）', async ({ page }) => {
    await expectMinLocatorCount(tableDataRows(page), 1, { timeout: 8000 });
    const editBtn = tableDataRows(page)
      .first()
      .getByRole('button', { name: /编辑|Edit/ });
    await expect(editBtn).toBeVisible({ timeout: 3000 });
    await editBtn.click();
    await expect(page).toHaveURL(/global-product-create.*id=/, { timeout: 5000 });
  });
});
