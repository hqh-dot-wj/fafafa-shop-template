import { defineConfig, devices } from '@playwright/test';

function resolvePlaywrightWorkers(): number {
  if (process.env.CI) {
    return 1;
  }
  const n = Number(process.env.PLAYWRIGHT_WORKERS);
  if (n > 0) {
    return n;
  }
  return 2;
}

/**
 * E2E 测试配置
 * 运行前需先启动前端：pnpm dev
 * 然后执行：pnpm test:e2e
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /** 先检查后端可达，避免数百条用例全部卡在登录 setup */
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // 单测默认 30s 易被「动态路由 + 大表格列表」撑爆；后台 E2E 统一放宽
  timeout: 60_000,
  // 本地多 worker 易把 Vite/后端连接打满导致表格 20s 内未挂载，默认 2 worker 更稳（可用 PLAYWRIGHT_WORKERS 覆盖）
  workers: resolvePlaywrightWorkers(),
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:9527',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'smoke',
      testMatch: /smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
    // 冷启动时 Vite + 后端首包较慢，避免 authenticate 被默认 30s 整条测试超时打断
    // 冷启动：Vite 首次编译 + 后端 JWT/租户初始化可能较慢
    { name: 'setup', testMatch: /.*\.setup\.ts/, timeout: 120_000 },
    {
      name: 'chromium',
      testIgnore: /smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // 可按需开启：{ name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:9527',
        reuseExistingServer: !process.env.CI,
      },
});
