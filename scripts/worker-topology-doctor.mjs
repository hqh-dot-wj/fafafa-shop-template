#!/usr/bin/env node
/**
 * worker-topology-doctor.mjs
 * 静态检查 API/Worker/Scheduler 进程拓扑是否符合部署约定。
 * 当前为 warn-only，不阻断构建。
 *
 * 检查项：
 *   - backend 是否有独立的 Worker 入口（main.worker.ts 或 apps/worker/main.ts）
 *   - 发现 processor 文件时，是否有对应的独立进程入口
 *   - Scheduler（@CodeManagedJob / @Task）是否有独立入口
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const BACKEND_SRC = path.join(root, 'apps/backend/src');

/** 独立 Worker 入口的候选路径（相对仓库根） */
export const WORKER_ENTRY_CANDIDATES = [
  'apps/backend/src/main.worker.ts',
  'apps/backend/src/main.processor.ts',
  'apps/worker/src/main.ts',
  'apps/worker/main.ts',
];

/** 独立 Scheduler 入口的候选路径 */
export const SCHEDULER_ENTRY_CANDIDATES = [
  'apps/backend/src/main.scheduler.ts',
  'apps/scheduler/src/main.ts',
  'apps/scheduler/main.ts',
];

export const PROCESSOR_FILE_PATTERN = /\.(processor|consumer|worker)\.ts$/;

function collectProcessorFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectProcessorFiles(full));
    } else if (PROCESSOR_FILE_PATTERN.test(entry.name) && !entry.name.includes('.spec.')) {
      result.push(path.relative(root, full).replace(/\\/g, '/'));
    }
  }

  return result;
}

function hasEntryPoint(candidates) {
  return candidates.some((p) => fs.existsSync(path.join(root, p)));
}

export function checkWorkerTopology({ dir = BACKEND_SRC } = {}) {
  const processors = collectProcessorFiles(dir);
  const hasWorkerEntry = hasEntryPoint(WORKER_ENTRY_CANDIDATES);
  const hasSchedulerEntry = hasEntryPoint(SCHEDULER_ENTRY_CANDIDATES);

  const findings = [];

  if (processors.length > 0 && !hasWorkerEntry) {
    findings.push({
      id: 'same-process-workers',
      severity: 'warn',
      message: `发现 ${processors.length} 个 processor/consumer 文件，但无独立 Worker 进程入口`,
      detail: processors,
      fix: '参考 HARNESS_ENGINEERING.md §4：同进程过渡期可接受，但需有明确上限和演进路径；独立进程目标路径见 WORKER_ENTRY_CANDIDATES',
    });
  }

  // Scheduler 独立性检查（仅在未来有明确独立 Scheduler 需求时升级为 fail）
  const schedulerPatterns = [/@CodeManagedJob\b/, /@Task\b/];
  const hasSchedulerAnnotations = collectProcessorFiles(dir)
    .concat(
      (() => {
        const ts = [];
        function walkTs(d) {
          if (!fs.existsSync(d)) return;
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            if (e.isDirectory()) walkTs(f);
            else if (e.name.endsWith('.ts') && !e.name.includes('.spec.')) ts.push(f);
          }
        }
        walkTs(dir);
        return ts;
      })(),
    )
    .some((f) => {
      try {
        const c = fs.readFileSync(typeof f === 'string' && f.startsWith(root) ? f : path.join(root, f), 'utf8');
        return schedulerPatterns.some((p) => p.test(c));
      } catch {
        return false;
      }
    });

  if (hasSchedulerAnnotations && !hasSchedulerEntry) {
    findings.push({
      id: 'same-process-scheduler',
      severity: 'warn',
      message: '@CodeManagedJob/@Task 调度器与 API 运行在同一进程',
      detail: [],
      fix: '参考 HARNESS_ENGINEERING.md §4：调度器同进程过渡期可接受，独立进程目标路径见 SCHEDULER_ENTRY_CANDIDATES',
    });
  }

  return { processors, hasWorkerEntry, hasSchedulerEntry, findings };
}

export function main() {
  console.log('--- Worker Topology Doctor ---');

  const { processors, hasWorkerEntry, hasSchedulerEntry, findings } = checkWorkerTopology();

  console.log(`发现 processor/consumer 文件: ${processors.length}`);
  console.log(`独立 Worker 入口: ${hasWorkerEntry ? '✓ 有' : '✗ 无'}`);
  console.log(`独立 Scheduler 入口: ${hasSchedulerEntry ? '✓ 有' : '✗ 无'}`);

  if (findings.length === 0) {
    console.log('✓ 进程拓扑符合约定');
    return { ok: true, warnings: 0 };
  }

  for (const f of findings) {
    console.warn(`\n  ⚠ [${f.id}] ${f.message}`);
    if (f.detail.length > 0) {
      f.detail.slice(0, 5).forEach((d) => console.warn(`    - ${d}`));
      if (f.detail.length > 5) console.warn(`    ... 共 ${f.detail.length} 个`);
    }
    console.warn(`    → ${f.fix}`);
  }

  console.warn(`\n⚠ 发现 ${findings.length} 个拓扑问题（当前为 warn-only，不阻断构建）`);
  return { ok: true, warnings: findings.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
