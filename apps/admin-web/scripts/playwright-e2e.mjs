#!/usr/bin/env node
/**
 * Windows 下 Playwright 输出 UTF-8，若控制台仍为 GBK 代码页会乱码。
 * 在 cmd 内先执行 chcp 65001 再启动 CLI，保证终端与 Node 输出一致。
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const extra = process.argv.slice(2);
const playArgs = ['test', ...extra];
const smokeOnly = extra.some(
  (arg, index) => arg === '--project=smoke' || (arg === '--project' && extra[index + 1] === 'smoke'),
);
const childEnv = smokeOnly ? { ...process.env, PLAYWRIGHT_SKIP_BACKEND_CHECK: '1' } : { ...process.env };

/** pnpm 可能将依赖提升到仓库根，需自 admin-web 向上查找 */
function resolvePlaywrightCli(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 12; i++) {
    const cli = path.join(dir, 'node_modules', '@playwright', 'test', 'cli.js');
    if (fs.existsSync(cli)) return cli;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const cliPath = resolvePlaywrightCli(projectRoot);
if (!cliPath) {
  console.error('[playwright-e2e] 未找到 @playwright/test，请在仓库根目录执行 pnpm install');
  process.exit(1);
}

if (process.platform === 'win32') {
  const nodeArgs = [JSON.stringify(cliPath), ...playArgs.map((a) => JSON.stringify(String(a)))].join(' ');
  try {
    execSync(`chcp 65001>nul && node ${nodeArgs}`, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: childEnv,
      windowsHide: true,
    });
    process.exit(0);
  } catch (e) {
    const code = typeof e?.status === 'number' ? e.status : 1;
    process.exit(code);
  }
}

const result = spawnSync(process.execPath, [cliPath, ...playArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: childEnv,
});
process.exit(result.status ?? 1);
