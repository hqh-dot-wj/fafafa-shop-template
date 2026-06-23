import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const scripts = pkg.scripts ?? {};

const forbiddenExact = new Set([
  'format:changed',
  'lint:changed',
  'check:micro',
  'check:slice:backend',
  'check:slice:admin',
  'check:slice:h5',
  'report:strict:admin',
  'report:strict:h5',
]);

const stableExact = new Set([
  'dev',
  'build',
  'lint',
  'typecheck',
  'test',
  'verify',
  'generate-types',
  'fix:changed',
  'check:slice',
  'ci:local',
  'ci:local:backend',
  'report:strict',
  'verify:scripts',
  'verify-monorepo',
  'prepare',
  'commitlint',
]);

const stablePatterns = [
  /^(dev|build):(backend|admin|h5|mp|c-web)$/,
  /^(lint|typecheck|check):(backend|admin|h5|c-web)$/,
  /^test:(backend|admin|scripts)$/,
  /^contracts:[a-z0-9-]+$/,
  /^verify:(dict-governance|quality-gates|quality-gates:staged|admin-view-types|admin-view-types:staged|pre-push|repo-artifacts|repo-artifacts:staged|contract-exceptions|spec-drift|agents-consistency|openapi-fresh|forwardref-reason)$/,
  /^report:quality-gates$/,
  /^harness:(doctor|docs|maps|manifest|manifest:check|smoke|smoke:backend|smoke:admin|smoke:h5|impact|cutover-due|plan-stale)$/,
  /^pr:land$/,
  /^verify:pre-push:full$/,
  /^eval:phase$/,
  /^verify:pr-slice$/,
];

const bannedPatterns = [/^ledger:/, /^monitoring:/, /^test:marketing-/, /^verify:menu-orphans$/, /^lint:frontend$/];

export function validateScripts(scriptMap) {
  const violations = [];

  for (const name of Object.keys(scriptMap)) {
    if (forbiddenExact.has(name)) {
      violations.push(`${name}: explicitly forbidden root script; use fix:changed/check:slice/report:strict instead.`);
      continue;
    }

    if (bannedPatterns.some((pattern) => pattern.test(name))) {
      violations.push(`${name}: domain, ops, or redundant scope command must not live in root package.json.`);
      continue;
    }

    if (stableExact.has(name) || stablePatterns.some((pattern) => pattern.test(name))) {
      continue;
    }

    violations.push(
      `${name}: root scripts are public API; move implementation to scripts/tasks/*.mjs or an app package.`,
    );
  }

  return violations;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const violations = validateScripts(scripts);

  if (violations.length > 0) {
    console.error('Package scripts governance violations:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('Package scripts governance passed.');
}
