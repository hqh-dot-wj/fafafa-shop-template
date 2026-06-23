import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { expect, test as setup } from '@playwright/test';

// eslint-disable-next-line no-underscore-dangle
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const AUTH_FILE = path.join(__dirname, 'playwright', '.auth', 'user.json');

/** 测试账户：admin / admin123（具备菜单管理等权限） */
const TEST_USER = { username: 'admin', password: 'admin123' };

const SUCCESS_CODE = '200';
const loginButtonName = /^(登录|Login)$/;

async function clickLoginAndWaitSuccess(page: Page): Promise<void> {
  const loginRespPromise = page.waitForResponse(
    (res) => {
      const req = res.request();
      return req.method() === 'POST' && /\/auth\/login\b/i.test(res.url());
    },
    { timeout: 55_000 },
  );

  await page.getByRole('button', { name: loginButtonName }).click();
  const resp = await loginRespPromise;

  const contentType = resp.headers()['content-type'] ?? '';
  let body: { code?: string | number; msg?: string } = {};
  if (contentType.includes('json')) {
    try {
      body = (await resp.json()) as typeof body;
    } catch {
      /* 非标准 JSON 时仅依赖 HTTP 状态 */
    }
  }

  if (!resp.ok()) {
    throw new Error(
      `登录接口 HTTP ${resp.status()}。请确认后端已启动，且 apps/admin-web/.env.development 中 VITE_SERVICE_BASE_URL、VITE_HTTP_PROXY 与后端地址一致。`,
    );
  }

  // eslint-disable-next-line eqeqeq
  const bizCode = body.code != null ? String(body.code) : '';
  if (bizCode !== '' && bizCode !== SUCCESS_CODE) {
    throw new Error(
      `登录失败（业务码 ${bizCode}）：${body.msg ?? '无详情'}。请确认账号 admin/admin123 与租户种子数据可用。`,
    );
  }

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 45_000 });
}

/**
 * 登录并保存认证状态，供 E2E 测试复用
 * 执行顺序：setup 项目先运行，依赖它的测试项目使用已保存的 storageState
 */
setup('authenticate', async ({ page }) => {
  await page.goto('/login/pwd-login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();

  const usernameInput = page.getByPlaceholder(/请输入用户名|Please enter user name/);
  const passwordInput = page.getByPlaceholder(/请输入密码|Please enter password/);

  await usernameInput.waitFor({ state: 'visible', timeout: 25_000 });
  await usernameInput.fill(TEST_USER.username);
  await passwordInput.fill(TEST_USER.password);

  try {
    await clickLoginAndWaitSuccess(page);
  } catch (firstError) {
    const demoCard = page.locator('.demo-account-card');
    try {
      await demoCard.waitFor({ state: 'visible', timeout: 3000 });
      await demoCard.click();
      await expect(page.getByRole('button', { name: loginButtonName })).toBeEnabled({ timeout: 3000 });
      await clickLoginAndWaitSuccess(page);
    } catch {
      const tail = '\n\n提示：全量 E2E 必须先启动 Nest 后端（如 pnpm dev:backend）。仅前端 dev 服务器无法完成登录。';
      if (firstError instanceof Error) {
        throw new Error(firstError.message + tail, { cause: firstError });
      }
      throw firstError;
    }
  }

  await expect(page.locator('body')).toBeVisible();

  const authDir = path.dirname(AUTH_FILE);
  if (!existsSync(authDir)) {
    mkdirSync(authDir, { recursive: true });
  }
  await page.context().storageState({ path: AUTH_FILE });
});
