#!/usr/bin/env node
/**
 * Heuristic domain impact scan (paths under repo, grouped for module retirement).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const GROUPS = [
  { id: 'backend-src', label: 'Backend 源码', roots: ['apps/backend/src'] },
  { id: 'prisma', label: 'Prisma', roots: ['apps/backend/prisma'] },
  { id: 'admin-views', label: 'Admin views', roots: ['apps/admin-web/src/views'] },
  {
    id: 'admin-router-api',
    label: 'Admin 路由/API',
    roots: ['apps/admin-web/src/router', 'apps/admin-web/src/service'],
  },
  { id: 'admin-e2e', label: 'Admin E2E', roots: ['apps/admin-web/e2e'] },
  { id: 'miniapp', label: 'Miniapp', roots: ['apps/miniapp-client/src'] },
  { id: 'docs-design', label: '设计对齐', roots: ['docs/design'] },
  { id: 'docs-delivery', label: '交付', roots: ['docs/delivery'] },
  { id: 'libs', label: '共享类型', roots: ['libs'] },
];

function parseArgs(argv) {
  const keywordFlag = argv.find((a) => a.startsWith('--keyword='));
  const moduleFlag = argv.find((a) => a.startsWith('--module='));
  const keyword = keywordFlag?.split('=').slice(1).join('=') ?? null;
  const modulePath = moduleFlag?.split('=').slice(1).join('=') ?? null;
  if (!keyword && !modulePath) {
    throw new Error('Usage: domain-impact.mjs --keyword=<term> | --module=<pathFragment>');
  }
  return { keyword, modulePath };
}

function rgFiles(pattern) {
  try {
    const out = execSync(`git grep -l -i "${pattern.replace(/"/g, '\\"')}" --`, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function classify(filePath) {
  for (const group of GROUPS) {
    if (group.roots.some((root) => filePath.startsWith(root.replace(/\\/g, '/')))) {
      return group;
    }
  }
  return { id: 'other', label: '其它', roots: [] };
}

export function scanImpact({ keyword, modulePath }) {
  const terms = [];
  if (keyword) terms.push(keyword);
  if (modulePath) {
    terms.push(modulePath);
    terms.push(modulePath.replace(/\//g, '-'));
  }

  const files = new Set();
  for (const term of terms) {
    for (const f of rgFiles(term)) {
      files.add(f.replace(/\\/g, '/'));
    }
  }

  const byGroup = new Map();
  for (const file of files) {
    const group = classify(file);
    if (!byGroup.has(group.id)) {
      byGroup.set(group.id, { ...group, files: [] });
    }
    byGroup.get(group.id).files.push(file);
  }

  for (const entry of byGroup.values()) {
    entry.files.sort();
  }

  return { terms, groups: [...byGroup.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

export function formatReport(result) {
  const lines = [`# Domain impact (heuristic)`, ``, `Terms: ${result.terms.join(', ')}`, ``];
  for (const group of result.groups) {
    lines.push(`## ${group.label} (${group.files.length})`);
    for (const file of group.files.slice(0, 80)) {
      lines.push(`- ${file}`);
    }
    if (group.files.length > 80) {
      lines.push(`- ... +${group.files.length - 80} more`);
    }
    lines.push('');
  }
  lines.push('_Scan is heuristic; review before delete. Run module-retirement playbook._');
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = scanImpact(args);
    console.log(formatReport(result));
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
