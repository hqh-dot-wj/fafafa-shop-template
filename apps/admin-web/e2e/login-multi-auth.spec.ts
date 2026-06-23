import { expect, test } from '@playwright/test';

/**
 * 登录页多入口可见性（密码 / 短信 / 忘记密码 / 微信占位）
 * 不依赖真实短信与后端账号，仅做 UI 与路由可达性回归。
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('登录多入口', () => {
  test('密码登录页应展示短信登录、忘记密码、微信绑定入口', async ({ page }) => {
    await page.goto('/login/pwd-login');
    await expect(page.locator('body')).toBeVisible();

    await expect(page.getByText('短信登录')).toBeVisible();
    await expect(page.getByText('忘记密码')).toBeVisible();
    await expect(page.getByText('微信绑定')).toBeVisible();
    await expect(page.getByText(/管理员账号由管理员分配/)).toBeVisible();
  });

  test('点击短信登录进入验证码登录模块', async ({ page }) => {
    await page.goto('/login/pwd-login');
    await page.getByText('短信登录').click();
    await expect(page).toHaveURL(/code-login/);
    await expect(page.getByPlaceholder(/手机号|phone/i).first()).toBeVisible();
  });

  test('忘记密码页展示说明与返回', async ({ page }) => {
    await page.goto('/login/reset-pwd');
    await expect(page.getByText(/向已登记手机号发送验证码/)).toBeVisible();
    await page.getByRole('button', { name: /返回|Back/i }).click();
    await expect(page).toHaveURL(/pwd-login/);
  });

  test('微信绑定页展示说明与检测按钮', async ({ page }) => {
    await page.goto('/login/bind-wechat');
    await expect(page.getByText(/微信开放平台|短信验证码/)).toBeVisible();
    await expect(page.getByRole('button', { name: /检测服务端接入状态/ })).toBeVisible();
  });
});
