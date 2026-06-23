#!/usr/bin/env node
/**
 * check-queue-contracts.mjs
 * 扫描后端 processor/consumer/worker 文件，检查队列任务是否包含：
 *   - jobId（幂等键）
 *   - tenantId（租户隔离）
 *   - 失败回执（@OnQueueFailed / onError / catch）
 * 当前为 warn-only，不阻断构建。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const BACKEND_SRC = path.join(root, 'apps/backend/src');

export const EXCLUDED_FILE_PATTERNS = [/\.spec\.ts$/, /\.e2e-spec\.ts$/, /\.test\.ts$/];

/** processor/consumer/worker 文件名模式 */
export const QUEUE_FILE_PATTERN = /\.(processor|consumer|worker)\.ts$/;

export const CONTRACT_SIGNALS = {
  jobId: [/\bjobId\b/, /job\.id\b/, /\.id\s*[:=]/, /deduplication/i],
  tenantId: [/\btenantId\b/, /tenant_id\b/, /\.tenantId\b/],
  failureHandler: [/@OnQueueFailed\b/, /onError\s*\(/, /catch\s*\(/, /\.on\s*\(\s*['"`]failed/i],
};

export function isExcludedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDED_FILE_PATTERNS.some((p) => p.test(normalized));
}

export function isQueueFile(filePath) {
  return QUEUE_FILE_PATTERN.test(filePath);
}

export function checkQueueContract(content) {
  const missing = [];

  for (const [aspect, patterns] of Object.entries(CONTRACT_SIGNALS)) {
    const found = patterns.some((p) => p.test(content));
    if (!found) missing.push(aspect);
  }

  return missing;
}

function collectQueueFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectQueueFiles(full));
    } else if (isQueueFile(entry.name) && !isExcludedFile(full)) {
      result.push(full);
    }
  }

  return result;
}

export function checkQueueContracts({ dir = BACKEND_SRC } = {}) {
  const files = collectQueueFiles(dir);
  const fileViolations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const missing = checkQueueContract(content);
    if (missing.length > 0) {
      const relative = path.relative(root, filePath).replace(/\\/g, '/');
      fileViolations.push({ file: relative, missing });
    }
  }

  return { scanned: files.length, fileViolations };
}

export function main() {
  console.log('--- Queue Contracts 扫描 ---');

  const { scanned, fileViolations } = checkQueueContracts();
  console.log(`扫描 processor/consumer/worker 数: ${scanned}`);

  if (scanned === 0) {
    console.log('✓ 无队列处理文件');
    return { ok: true, warnings: 0 };
  }

  if (fileViolations.length === 0) {
    console.log('✓ 所有队列任务均包含 jobId、tenantId 与失败回执');
    return { ok: true, warnings: 0 };
  }

  let total = 0;
  for (const { file, missing } of fileViolations) {
    console.warn(`  ⚠ ${file}`);
    for (const aspect of missing) {
      const hints = {
        jobId: '缺少 jobId/幂等键 — 添加 job.opts.jobId 或业务幂等字段',
        tenantId: '缺少 tenantId — payload 必须携带租户标识',
        failureHandler: '缺少失败回执 — 添加 @OnQueueFailed 或 try/catch 失败日志',
      };
      console.warn(`    → [${aspect}] ${hints[aspect]}`);
      total++;
    }
  }

  console.warn(`\n⚠ 发现 ${total} 处队列契约缺失（当前为 warn-only，不阻断构建）`);
  return { ok: true, warnings: total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
