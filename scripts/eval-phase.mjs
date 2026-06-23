#!/usr/bin/env node
/**
 * 程序性 Phase Evaluator：重跑 plan DoD 命令、审计 diff 范围、检查验证记录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { analyzeExecPlanPresence, changedFilesAgainstBase } from './check-exec-plan-presence.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/**
 * @param {string} content
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return {};
  }

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.+)$/);
    if (kv) {
      data[kv[1]] = kv[2].trim();
    }
  }
  return data;
}

/**
 * @param {string} content
 * @param {number} phase
 */
export function extractPhaseSection(content, phase) {
  const heading = new RegExp(`^### Phase ${phase}[\\s—-]`, 'm');
  const start = content.search(heading);
  if (start < 0) {
    return '';
  }

  const rest = content.slice(start);
  const next = rest.slice(1).search(/^### Phase \d+|^## \d+\./m);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/**
 * @param {string} section
 * @returns {string[]}
 */
export function extractCommands(section) {
  const commands = new Set();
  const patterns = [/`((?:pnpm|node)\s[^`]+)`/g, /-\s*\[[ xX]\]\s*`((?:pnpm|node)\s[^`]+)`/g];

  for (const pattern of patterns) {
    for (const match of section.matchAll(pattern)) {
      commands.add(match[1].trim());
    }
  }

  return [...commands];
}

/**
 * @param {string} section
 * @returns {string[]}
 */
export function extractScopePrefixes(section) {
  const prefixes = new Set();
  const bulletLines = section.match(/^- \*\*范围\*\*：(.+)$/m);
  if (!bulletLines) {
    return [];
  }

  const raw = bulletLines[1];
  for (const token of raw.split(/[、,；;]/)) {
    const cleaned = token.trim().replace(/^`|`$/g, '');
    if (cleaned.includes('/') || cleaned.includes('*')) {
      prefixes.add(cleaned.replace(/\*\*$/, '').replace(/\*$/g, ''));
    }
  }
  return [...prefixes];
}

function quoteForCmd(arg) {
  if (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(arg)) {
    return arg;
  }
  return `"${arg.replaceAll('"', '\\"')}"`;
}

/**
 * @param {string} commandLine
 */
export function runDoDCommand(commandLine) {
  const parts = commandLine.trim().split(/\s+/);
  const executable = parts[0] === 'pnpm' ? pnpm : parts[0];
  const args = parts[0] === 'pnpm' ? parts.slice(1) : parts.slice(1);

  let invocation;
  if (process.platform === 'win32' && String(executable).endsWith('.cmd')) {
    invocation = {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', [executable, ...args].map(quoteForCmd).join(' ')],
    };
  } else {
    invocation = { command: executable, args };
  }

  const result = spawnSync(invocation.command, invocation.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });

  return {
    command: commandLine,
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * @param {string[]} changedFiles
 * @param {string[]} scopePrefixes
 */
export function findOutOfScopeFiles(changedFiles, scopePrefixes) {
  if (scopePrefixes.length === 0) {
    return [];
  }

  return changedFiles.filter((file) => {
    return !scopePrefixes.some((prefix) => {
      const normalized = prefix.replaceAll('\\', '/');
      return file.startsWith(normalized) || file.includes(normalized.replace(/\*\*/g, ''));
    });
  });
}

/**
 * @param {string} planPath
 * @param {{ phase?: number, baseRef?: string, rootDir?: string }} [options]
 */
export function evaluatePhase(planPath, options = {}) {
  const rootDir = options.rootDir ?? repoRoot;
  const absolutePlan = path.isAbsolute(planPath) ? planPath : path.join(rootDir, planPath);
  const content = fs.readFileSync(absolutePlan, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const phase = options.phase ?? Number.parseInt(String(frontmatter.current_phase ?? '0'), 10);
  const section = extractPhaseSection(content, phase);
  const issues = [];
  const commandResults = [];

  if (!section) {
    issues.push({ level: 'fail', message: `Phase ${phase} section not found in plan` });
    return { ok: false, phase, issues, commandResults };
  }

  const pathType = String(frontmatter.path_type ?? '');
  const commands = extractCommands(section).filter((command) => !/\beval:phase\b/.test(command));
  if (commands.length === 0) {
    issues.push({
      level: 'warn',
      message: `Phase ${phase} has no runnable pnpm/node commands in DoD; add backtick commands or run verify manually`,
    });
  } else {
    for (const command of commands) {
      const result = runDoDCommand(command);
      commandResults.push(result);
      if (result.exitCode !== 0) {
        issues.push({ level: 'fail', message: `DoD command failed (${result.exitCode}): ${command}` });
      }
    }
  }

  const baseRef = options.baseRef ?? 'origin/main';
  const changedFiles = changedFilesAgainstBase(baseRef);
  const scopePrefixes = extractScopePrefixes(section);
  const governancePrefixes = [
    'docs/',
    'scripts/',
    '.codex/',
    '.cursor/',
    '.github/',
    'AGENTS.md',
    'CLAUDE.md',
    'package.json',
    'eslint.config.mjs',
  ];
  const scopeAuditFiles = changedFiles.filter(
    (file) => file.startsWith('apps/') || file.startsWith('libs/') || file.startsWith('scripts/'),
  );
  const outOfScope = pathType === 'doc-only' ? [] : findOutOfScopeFiles(scopeAuditFiles, scopePrefixes);
  if (pathType !== 'doc-only' && scopePrefixes.length > 0 && outOfScope.length > 0) {
    issues.push({
      level: 'fail',
      message: `Diff contains ${outOfScope.length} file(s) outside Phase scope`,
      files: outOfScope.slice(0, 20),
    });
  }

  const execPlanReport = analyzeExecPlanPresence(changedFiles, { rootDir });
  if (execPlanReport.level === 'warn') {
    issues.push({ level: 'warn', message: execPlanReport.message });
  }

  const failCount = issues.filter((item) => item.level === 'fail').length;
  return {
    ok: failCount === 0,
    phase,
    planPath: path.relative(rootDir, absolutePlan),
    commandResults,
    changedFileCount: changedFiles.length,
    issues,
  };
}

function writeEvalLog(planPath, report) {
  const logPath = `${planPath}.eval-log.json`;
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        evaluatedAt: new Date().toISOString(),
        ...report,
      },
      null,
      2,
    ),
  );
  return logPath;
}

export function main(argv = process.argv.slice(2), rootDir = repoRoot) {
  const json = argv.includes('--json');
  const planFlagIndex = argv.findIndex((arg) => arg === '--plan');
  const phaseFlagIndex = argv.findIndex((arg) => arg === '--phase');

  if (planFlagIndex < 0 || !argv[planFlagIndex + 1]) {
    console.error('Usage: node scripts/eval-phase.mjs --plan docs/exec-plans/active/<id>.md [--phase N] [--json]');
    return 1;
  }

  const planPath = argv[planFlagIndex + 1];
  const phase =
    phaseFlagIndex >= 0 && argv[phaseFlagIndex + 1] ? Number.parseInt(argv[phaseFlagIndex + 1], 10) : undefined;

  const absolutePlan = path.isAbsolute(planPath) ? planPath : path.join(rootDir, planPath);
  const report = evaluatePhase(absolutePlan, { phase, rootDir });
  const logPath = writeEvalLog(absolutePlan, report);

  if (json) {
    console.log(JSON.stringify({ ...report, evalLog: logPath }, null, 2));
  } else {
    console.log(`eval-phase: ${report.ok ? 'OK' : 'FAIL'} | plan=${report.planPath} | phase=${report.phase}`);
    for (const result of report.commandResults) {
      console.log(`  [${result.exitCode === 0 ? 'OK' : 'FAIL'}] ${result.command} → exit ${result.exitCode}`);
    }
    for (const issue of report.issues) {
      console.log(`  [${issue.level.toUpperCase()}] ${issue.message}`);
      if (issue.files) {
        for (const file of issue.files) {
          console.log(`    - ${file}`);
        }
      }
    }
    console.log(`  eval log: ${path.relative(rootDir, logPath)}`);
  }

  return report.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
