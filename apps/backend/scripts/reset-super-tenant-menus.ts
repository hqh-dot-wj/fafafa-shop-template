/**
 * 调用 `prisma/seed.ts --reseed-menus-only`：管道内会先清空租户 000000 的 sys_menu 及 sys_role_menu，再播种并重置序列、执行湖南平台覆写。
 *
 * 运行（在 apps/backend 目录）: pnpm prisma:reset-super-menus
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

const backendRoot = path.join(__dirname, '..');
const r = spawnSync('pnpm', ['exec', 'ts-node', 'prisma/seed.ts', '--reseed-menus-only'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});
if (r.error) {
  throw r.error;
}
if (r.status !== 0) {
  process.exit(r.status ?? 1);
}
