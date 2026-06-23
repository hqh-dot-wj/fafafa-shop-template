import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  EVENT_LOOP_SMOKE_PROBE_COUNT,
  EVENT_LOOP_SMOKE_THRESHOLD_MS,
  createHarnessSmokeReport,
  measureEventLoopSmoke,
} from './harness-smoke.mjs';

async function withWorkspace(setup, assertion) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-smoke-'));
  try {
    setup(tmpDir);
    return await assertion(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

test('createHarnessSmokeReport resolves backend URL from admin-web env file', async () => {
  await withWorkspace(
    (tmpDir) => {
      writeFile(path.join(tmpDir, 'apps/admin-web/.env.development'), 'VITE_SERVICE_BASE_URL=http://localhost:18080\n');
    },
    async (tmpDir) => {
      const requestedUrls = [];
      const report = await createHarnessSmokeReport(tmpDir, {
        argv: ['--backend'],
        fetchFn: async (url) => {
          requestedUrls.push(url);
          return { status: 200 };
        },
      });

      assert.equal(report.summary.ok, 1);
      assert.deepEqual(requestedUrls, ['http://localhost:18080/api/health/liveness']);
    },
  );
});

test('createHarnessSmokeReport resolves miniapp H5 port from env file', async () => {
  await withWorkspace(
    (tmpDir) => {
      writeFile(path.join(tmpDir, 'apps/miniapp-client/.env'), 'VITE_APP_PORT = 19000\n');
    },
    async (tmpDir) => {
      const requestedUrls = [];
      const report = await createHarnessSmokeReport(tmpDir, {
        argv: ['--h5'],
        fetchFn: async (url) => {
          requestedUrls.push(url);
          return { status: 200 };
        },
      });

      assert.equal(report.summary.ok, 1);
      assert.deepEqual(requestedUrls, ['http://localhost:19000/']);
    },
  );
});

test('createHarnessSmokeReport reports unreachable services as warn rather than fail', async () => {
  await withWorkspace(
    () => {},
    async (tmpDir) => {
      const report = await createHarnessSmokeReport(tmpDir, {
        argv: ['--admin'],
        fetchFn: async () => {
          throw new Error('ECONNREFUSED');
        },
      });

      assert.equal(report.ok, true);
      assert.equal(report.summary.warn, 1);
      assert.equal(report.checks[0].level, 'warn');
      assert.match(report.checks[0].fix, /pnpm dev:admin/);
    },
  );
});

// ── event-loop smoke ─────────────────────────────────────────────────────────

test('EVENT_LOOP_SMOKE_THRESHOLD_MS 和 PROBE_COUNT 均为正整数', () => {
  assert.ok(Number.isInteger(EVENT_LOOP_SMOKE_THRESHOLD_MS) && EVENT_LOOP_SMOKE_THRESHOLD_MS > 0);
  assert.ok(Number.isInteger(EVENT_LOOP_SMOKE_PROBE_COUNT) && EVENT_LOOP_SMOKE_PROBE_COUNT > 0);
});

test('measureEventLoopSmoke: p95 低于阈值时 exceeded=false', async () => {
  const result = await measureEventLoopSmoke('http://localhost:1', {
    probeCount: 3,
    thresholdMs: 10000,
    timeoutMs: 5000,
    fetchFn: async () => ({ status: 200 }),
  });
  assert.equal(result.exceeded, false);
  assert.equal(result.durations.length, 3);
});

test('measureEventLoopSmoke: p95 高于阈值时 exceeded=true', async () => {
  let call = 0;
  const result = await measureEventLoopSmoke('http://localhost:1', {
    probeCount: 4,
    thresholdMs: 5,
    timeoutMs: 5000,
    fetchFn: async () => {
      await new Promise((r) => setTimeout(r, call++ === 3 ? 20 : 1));
      return { status: 200 };
    },
  });
  assert.equal(result.exceeded, true);
});

test('createHarnessSmokeReport --event-loop-smoke 低延迟时添加 ok 检查', async () => {
  await withWorkspace(
    (tmpDir) => {
      writeFile(path.join(tmpDir, 'apps/admin-web/.env.development'), 'VITE_SERVICE_BASE_URL=http://localhost:18080\n');
    },
    async (tmpDir) => {
      const report = await createHarnessSmokeReport(tmpDir, {
        argv: ['--backend', '--event-loop-smoke'],
        fetchFn: async () => ({ status: 200 }),
      });
      const loopCheck = report.checks.find((c) => c.target === 'backend-event-loop');
      assert.ok(loopCheck, 'should have event-loop check');
      assert.equal(loopCheck.level, 'ok');
    },
  );
});

test('createHarnessSmokeReport treats 4xx responses as warnings', async () => {
  await withWorkspace(
    () => {},
    async (tmpDir) => {
      const report = await createHarnessSmokeReport(tmpDir, {
        argv: ['--admin'],
        fetchFn: async () => ({ status: 404 }),
      });

      assert.equal(report.ok, true);
      assert.equal(report.summary.ok, 0);
      assert.equal(report.summary.warn, 1);
      assert.equal(report.checks[0].level, 'warn');
      assert.match(report.checks[0].message, /HTTP 404/);
    },
  );
});
