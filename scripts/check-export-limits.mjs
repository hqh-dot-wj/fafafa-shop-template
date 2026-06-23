#!/usr/bin/env node
/**
 * check-export-limits.mjs
 * 扫描后端控制器中的导出/下载接口，检查是否具备以下保护之一：
 *   A. count/limit 参数保护（防止无上限全量导出）
 *   B. 异步任务路径（将导出推入队列，不阻塞 HTTP 响应）
 * 当前为 warn-only，不阻断构建。
 *
 * 路由路径含 export/download/excel 的接口会被扫描。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
export const BACKEND_SRC = path.join(root, 'apps/backend/src');

export const EXCLUDED_FILE_PATTERNS = [/\.spec\.ts$/, /\.e2e-spec\.ts$/, /\.test\.ts$/];

/** 路由路径中触发检查的关键词（含 @ decorator 的字符串参数） */
export const EXPORT_ROUTE_KEYWORDS = ['export', 'download', 'excel', 'Export', 'Download', 'Excel'];

/** 接口上下文中表示"有保护"的信号 */
export const PROTECTION_SIGNALS = [
  /\blimit\b/i,
  /\bcount\b/i,
  /\bMAX_\w+/,
  /\bqueue\b/i,
  /\bjob\b/i,
  /\btask\b/i,
  /\.add\s*\(/,
  /createJob/i,
  /dispatchJob/i,
];

export function isExcludedFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return EXCLUDED_FILE_PATTERNS.some((p) => p.test(normalized));
}

/**
 * 从控制器文件内容中提取疑似导出接口的方法块（简单启发式）。
 * 返回 { methodName, startLine, context } 数组。
 */
export function extractExportMethods(content) {
  const lines = content.split(/\r?\n/);
  const methods = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 寻找包含 export/download/excel 关键词的 @Get/@Post decorator
    const isExportRoute =
      /^\s*@(?:Get|Post|Put)\s*\(/.test(line) && EXPORT_ROUTE_KEYWORDS.some((kw) => line.includes(kw));

    if (isExportRoute) {
      // 向后取最多 30 行作为方法上下文
      const contextLines = lines.slice(i, Math.min(i + 30, lines.length));
      methods.push({
        startLine: i + 1,
        routeLine: line.trim().slice(0, 100),
        context: contextLines.join('\n'),
      });
    }
  }

  return methods;
}

export function hasProtection(context) {
  return PROTECTION_SIGNALS.some((p) => p.test(context));
}

function collectControllerFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectControllerFiles(full));
    } else if (entry.name.endsWith('.controller.ts') && !isExcludedFile(full)) {
      result.push(full);
    }
  }

  return result;
}

export function checkExportLimits({ dir = BACKEND_SRC } = {}) {
  const files = collectControllerFiles(dir);
  const fileViolations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const methods = extractExportMethods(content);

    const violations = methods
      .filter((m) => !hasProtection(m.context))
      .map((m) => ({
        line: m.startLine,
        route: m.routeLine,
        message: '导出接口缺少 limit/count 保护或异步任务路径',
      }));

    if (violations.length > 0) {
      const relative = path.relative(root, filePath).replace(/\\/g, '/');
      fileViolations.push({ file: relative, violations });
    }
  }

  return { scanned: files.length, fileViolations };
}

export function main() {
  console.log('--- Export Limits 扫描 ---');

  const { scanned, fileViolations } = checkExportLimits();
  console.log(`扫描控制器数: ${scanned}`);

  if (fileViolations.length === 0) {
    console.log('✓ 所有导出接口均具备保护措施（或无导出接口）');
    return { ok: true, warnings: 0 };
  }

  let total = 0;
  for (const { file, violations } of fileViolations) {
    for (const v of violations) {
      console.warn(`  ⚠ ${file}:${v.line}  ${v.route}`);
      console.warn(`    → ${v.message}`);
      total++;
    }
  }

  console.warn(`\n⚠ 发现 ${total} 个疑似无保护的导出接口（当前为 warn-only，不阻断构建）`);
  return { ok: true, warnings: total };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
