import { expect, test } from '@playwright/test';
import { gotoWhenDynamicRoutesReady } from './helpers/assertions';

/**
 * 系统管理路由 E2E 冒烟测试（需登录）
 * 覆盖：菜单、部门、岗位、字典、参数、通知、客户端、租户、租户套餐、OSS、OSS配置、文件管理
 * 注：用户管理和角色管理有独立的详细测试文件（system-user.spec.ts / system-role.spec.ts）
 *
 * 每个路由验证：
 * 1. 未被重定向到登录页（权限守卫正常）
 * 2. 页面主体内容区域可见（没有白屏/崩溃）
 * 3. 有表格的页面：表格容器渲染出来（数据层正常初始化）
 */

/** 有表格的页面，额外验证表格容器渲染 */
const TABLE_ROUTES = [
  '/system/menu',
  '/system/dept',
  '/system/post',
  '/system/dict',
  '/system/config',
  '/system/notice',
  '/system/client',
  '/system/tenant',
  '/system/tenant-package',
  '/system/oss',
  '/system/oss-config',
];

/** 非标准表格页面，只验证路由可达 */
const OTHER_ROUTES = ['/system/file-manager'];

test.describe('System routes (authenticated)', () => {
  for (const routePath of TABLE_ROUTES) {
    test(`${routePath} 页面加载且表格渲染`, async ({ page }) => {
      await gotoWhenDynamicRoutesReady(page, routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).not.toHaveURL(/\/403/);
      // 以表格挂载为准（比单独等 .n-card 更稳，避免布局/过渡导致首屏类名时机差异）
      await expect(page.locator('.n-data-table').first()).toBeVisible({ timeout: 40_000 });
    });
  }

  for (const routePath of OTHER_ROUTES) {
    test(`${routePath} 登录后可访问`, async ({ page }) => {
      await gotoWhenDynamicRoutesReady(page, routePath);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).not.toHaveURL(/\/403/);
      await expect(page.locator('.n-card, .n-layout-content, main, .flex-col-stretch')).toBeVisible({
        timeout: 35_000,
      });
    });
  }
});
