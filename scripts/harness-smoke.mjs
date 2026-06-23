#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const EVENT_LOOP_SMOKE_THRESHOLD_MS = 500;
export const EVENT_LOOP_SMOKE_PROBE_COUNT = 5;

export const DEFAULT_SMOKE_TARGETS = [
  {
    id: 'backend',
    name: 'backend liveness',
    envName: 'HARNESS_BACKEND_URL',
    fallbackBaseUrl: 'http://localhost:8080',
    path: '/api/health/liveness',
    startCommand: 'pnpm dev:backend',
    sourceEnvFile: 'apps/admin-web/.env.development',
    sourceEnvKey: 'VITE_SERVICE_BASE_URL',
  },
  {
    id: 'admin',
    name: 'admin-web login route',
    envName: 'HARNESS_ADMIN_URL',
    fallbackBaseUrl: 'http://localhost:9527',
    path: '/login',
    startCommand: 'pnpm dev:admin',
    sourceEnvKey: 'PLAYWRIGHT_BASE_URL',
  },
  {
    id: 'h5',
    name: 'miniapp-client H5 root',
    envName: 'HARNESS_H5_URL',
    fallbackBaseUrl: 'http://localhost:9000',
    path: '/',
    startCommand: 'pnpm --filter @apps/miniapp-client dev:h5',
    sourceEnvFile: 'apps/miniapp-client/.env',
    sourceEnvKey: 'VITE_APP_PORT',
    sourceEnvValueToBaseUrl: (value) => `http://localhost:${value}`,
  },
];

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function parseDotEnvValue(content, key) {
  const pattern = new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`, 'm');
  const match = content.match(pattern);
  if (!match) return '';
  return match[1].replace(/^['"]|['"]$/g, '').trim();
}

function joinUrl(baseUrl, routePath) {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${normalizedBase}${normalizedPath}`;
}

function resolveTargetBaseUrl(rootDir, target, env = process.env) {
  const explicit = env[target.envName] || env[target.sourceEnvKey];
  if (explicit) return explicit.replace(/\/+$/, '');

  if (target.sourceEnvFile && target.sourceEnvKey) {
    const envContent = readTextIfExists(path.join(rootDir, target.sourceEnvFile));
    const value = parseDotEnvValue(envContent, target.sourceEnvKey);
    if (value) {
      const baseUrl = target.sourceEnvValueToBaseUrl ? target.sourceEnvValueToBaseUrl(value) : value;
      return baseUrl.replace(/\/+$/, '');
    }
  }

  return target.fallbackBaseUrl;
}

function selectTargets(argv) {
  const selected = new Set();
  for (const target of DEFAULT_SMOKE_TARGETS) {
    if (argv.includes(`--${target.id}`)) selected.add(target.id);
  }
  if (argv.includes('--miniapp')) selected.add('h5');
  if (selected.size === 0) return DEFAULT_SMOKE_TARGETS;
  return DEFAULT_SMOKE_TARGETS.filter((target) => selected.has(target.id));
}

async function requestUrlTimed(url, timeoutMs, fetchFn) {
  const start = Date.now();
  const result = await requestUrl(url, timeoutMs, fetchFn);
  return { ...result, durationMs: Date.now() - start };
}

export async function measureEventLoopSmoke(url, options = {}) {
  const {
    probeCount = EVENT_LOOP_SMOKE_PROBE_COUNT,
    thresholdMs = EVENT_LOOP_SMOKE_THRESHOLD_MS,
    timeoutMs = 3000,
    fetchFn = globalThis.fetch,
  } = options;

  const durations = [];
  for (let i = 0; i < probeCount; i++) {
    const { durationMs } = await requestUrlTimed(url, timeoutMs, fetchFn);
    durations.push(durationMs);
  }
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? durations[durations.length - 1];
  return { durations, p95, exceeded: p95 > thresholdMs, thresholdMs };
}

async function requestUrl(url, timeoutMs, fetchFn) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    return {
      reachable: response.status >= 200 && response.status < 400,
      status: response.status,
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function createHarnessSmokeReport(rootDir, options = {}) {
  const argv = options.argv ?? [];
  const timeoutMs = Number(options.timeoutMs ?? process.env.HARNESS_SMOKE_TIMEOUT_MS ?? 3000);
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const env = options.env ?? process.env;
  const checks = [];

  if (typeof fetchFn !== 'function') {
    return {
      ok: true,
      summary: { ok: 0, warn: 1, fail: 0 },
      checks: [
        {
          level: 'warn',
          target: 'runtime',
          url: '',
          message: 'global fetch is not available; use Node 20.19.0+',
          fix: 'Run smoke harness with the repo-supported Node version.',
        },
      ],
    };
  }

  const eventLoopSmoke = argv.includes('--event-loop-smoke');

  for (const target of selectTargets(argv)) {
    const baseUrl = resolveTargetBaseUrl(rootDir, target, env);
    const url = joinUrl(baseUrl, target.path);
    const result = await requestUrl(url, timeoutMs, fetchFn);
    if (result.reachable) {
      checks.push({
        level: 'ok',
        target: target.id,
        url,
        message: `reachable${result.status ? ` (HTTP ${result.status})` : ''}`,
        fix: '',
      });

      if (eventLoopSmoke && target.id === 'backend') {
        const probe = await measureEventLoopSmoke(url, { timeoutMs, fetchFn });
        checks.push({
          level: probe.exceeded ? 'warn' : 'ok',
          target: 'backend-event-loop',
          url,
          message: probe.exceeded
            ? `event-loop smoke: p95 ${probe.p95}ms exceeds ${probe.thresholdMs}ms threshold — possible blocking`
            : `event-loop smoke: p95 ${probe.p95}ms (threshold ${probe.thresholdMs}ms)`,
          fix: probe.exceeded
            ? 'Check backend for synchronous blocking: readFileSync, hashSync, execSync, cpu-intensive loops.'
            : '',
        });
      }
    } else {
      const statusMessage = result.status ? `unexpected HTTP ${result.status}` : 'not reachable';
      checks.push({
        level: 'warn',
        target: target.id,
        url,
        message: result.error ? `not reachable: ${result.error}` : statusMessage,
        fix: `Start ${target.name} with ${target.startCommand}, or override ${target.envName}.`,
      });
    }
  }

  return {
    ok: true,
    summary: {
      ok: checks.filter((check) => check.level === 'ok').length,
      warn: checks.filter((check) => check.level === 'warn').length,
      fail: 0,
    },
    checks,
  };
}

function printReport(report) {
  console.log(`Harness smoke: ${report.summary.warn > 0 ? 'WARN' : 'OK'}`);
  console.log(`Checks: ${report.summary.ok} OK, ${report.summary.warn} WARN, ${report.summary.fail} FAIL`);
  for (const check of report.checks) {
    const label = check.level.toUpperCase().padEnd(4);
    console.log(`[${label}] ${check.target} :: ${check.url || '-'} - ${check.message}`);
    if (check.level !== 'ok' && check.fix) {
      console.log(`       fix: ${check.fix}`);
    }
  }
}

export async function main(
  argv = process.argv.slice(2),
  rootDir = path.resolve(fileURLToPath(import.meta.url), '..', '..'),
) {
  const json = argv.includes('--json');
  const strict = argv.includes('--strict');
  const report = await createHarnessSmokeReport(rootDir, { argv });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  return strict && report.summary.warn > 0 ? 1 : 0;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
