#!/usr/bin/env node
/**
 * List marketing (and backend) cutover registry entries past dropAfter (warn-only governance).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const SOURCES = [
  {
    label: 'admin-web marketing-cutover',
    file: 'apps/admin-web/src/router/elegant/marketing-cutover.ts',
  },
  {
    label: 'backend cutover-registry',
    file: 'apps/backend/src/module/marketing/protocol/cutover-registry.ts',
  },
];

function parseDropEntries(filePath, label) {
  const text = fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
  const entries = [];
  const blockRe =
    /routeName:\s*['"]([^'"]+)['"][\s\S]*?phase:\s*['"]([^'"]+)['"][\s\S]*?dropAfter:\s*['"](\d{4}-\d{2}-\d{2})['"]/g;
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    entries.push({
      source: label,
      routeName: match[1],
      phase: match[2],
      dropAfter: match[3],
      file: filePath,
    });
  }
  return entries;
}

export function findDueEntries(today = new Date()) {
  const todayStr = today.toISOString().slice(0, 10);
  const all = SOURCES.flatMap((s) => parseDropEntries(s.file, s.label));
  return all.filter((e) => e.dropAfter <= todayStr);
}

export function main() {
  const due = findDueEntries();
  if (due.length === 0) {
    console.log('No cutover entries past dropAfter (OK).');
    return 0;
  }

  console.warn(`[harness:cutover-due] ${due.length} entries at or past dropAfter:\n`);
  for (const e of due) {
    console.warn(`  - ${e.routeName} (${e.phase}) dropAfter=${e.dropAfter}  [${e.source}]`);
  }
  console.warn('\nSee .codex/playbooks/module-retirement.md — remove via dedicated PR (tests first).');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
