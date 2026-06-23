import process from 'node:process';

/**
 * 全量 E2E 前探测后端是否可达。
 * 开发模式下前端请求走 Vite 代理到 VITE_SERVICE_BASE_URL；若后端未起，登录会一直停在 /login，表现为 setup 超时。
 *
 * 跳过：PLAYWRIGHT_SKIP_BACKEND_CHECK=1
 * 自定义地址：PLAYWRIGHT_BACKEND_URL=http://127.0.0.1:8080
 */
export default async function globalSetup(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_BACKEND_CHECK === '1') {
    // Playwright 全局 setup 需要可见日志
    // eslint-disable-next-line no-console
    console.warn('[e2e] 已设置 PLAYWRIGHT_SKIP_BACKEND_CHECK=1，跳过后端连通性检查');
    return;
  }

  const raw = process.env.PLAYWRIGHT_BACKEND_URL ?? 'http://127.0.0.1:8080';
  const base = raw.replace(/\/$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    await fetch(base, { method: 'GET', signal: controller.signal, redirect: 'follow' });
  } catch (cause) {
    const msg =
      `E2E 全局前置失败：无法在 10s 内访问后端 ${base}。\n\n` +
      `原因说明：admin-web 开发环境（VITE_HTTP_PROXY=Y）下，浏览器只访问 localhost:9527，登录接口由 Vite 转发到 VITE_SERVICE_BASE_URL（默认与 ${base} 一致）。后端未启动时，登录不会跳转，authenticate setup 会在 waitForURL 上超时。\n\n` +
      `全量跑通推荐：\n` +
      `  1) 仓库根目录先起后端：pnpm dev:backend\n` +
      `  2) 再起 E2E（会自动起 Vite）：cd apps/admin-web ; pnpm test:e2e\n\n` +
      `若后端端口不是 8080：同步修改 apps/admin-web/.env.development 中 VITE_SERVICE_BASE_URL，并设置 PLAYWRIGHT_BACKEND_URL 为同一 origin。\n` +
      `临时跳过检查（不推荐）：PLAYWRIGHT_SKIP_BACKEND_CHECK=1\n`;
    throw new Error(msg, { cause });
  } finally {
    clearTimeout(timer);
  }
}
