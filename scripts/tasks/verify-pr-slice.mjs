#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { analyzeExecPlanPresence, changedFilesAgainstBase } from '../check-exec-plan-presence.mjs';
import { formatPrChecklistSuggestions } from './quality-matrix-routes.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function buildPrSliceReport(files = changedFilesAgainstBase()) {
  const execPlan = analyzeExecPlanPresence(files);
  const checklist = formatPrChecklistSuggestions(files);

  return { files, execPlan, checklist };
}

export function main() {
  const report = buildPrSliceReport();

  console.log('PR slice self-check (local simulation)\n');
  console.log(`Changed files vs base: ${report.files.length}`);
  if (report.files.length > 0 && report.files.length <= 30) {
    for (const file of report.files) {
      console.log(`  - ${file}`);
    }
  }

  console.log('');
  console.log(report.checklist);

  console.log('');
  if (report.execPlan.level === 'warn') {
    console.warn(`[exec-plan] ⚠️  ${report.execPlan.message}`);
  } else {
    console.log(`[exec-plan] OK`);
  }

  console.log('\nNext: pnpm check:slice  (SliceOK — does not imply PhaseDone)');
  console.log('Phase gate: pnpm eval:phase --plan docs/exec-plans/active/<TASK-ID>.md');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
