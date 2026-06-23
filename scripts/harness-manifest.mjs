/**
 * Harness 检查项注册表（机器真相源）。
 * 语义规范仍在 HARNESS_ENGINEERING / playbook / matrix；本文件只登记 script、触发与 severity。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULE_FILES } from './tasks/check-agents-consistency.mjs';

export const MANIFEST_VERSION = '1.0.0';
export const EXEC_PLAN_FILE_THRESHOLD = 15;

/** @typedef {'required-doc' | 'index-doc' | 'generated'} ManifestArtifactKind */

/**
 * @typedef {object} ManifestArtifact
 * @property {string} path
 * @property {ManifestArtifactKind} kind
 * @property {string} [when] 何时必读（index-doc）
 */

/** harness-doctor / verify-monorepo 强制存在的上下文文档 */
export const REQUIRED_ARTIFACTS = [
  { path: 'docs/domain/glossary.md', kind: 'required-doc' },
  { path: 'docs/adr/ADR-0001-typescript-strictness.md', kind: 'required-doc' },
  { path: 'docs/adr/ADR-0002-eslint-layering.md', kind: 'required-doc' },
  { path: 'AGENTS.md', kind: 'required-doc' },
  { path: 'CLAUDE.md', kind: 'required-doc' },
  { path: '.claude/CLAUDE.md', kind: 'required-doc' },
  { path: '.cursor/rules/000-entry.mdc', kind: 'required-doc' },
  { path: 'apps/backend/AGENTS.md', kind: 'required-doc' },
  { path: 'apps/backend/prisma/AGENTS.md', kind: 'required-doc' },
  { path: 'apps/admin-web/AGENTS.md', kind: 'required-doc' },
  { path: 'apps/miniapp-client/AGENTS.md', kind: 'required-doc' },
  { path: 'libs/AGENTS.md', kind: 'required-doc' },
  { path: 'scripts/AGENTS.md', kind: 'required-doc' },
  { path: 'docs/AGENTS.md', kind: 'required-doc' },
  { path: 'docs/delivery/AGENTS.md', kind: 'index-doc', when: 'delivery / Feature Pack' },
  { path: 'docs/delivery/README.md', kind: 'index-doc', when: '产品交付与 exec_plan 关联' },
  { path: 'docs/governance/AGENT_OUTPUT_PROTOCOL.md', kind: 'required-doc' },
  { path: 'docs/governance/DOCUMENT_POLICY.md', kind: 'required-doc' },
  { path: 'docs/governance/HARNESS_ENGINEERING.md', kind: 'required-doc' },
  { path: 'docs/governance/HARNESS_ROADMAP.md', kind: 'required-doc' },
  { path: 'docs/governance/TEST_SPEC_PROTOCOL.md', kind: 'required-doc' },
  { path: '.codex/playbooks/AGENTS.md', kind: 'required-doc' },
  { path: '.codex/playbooks/harness-workflow.md', kind: 'index-doc', when: '每次任务默认流程入口' },
  { path: '.codex/playbooks/risk-tiering.md', kind: 'index-doc', when: 'Tier/删除/验证封顶' },
  { path: '.codex/playbooks/module-retirement.md', kind: 'index-doc', when: '模块下线/删目录' },
  { path: 'docs/governance/HARNESS_FRICTION_INVENTORY.md', kind: 'index-doc', when: 'Harness 摩擦减法登记' },
  { path: '.codex/playbooks/context-scan.md', kind: 'index-doc', when: 'cross-app / 大任务扫描' },
  { path: '.codex/playbooks/backend-safe-change.md', kind: 'index-doc', when: 'backend-only' },
  { path: '.codex/playbooks/admin-web-module-change.md', kind: 'index-doc', when: 'admin-web-only' },
  { path: '.codex/playbooks/miniapp-page-change.md', kind: 'index-doc', when: 'miniapp-only' },
  { path: '.codex/playbooks/dict-and-job-change.md', kind: 'index-doc', when: '字典/定时任务' },
  { path: '.codex/playbooks/review-mode.md', kind: 'index-doc', when: 'review-only' },
  { path: '.codex/playbooks/doc-request-flow.md', kind: 'index-doc', when: 'doc-only / 新增文档' },
  { path: 'docs/governance/AGENT_OUTPUT_PROTOCOL_EXAMPLES.md', kind: 'index-doc', when: '输出协议示例' },
  { path: 'docs/governance/HIGH_RISK_REGISTRY.md', kind: 'index-doc', when: '实施/写入命中高风险域' },
  { path: 'docs/governance/ENGINEERING_CONSTITUTION.md', kind: 'index-doc', when: '治理/宪章类改动' },
  { path: 'docs/governance/MONEY_PRECISION_PROTOCOL.md', kind: 'index-doc', when: 'finance/金额/精度' },
  { path: 'docs/governance/ERROR_OBSERVABILITY_STANDARD.md', kind: 'index-doc', when: '日志/指标/可观测性' },
  { path: 'docs/governance/HARNESS_AUDIT.md', kind: 'index-doc', when: 'Harness/基线债务排查' },
  { path: '.codex/playbooks/co-evolution-checklist.md', kind: 'index-doc', when: '改 service/processor/repository' },
  { path: '.codex/playbooks/session-orchestration.md', kind: 'index-doc', when: '大任务/exec-plan/分会话' },
  { path: '.codex/playbooks/large-refactor.md', kind: 'index-doc', when: 'refactor/cross-app 多 Phase' },
  {
    path: '.codex/playbooks/claude-agent-teams.md',
    kind: 'index-doc',
    when: 'Claude Code Agent Teams 并行审查/对抗调试/跨层',
  },
  { path: 'docs/exec-plans/templates/PLAN.md', kind: 'index-doc', when: '新建 active exec-plan' },
  { path: 'docs/exec-plans/templates/HANDOFF.md', kind: 'index-doc', when: '会话结束交接' },
  { path: '.codex/playbooks/verification-gates.md', kind: 'index-doc', when: '验证分层/证据等级/Mock 边界' },
  { path: 'docs/exec-plans/README.md', kind: 'index-doc', when: '大任务/exec-plan（M2 编排 playbook 落地后）' },
  { path: 'docs/quality-attributes/matrix.yml', kind: 'index-doc', when: 'PR 质量属性路由（M3 接线）' },
];

export const REQUIRED_DOCS = REQUIRED_ARTIFACTS.filter((item) => item.kind === 'required-doc').map((item) => item.path);

/**
 * @typedef {'script' | 'human-only' | 'planned'} Enforcement
 */

/**
 * @typedef {object} CheckEntry
 * @property {string} id
 * @property {string} [script]
 * @property {string} [packageScript]
 * @property {string[]} trigger
 * @property {'fail' | 'warn'} severity
 * @property {string} [paths]
 * @property {string} canonicalDoc
 * @property {string} owner
 * @property {Enforcement} enforcement
 * @property {string | null} [track]
 * @property {string | null} [promoteAfter]
 */

/** @type {CheckEntry[]} */
export const CHECK_ENTRIES = [
  {
    id: 'harness-doctor',
    script: 'scripts/harness-doctor.mjs',
    packageScript: 'harness:doctor',
    trigger: ['manual'],
    severity: 'fail',
    paths: 'repo-root',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'harness-manifest',
    script: 'scripts/harness-manifest.mjs',
    packageScript: 'harness:manifest',
    trigger: ['manual', 'harness:doctor'],
    severity: 'warn',
    paths: 'scripts/**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'verify-monorepo',
    script: 'scripts/verify-monorepo.mjs',
    packageScript: 'verify-monorepo',
    trigger: ['verify', 'verify:pre-push'],
    severity: 'fail',
    paths: 'repo-root',
    canonicalDoc: 'scripts/AGENTS.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'verify-scripts',
    script: 'scripts/tasks/package-scripts-governance.mjs',
    packageScript: 'verify:scripts',
    trigger: ['check:slice', 'verify', 'verify:pre-push'],
    severity: 'fail',
    paths: 'scripts/**',
    canonicalDoc: 'scripts/AGENTS.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-slice-router',
    script: 'scripts/tasks/changed-files.mjs',
    packageScript: 'check:slice',
    trigger: ['manual'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-node-blocking-patterns',
    script: 'scripts/check-node-blocking-patterns.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'fail',
    paths: 'apps/backend/src/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-redis-blocking',
    script: 'scripts/check-redis-blocking.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'fail',
    paths: 'apps/backend/src/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-export-limits',
    script: 'scripts/check-export-limits.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'warn',
    paths: 'apps/backend/src/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: '2026-06-19',
  },
  {
    id: 'check-queue-contracts',
    script: 'scripts/check-queue-contracts.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'warn',
    paths: 'apps/backend/src/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-test-spec-coverage',
    script: 'scripts/check-test-spec-coverage.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'warn',
    paths: 'apps/backend/**/*.spec.ts',
    canonicalDoc: 'docs/governance/TEST_SPEC_PROTOCOL.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'worker-topology-doctor',
    script: 'scripts/worker-topology-doctor.mjs',
    packageScript: null,
    trigger: ['check:slice'],
    severity: 'warn',
    paths: 'apps/backend/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-spec-drift',
    script: 'scripts/check-spec-drift.mjs',
    packageScript: 'verify:spec-drift',
    trigger: ['check:slice', 'manual'],
    severity: 'fail',
    paths: 'apps/backend/src/**',
    canonicalDoc: 'docs/governance/TEST_SPEC_PROTOCOL.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-quality-gates',
    script: 'scripts/check-quality-gates.mjs',
    packageScript: 'verify:quality-gates',
    trigger: ['pre-commit', 'verify', 'verify:pre-push'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: 'docs/quality-attributes/QUALITY_ATTRIBUTE_GOVERNANCE.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-admin-view-types',
    script: 'scripts/check-admin-view-types.mjs',
    packageScript: 'verify:admin-view-types',
    trigger: ['pre-commit', 'check:slice', 'verify'],
    severity: 'fail',
    paths: 'apps/admin-web/src/views/**',
    canonicalDoc: 'apps/admin-web/AGENTS.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-dict-governance',
    script: 'scripts/check-dict-governance.mjs',
    packageScript: 'verify:dict-governance',
    trigger: ['manual'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: '.codex/playbooks/dict-and-job-change.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-forwardref-reason',
    script: 'scripts/check-forwardref-reason.mjs',
    packageScript: 'verify:forwardref-reason',
    trigger: ['manual'],
    severity: 'warn',
    paths: 'apps/backend/**/*.module.ts',
    canonicalDoc: 'docs/governance/HARNESS_AUDIT.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-repo-artifacts',
    script: 'scripts/check-repo-artifacts.mjs',
    packageScript: 'verify:repo-artifacts',
    trigger: ['verify', 'verify:pre-push'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: 'scripts/AGENTS.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'check-contract-exceptions',
    script: 'scripts/check-contract-exceptions.mjs',
    packageScript: 'verify:contract-exceptions',
    trigger: ['verify', 'verify:pre-push'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: 'libs/AGENTS.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'verify-agents-consistency',
    script: 'scripts/tasks/check-agents-consistency.mjs',
    packageScript: 'verify:agents-consistency',
    trigger: ['manual'],
    severity: 'warn',
    paths: 'AGENTS.md|.codex/**|docs/governance/**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'agents-hard-rules',
    script: null,
    packageScript: null,
    trigger: ['always'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: 'AGENTS.md',
    owner: 'governance',
    enforcement: 'human-only',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'evidence-levels-mock',
    script: null,
    packageScript: null,
    trigger: ['delivery'],
    severity: 'fail',
    paths: '**',
    canonicalDoc: '.codex/playbooks/verification-gates.md',
    owner: 'governance',
    enforcement: 'human-only',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'eval-phase',
    script: 'scripts/eval-phase.mjs',
    packageScript: 'eval:phase',
    trigger: ['exec-plan-phase-done', 'manual'],
    severity: 'fail',
    paths: 'docs/exec-plans/**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'verify-pr-slice',
    script: 'scripts/tasks/verify-pr-slice.mjs',
    packageScript: 'verify:pr-slice',
    trigger: ['manual', 'pre-push'],
    severity: 'warn',
    paths: '**',
    canonicalDoc: 'docs/quality-attributes/QUALITY_ATTRIBUTE_GOVERNANCE.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'exec-plan-presence',
    script: 'scripts/check-exec-plan-presence.mjs',
    packageScript: null,
    trigger: ['check:slice', 'eval:phase'],
    severity: 'warn',
    paths: 'apps/**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'exec-plan-stale',
    script: 'scripts/check-exec-plan-stale.mjs',
    packageScript: 'harness:plan-stale',
    trigger: ['manual', 'harness:doctor'],
    severity: 'warn',
    paths: 'docs/exec-plans/active/**',
    canonicalDoc: 'docs/governance/HARNESS_ROADMAP.md',
    owner: 'scripts',
    enforcement: 'script',
    track: null,
    promoteAfter: null,
  },
  {
    id: 'harness-boot-backend',
    script: null,
    packageScript: null,
    trigger: ['backend-delivery'],
    severity: 'warn',
    paths: 'apps/backend/**',
    canonicalDoc: 'docs/governance/HARNESS_ENGINEERING.md',
    owner: 'scripts',
    enforcement: 'planned',
    track: 'baseline-hardening',
    promoteAfter: null,
  },
];

/** Git hooks 登记的命令链（非独立 script 条目） */
export const HOOK_CHAINS = [
  {
    id: 'pre-commit',
    hook: 'pre-commit',
    commands: ['lint-staged', 'verify:quality-gates:staged', 'verify:admin-view-types:staged'],
    canonicalDoc: 'package.json#simple-git-hooks',
  },
  {
    id: 'pre-push',
    hook: 'pre-push',
    commands: ['verify:pre-push'],
    canonicalDoc: 'package.json#simple-git-hooks',
  },
  {
    id: 'commit-msg',
    hook: 'commit-msg',
    commands: ['commit-msg'],
    canonicalDoc: 'scripts/check-commit-message.mjs',
  },
];

function exists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

/**
 * @param {string} rootDir
 * @returns {{ missing: string[], present: string[] }}
 */
export function checkRequiredArtifacts(rootDir) {
  const missing = [];
  const present = [];

  for (const artifact of REQUIRED_ARTIFACTS) {
    if (exists(rootDir, artifact.path)) {
      present.push(artifact.path);
    } else if (artifact.kind === 'required-doc') {
      missing.push(artifact.path);
    }
  }

  return { missing, present };
}

/**
 * @param {object} rootPkg
 * @param {CheckEntry} entry
 */
function packageScriptRegistered(rootPkg, entry) {
  if (!entry.packageScript) {
    return true;
  }
  return Boolean(rootPkg?.scripts?.[entry.packageScript]);
}

/**
 * @param {typeof CHECK_ENTRIES[number]} entry
 * @param {Date} [now]
 */
export function effectiveSeverity(entry, now = new Date()) {
  if (entry.severity !== 'warn' || !entry.promoteAfter) {
    return entry.severity;
  }
  const deadline = new Date(`${entry.promoteAfter}T23:59:59.999Z`);
  return now > deadline ? 'fail' : 'warn';
}

/**
 * manifest 仍登记 warn 但 promoteAfter 已过时 → 提醒升级为 fail（阶段 6 GC）。
 * @param {Date} [now]
 */
export function collectPromoteAfterIssues(now = new Date()) {
  const issues = [];
  for (const entry of CHECK_ENTRIES) {
    if (entry.severity !== 'warn' || !entry.promoteAfter) {
      continue;
    }
    if (effectiveSeverity(entry, now) !== 'fail') {
      continue;
    }
    issues.push({
      level: 'warn',
      id: `promote-after:${entry.id}`,
      message: `promoteAfter ${entry.promoteAfter} passed; bump CHECK_ENTRIES severity warn→fail for ${entry.id}`,
    });
  }
  return issues;
}

/**
 * @param {string} rootDir
 * @param {{ strict?: boolean }} [options]
 */
export function validateManifest(rootDir, options = {}) {
  const rootPackagePath = path.join(rootDir, 'package.json');
  const rootPkg = fs.existsSync(rootPackagePath) ? JSON.parse(fs.readFileSync(rootPackagePath, 'utf8')) : null;
  const issues = [];

  for (const entry of CHECK_ENTRIES) {
    if (entry.enforcement === 'planned') {
      continue;
    }
    if (entry.script && !exists(rootDir, entry.script)) {
      issues.push({
        level: 'fail',
        id: entry.id,
        message: `script missing: ${entry.script}`,
      });
    }
    if (entry.packageScript && !packageScriptRegistered(rootPkg, entry)) {
      issues.push({
        level: 'fail',
        id: entry.id,
        message: `package.json script missing: ${entry.packageScript}`,
      });
    }
  }

  const artifactPaths = new Set(REQUIRED_ARTIFACTS.map((artifact) => artifact.path));
  const ruleOnly = RULE_FILES.filter((filePath) => !artifactPaths.has(filePath) && exists(rootDir, filePath));
  const indexOnly = REQUIRED_ARTIFACTS.filter(
    (artifact) =>
      artifact.kind === 'index-doc' && !RULE_FILES.includes(artifact.path) && exists(rootDir, artifact.path),
  ).map((artifact) => artifact.path);

  for (const filePath of ruleOnly) {
    issues.push({
      level: 'warn',
      id: 'index-drift',
      message: `in RULE_FILES but not REQUIRED_DOCS (consider index-doc): ${filePath}`,
    });
  }

  for (const filePath of indexOnly) {
    issues.push({
      level: 'warn',
      id: 'index-drift',
      message: `index-doc not in RULE_FILES (consistency scan may miss): ${filePath}`,
    });
  }

  issues.push(...collectPromoteAfterIssues());

  const failCount = issues.filter((item) => item.level === 'fail').length;
  const warnCount = issues.filter((item) => item.level === 'warn').length;

  return {
    ok: failCount === 0,
    summary: { fail: failCount, warn: warnCount },
    issues,
    checkCount: CHECK_ENTRIES.length,
    requiredDocCount: REQUIRED_DOCS.length,
  };
}

function pad(value, width) {
  const text = String(value);
  return text.length >= width ? text : `${text}${' '.repeat(width - text.length)}`;
}

export function formatManifestTable() {
  const lines = [
    `Harness manifest v${MANIFEST_VERSION} | EXEC_PLAN_FILE_THRESHOLD=${EXEC_PLAN_FILE_THRESHOLD}`,
    '',
    pad('ID', 32) + pad('SEV', 6) + pad('TRIGGER', 28) + 'SCRIPT / ENFORCEMENT',
    '-'.repeat(100),
  ];

  for (const entry of CHECK_ENTRIES) {
    const scriptCol =
      entry.enforcement === 'planned'
        ? `(planned:${entry.track ?? 'TBD'})`
        : entry.enforcement === 'human-only'
          ? `(human-only→${entry.canonicalDoc})`
          : (entry.script ?? '-');
    const sev =
      entry.promoteAfter && effectiveSeverity(entry) !== entry.severity
        ? `${entry.severity}→${effectiveSeverity(entry)}`
        : entry.severity;
    const promoteHint = entry.promoteAfter ? ` (promote ${entry.promoteAfter})` : '';
    lines.push(pad(entry.id, 32) + pad(sev, 6) + pad(entry.trigger.join(','), 28) + scriptCol + promoteHint);
  }

  lines.push('', 'Required docs:', REQUIRED_DOCS.join(', '));
  return lines.join('\n');
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function main(argv = process.argv.slice(2), rootDir = repoRoot) {
  const check = argv.includes('--check');
  const json = argv.includes('--json');
  const report = validateManifest(rootDir, { strict: check });

  if (json) {
    console.log(
      JSON.stringify(
        {
          version: MANIFEST_VERSION,
          execPlanFileThreshold: EXEC_PLAN_FILE_THRESHOLD,
          requiredDocs: REQUIRED_DOCS,
          checks: CHECK_ENTRIES,
          hooks: HOOK_CHAINS,
          validation: report,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatManifestTable());
    if (report.issues.length > 0) {
      console.log('\nValidation:');
      for (const issue of report.issues) {
        console.log(`[${issue.level.toUpperCase()}] ${issue.id}: ${issue.message}`);
      }
    } else {
      console.log('\nValidation: OK (registered scripts and package scripts)');
    }
  }

  if (check && !report.ok) {
    return 1;
  }
  return 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
