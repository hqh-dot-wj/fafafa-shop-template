#!/usr/bin/env node
/**
 * check-agents-consistency
 *
 * 扫描规则正文（AGENTS.md / .codex/playbooks / docs/governance），
 * 对高频概念做"单文件出现次数"检测。
 * 超过阈值即提示潜在重复，建议改为引用 canonical。
 *
 * 当前为 warn-only：永远 exit 0；命中阈值打印警告。
 * 误报率稳定后再考虑升级阻塞。
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** 受管控的规则正文文件清单。
 *  AGENT_OUTPUT_TEMPLATES.md 是模板正文，自身就含 30 个模板的"高风险/契约"语义，不参与重复检测。 */
export const RULE_FILES = [
  'AGENTS.md',
  'CLAUDE.md',
  '.claude/CLAUDE.md',
  'apps/backend/AGENTS.md',
  'apps/backend/prisma/AGENTS.md',
  'apps/admin-web/AGENTS.md',
  'apps/miniapp-client/AGENTS.md',
  'libs/AGENTS.md',
  'scripts/AGENTS.md',
  'docs/AGENTS.md',
  'docs/delivery/AGENTS.md',
  'docs/delivery/README.md',
  '.codex/playbooks/AGENTS.md',
  '.codex/playbooks/context-scan.md',
  '.codex/playbooks/backend-safe-change.md',
  '.codex/playbooks/admin-web-module-change.md',
  '.codex/playbooks/miniapp-page-change.md',
  '.codex/playbooks/dict-and-job-change.md',
  '.codex/playbooks/verification-gates.md',
  '.codex/playbooks/review-mode.md',
  '.codex/playbooks/doc-request-flow.md',
  '.codex/playbooks/co-evolution-checklist.md',
  '.codex/playbooks/session-orchestration.md',
  '.codex/playbooks/large-refactor.md',
  'docs/governance/AGENT_OUTPUT_PROTOCOL.md',
  'docs/governance/AGENT_OUTPUT_PROTOCOL_EXAMPLES.md',
  'docs/governance/DOCUMENT_POLICY.md',
  'docs/governance/ERROR_OBSERVABILITY_STANDARD.md',
  'docs/governance/HARNESS_ENGINEERING.md',
  'docs/governance/HARNESS_ROADMAP.md',
  'docs/governance/HARNESS_AUDIT.md',
  'docs/governance/HIGH_RISK_REGISTRY.md',
  'docs/governance/TEST_SPEC_PROTOCOL.md',
  'docs/governance/ENGINEERING_CONSTITUTION.md',
  'docs/governance/MONEY_PRECISION_PROTOCOL.md',
  'docs/exec-plans/README.md',
  'docs/exec-plans/templates/PLAN.md',
  'docs/exec-plans/templates/HANDOFF.md',
  'docs/quality-attributes/matrix.yml',
];

/** 高频概念检测规则。
 *  pattern: 正则；threshold: 单文件命中次数超过则视为潜在重复。
 *  根 AGENTS / 中心位置允许更高阈值（authoritative source）。 */
const CONCEPT_RULES = [
  { name: '高风险', pattern: /高风险/g, defaultThreshold: 8, sourceFiles: ['AGENTS.md'], sourceThreshold: 30 },
  {
    name: '验证矩阵|证据等级',
    pattern: /验证矩阵|证据等级/g,
    defaultThreshold: 3,
    sourceFiles: ['AGENTS.md', '.codex/playbooks/verification-gates.md'],
    sourceThreshold: 15,
  },
  {
    name: 'AGENT_OUTPUT_PROTOCOL|输出协议',
    pattern: /AGENT_OUTPUT_PROTOCOL|输出协议/g,
    defaultThreshold: 4,
    sourceFiles: ['docs/governance/AGENT_OUTPUT_PROTOCOL.md', 'docs/governance/AGENT_OUTPUT_PROTOCOL_EXAMPLES.md'],
    sourceThreshold: 30,
  },
  {
    name: '停手确认|高风险确认',
    pattern: /停手确认|高风险确认/g,
    defaultThreshold: 4,
    sourceFiles: ['AGENTS.md', 'CLAUDE.md'],
    sourceThreshold: 15,
  },
];

export function countConcept(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

export function analyzeFile(file, content) {
  const findings = [];
  for (const rule of CONCEPT_RULES) {
    rule.pattern.lastIndex = 0;
    const count = countConcept(content, new RegExp(rule.pattern.source, 'g'));
    const threshold = rule.sourceFiles.includes(file) ? rule.sourceThreshold : rule.defaultThreshold;
    if (count > threshold) {
      findings.push({ concept: rule.name, count, threshold, isSource: rule.sourceFiles.includes(file) });
    }
  }
  return findings;
}

export function analyzeAll(repoRootPath, ruleFiles = RULE_FILES) {
  const report = [];
  for (const file of ruleFiles) {
    const abs = path.join(repoRootPath, file);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, 'utf-8');
    const findings = analyzeFile(file, content);
    if (findings.length > 0) {
      report.push({ file, findings });
    }
  }
  return report;
}

function main() {
  const report = analyzeAll(repoRoot);
  if (report.length === 0) {
    console.log('[check-agents-consistency] OK — 未发现单文件概念超阈值');
    process.exit(0);
  }
  console.warn('[check-agents-consistency] 警告：以下文件高频概念超阈值，建议改为引用 canonical：\n');
  for (const entry of report) {
    console.warn(`  ${entry.file}`);
    for (const f of entry.findings) {
      const tag = f.isSource ? '[源]' : '';
      console.warn(`    - ${f.concept}: ${f.count} 次（阈值 ${f.threshold}）${tag}`);
    }
  }
  console.warn('\n提示：当前为 warn-only，不阻断构建。Phase 4 落地后 4 周观察误报率，再考虑升级阻塞。');
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-agents-consistency.mjs')) {
  main();
}
