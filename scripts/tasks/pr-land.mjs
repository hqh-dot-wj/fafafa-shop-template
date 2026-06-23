#!/usr/bin/env node
/**
 * Squash-merge current branch PR and delete remote head branch (requires gh CLI).
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: repoRoot, encoding: 'utf8', stdio: opts.stdio ?? 'pipe', ...opts });
}

function parseArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const prFlag = argv.find((a) => a.startsWith('--pr='));
  const prNumber = prFlag ? prFlag.split('=')[1] : null;
  const current = argv.includes('--current');
  return { dryRun, prNumber, current };
}

function resolvePrNumber(explicit, useCurrent) {
  if (explicit) return explicit;
  if (!useCurrent) {
    throw new Error('Specify --current or --pr=<number>');
  }
  const json = run('gh pr view --json number,state,title,headRefName,baseRefName');
  const pr = JSON.parse(json);
  if (!pr?.number) {
    throw new Error('No PR found for current branch');
  }
  return String(pr.number);
}

export function main(argv = process.argv.slice(2)) {
  const { dryRun, prNumber: explicit, current } = parseArgs(argv);

  try {
    run('gh --version');
  } catch {
    console.error('gh CLI not found. Install GitHub CLI and authenticate: gh auth login');
    return 1;
  }

  let prNumber;
  try {
    prNumber = resolvePrNumber(explicit, current || !explicit);
  } catch (error) {
    console.error(error.message);
    return 1;
  }

  const view = JSON.parse(run(`gh pr view ${prNumber} --json number,state,mergeable,title,headRefName,baseRefName`));
  console.log(`PR #${view.number}: ${view.title}`);
  console.log(`  ${view.headRefName} -> ${view.baseRefName}  state=${view.state}  mergeable=${view.mergeable}`);

  if (view.state !== 'OPEN') {
    console.error(`PR is not OPEN (state=${view.state})`);
    return 1;
  }

  if (dryRun) {
    console.log('\n[dry-run] would run:');
    console.log(`  gh pr merge ${prNumber} --squash --delete-branch`);
    return 0;
  }

  run(`gh pr merge ${prNumber} --squash --delete-branch`, { stdio: 'inherit' });
  console.log(`\nMerged PR #${prNumber} and deleted remote head branch (if repo settings allow).`);
  console.log('Local: git fetch -p && git checkout main && git pull');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
