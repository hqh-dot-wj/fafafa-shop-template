import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ensureAdminGeneratedRoutes,
  filterDiagnosticsByTargetFiles,
  getAdminGeneratedRouteFiles,
  hasRequiredAdminGeneratedRoutes,
  loadAdminViewTypeReport,
  main,
  parseVueTscDiagnostics,
} from './check-admin-view-types.mjs';

test('parseVueTscDiagnostics 能解析相对路径与绝对路径诊断', () => {
  const output = [
    'src/views/marketing/course-group/team/index.vue(12,7): error TS2322: foo',
    'C:/VueProject/Nest-Admin-Soybean/apps/admin-web/src/views/system/user/index.vue(18,3): error TS7006: bar',
  ].join('\n');

  assert.deepEqual(parseVueTscDiagnostics(output), [
    {
      filePath: 'apps/admin-web/src/views/marketing/course-group/team/index.vue',
      line: 12,
      column: 7,
      message: 'foo',
    },
    {
      filePath: 'apps/admin-web/src/views/system/user/index.vue',
      line: 18,
      column: 3,
      message: 'bar',
    },
  ]);
});

test('filterDiagnosticsByTargetFiles 只保留目标文件诊断', () => {
  const diagnostics = [
    {
      filePath: 'apps/admin-web/src/views/marketing/course-group/team/index.vue',
      line: 12,
      column: 7,
      message: 'foo',
    },
    {
      filePath: 'apps/admin-web/src/views/system/user/index.vue',
      line: 18,
      column: 3,
      message: 'bar',
    },
  ];

  assert.deepEqual(filterDiagnosticsByTargetFiles(diagnostics, ['apps/admin-web/src/views/system/user/index.vue']), [
    diagnostics[1],
  ]);
});

test('loadAdminViewTypeReport 只报告目标 views 文件的原生 vue-tsc 诊断', () => {
  const targetFile = 'apps/admin-web/src/views/marketing/course-group/team/index.vue';
  const report = loadAdminViewTypeReport({
    mode: 'branch',
    files: [targetFile],
    resolveTargetFilesFn: () => [targetFile],
    runVueTscFn: () => ({
      ok: false,
      output: [
        'src/views/marketing/course-group/team/index.vue(10,3): error TS2322: team error',
        'src/views/system/user/index.vue(20,9): error TS2345: user error',
      ].join('\n'),
    }),
  });

  assert.equal(report.vueTscOk, false);
  assert.deepEqual(report.targetFiles, [targetFile]);
  assert.equal(report.ignoredDiagnostics, 1);
  assert.deepEqual(report.diagnostics, [
    {
      filePath: targetFile,
      line: 10,
      column: 3,
      message: 'team error',
    },
  ]);
});

test('ensureAdminGeneratedRoutes 在生成文件缺失时触发路由生成', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-view-types-'));
  const calls = [];

  try {
    const generated = ensureAdminGeneratedRoutes(workspaceRoot, (command, args, options) => {
      calls.push({ command, args, options });
      return '';
    });

    assert.equal(generated, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'pnpm');
    assert.deepEqual(calls[0].args, ['--filter', '@apps/admin-web', 'generate:elegant-routes']);
    assert.equal(calls[0].options.cwd, workspaceRoot);
    const routesFile = path.join(workspaceRoot, 'apps/admin-web/src/router/elegant/routes.ts');
    assert.equal(fs.existsSync(routesFile), false);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('ensureAdminGeneratedRoutes 在生成文件齐全时跳过路由生成', () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-view-types-'));
  let calls = 0;

  try {
    for (const filePath of getAdminGeneratedRouteFiles(workspaceRoot)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, '// generated\n');
    }

    assert.equal(hasRequiredAdminGeneratedRoutes(workspaceRoot), true);
    const generated = ensureAdminGeneratedRoutes(workspaceRoot, () => {
      calls += 1;
      return '';
    });

    assert.equal(generated, false);
    assert.equal(calls, 0);
  } finally {
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('main 在无目标文件时直接通过', () => {
  const result = main(['node', 'check-admin-view-types.mjs', '--files', 'apps/backend/src/main.ts']);
  assert.equal(result.ok, true);
  assert.deepEqual(result.report.targetFiles, []);
});
