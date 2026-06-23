import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  HARNESS_FILE_CHECKS,
  REQUIRED_ROOT_SCRIPTS,
  VALIDATION_ROUTE_HINTS,
  createHarnessDoctorReport,
} from './harness-doctor.mjs';
import { REQUIRED_DOCS } from './check-required-docs.mjs';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(filePath, content = '') {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function withWorkspace(setup, assertion) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-doctor-'));
  try {
    setup(tmpDir);
    assertion(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function createRootPackage(overrides = {}) {
  return {
    packageManager: 'pnpm@10.5.0',
    engines: {
      node: '>=20.19.0',
      pnpm: '>=10.5.0',
    },
    scripts: Object.fromEntries(REQUIRED_ROOT_SCRIPTS.map(scriptName => [scriptName, `echo ${scriptName}`])),
    ...overrides,
  };
}

function createRequiredFiles(rootDir, excluded = []) {
  for (const docPath of REQUIRED_DOCS) {
    if (!excluded.includes(docPath)) {
      writeFile(path.join(rootDir, docPath));
    }
  }
  writeFile(path.join(rootDir, 'apps/backend/public/openApi.json'), '{}');
  writeFile(path.join(rootDir, 'apps/admin-web/playwright.config.ts'));
  writeFile(path.join(rootDir, 'apps/admin-web/e2e/smoke.spec.ts'));
  writeFile(path.join(rootDir, 'apps/backend/test/jest-e2e.json'), '{}');
  writeFile(path.join(rootDir, 'apps/miniapp-client/vitest.config.ts'));
  writeFile(path.join(rootDir, 'docker-compose.monitoring.yml'));
}

test('createHarnessDoctorReport passes when required context and root harness scripts exist', () => {
  withWorkspace(
    tmpDir => {
      writeJson(path.join(tmpDir, 'package.json'), createRootPackage());
      createRequiredFiles(tmpDir);
    },
    tmpDir => {
      const report = createHarnessDoctorReport(tmpDir, {
        nodeVersion: '20.19.0',
        pnpmVersion: '10.5.0',
      });

      assert.equal(report.ok, true);
      assert.equal(report.summary.fail, 0);
    },
  );
});

test('createHarnessDoctorReport fails when a required AGENTS map is missing', () => {
  withWorkspace(
    tmpDir => {
      writeJson(path.join(tmpDir, 'package.json'), createRootPackage());
      createRequiredFiles(tmpDir, ['libs/AGENTS.md']);
    },
    tmpDir => {
      const report = createHarnessDoctorReport(tmpDir, {
        nodeVersion: '20.19.0',
        pnpmVersion: '10.5.0',
      });

      assert.equal(report.ok, false);
      assert.equal(report.checks.some(check => check.level === 'fail' && check.name === 'libs/AGENTS.md'), true);
    },
  );
});

test('createHarnessDoctorReport fails when root harness command is not wired', () => {
  withWorkspace(
    tmpDir => {
      const pkg = createRootPackage();
      delete pkg.scripts['harness:doctor'];
      writeJson(path.join(tmpDir, 'package.json'), pkg);
      createRequiredFiles(tmpDir);
    },
    tmpDir => {
      const report = createHarnessDoctorReport(tmpDir, {
        nodeVersion: '20.19.0',
        pnpmVersion: '10.5.0',
      });

      assert.equal(report.ok, false);
      assert.equal(
        report.checks.some(check => check.level === 'fail' && check.name === 'package.json script:harness:doctor'),
        true,
      );
    },
  );
});

test('VALIDATION_ROUTE_HINTS includes admin-web views special gate', () => {
  assert.deepEqual(
    VALIDATION_ROUTE_HINTS.find(hint => hint.match === 'apps/admin-web/src/views/**')?.commands,
    ['pnpm typecheck:admin', 'pnpm verify:admin-view-types'],
  );
});

test('OpenAPI contract hints use dev server refresh before type generation', () => {
  const openApiFix = HARNESS_FILE_CHECKS.find(check => check.path === 'apps/backend/public/openApi.json')?.fix ?? '';
  assert.match(openApiFix, /pnpm dev:backend/);
  assert.match(openApiFix, /contracts:generate/);
  assert.match(openApiFix, /@apps\/backend:build/);
  assert.match(openApiFix, /pnpm\.cmd/);
  assert.doesNotMatch(openApiFix, /build:backend/);

  const libsHintCommands = VALIDATION_ROUTE_HINTS.find(hint => hint.match === 'libs/**')?.commands ?? [];
  assert.equal(libsHintCommands.some(command => command.includes('pnpm dev:backend')), true);
  assert.equal(libsHintCommands.some(command => command.includes('@apps/backend:build')), true);
  assert.equal(libsHintCommands.some(command => command.includes('build:backend')), false);

  const openApiHintCommands = VALIDATION_ROUTE_HINTS.find(
    hint => hint.match === 'apps/backend/public/openApi.json',
  )?.commands ?? [];
  assert.equal(openApiHintCommands.some(command => command.includes('pnpm.cmd')), true);
});
