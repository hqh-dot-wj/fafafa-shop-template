import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const K6_SCRIPT_PATH = path.resolve('scripts/loadtests/client-product-list-spike.k6.js');
const REPORT_DIR = path.resolve('scripts/loadtests/reports');
const REPORT_PATH = path.join(REPORT_DIR, 'product-query-load-matrix.latest.json');

const PROFILES = [
  { key: 'medium', hotRate: 600, missRate: 300, hotDurationSeconds: 45, missDurationSeconds: 45 },
  { key: 'high', hotRate: 1200, missRate: 600, hotDurationSeconds: 45, missDurationSeconds: 45 },
  { key: 'extreme', hotRate: 2000, missRate: 1000, hotDurationSeconds: 20, missDurationSeconds: 20 },
];

const BASE_URL = (process.env.BASE_URL || '').trim();
const TOKEN = (process.env.TOKEN || '').trim();
const TENANT_ID = (process.env.TENANT_ID || '').trim();
const PROFILE_FILTER = (process.env.LOADTEST_PROFILES || '').trim();

const fail = (message) => {
  // eslint-disable-next-line no-console
  console.error(`[product-query-load-matrix] ${message}`);
  process.exit(1);
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  const base = 10 ** digits;
  return Math.round(value * base) / base;
};

const pickNumber = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const readMetricValue = (summary, metricName, fieldName, fallback = null) => {
  const metric = summary?.metrics?.[metricName];
  if (!metric || typeof metric !== 'object') {
    return fallback;
  }

  const fieldNames = Array.isArray(fieldName) ? fieldName : [fieldName];
  for (const item of fieldNames) {
    const valueFromValues = pickNumber(metric?.values?.[item]);
    if (valueFromValues !== null) {
      return valueFromValues;
    }
    const valueFromRoot = pickNumber(metric?.[item]);
    if (valueFromRoot !== null) {
      return valueFromRoot;
    }
  }
  return fallback;
};

const ensureReportDir = () => {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
};

const pickProfiles = () => {
  if (!PROFILE_FILTER) return PROFILES;

  const selectedKeys = PROFILE_FILTER
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (selectedKeys.length === 0) return PROFILES;

  const selected = PROFILES.filter((profile) => selectedKeys.includes(profile.key));
  if (selected.length === 0) {
    fail(`LOADTEST_PROFILES 无匹配档位: ${PROFILE_FILTER}`);
  }
  return selected;
};

const buildK6Env = (profile) => {
  const k6Env = { ...process.env };
  k6Env.BASE_URL = BASE_URL;
  if (TOKEN) k6Env.TOKEN = TOKEN;
  if (TENANT_ID) k6Env.TENANT_ID = TENANT_ID;
  k6Env.HOT_MAX_RATE = String(profile.hotRate);
  k6Env.MISS_MAX_RATE = String(profile.missRate);
  k6Env.HOT_DURATION_SECONDS = String(profile.hotDurationSeconds);
  k6Env.MISS_DURATION_SECONDS = String(profile.missDurationSeconds);
  return k6Env;
};

const runSingleProfile = (profile) => {
  const summaryFile = path.join(os.tmpdir(), `k6-product-list-${profile.key}-${Date.now()}.json`);
  const runResult = spawnSync('k6', ['run', '--summary-export', summaryFile, K6_SCRIPT_PATH], {
    cwd: process.cwd(),
    env: buildK6Env(profile),
    stdio: 'inherit',
  });

  let summary = null;
  try {
    if (fs.existsSync(summaryFile)) {
      summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
    }
  } catch {
    summary = null;
  } finally {
    if (fs.existsSync(summaryFile)) {
      fs.unlinkSync(summaryFile);
    }
  }

  const failedRate = readMetricValue(summary, 'http_req_failed', ['rate', 'value'], 1);
  const p95 = readMetricValue(summary, 'http_req_duration', 'p(95)', Number.POSITIVE_INFINITY);
  const requestRate =
    readMetricValue(summary, 'http_reqs', 'rate', null) ?? readMetricValue(summary, 'iterations', 'rate', 0);
  const statusNon200 = readMetricValue(summary, 'status_non_200_count', 'count', Number.POSITIVE_INFINITY);
  const bizCodeNon200 = readMetricValue(summary, 'biz_code_non_200_count', 'count', Number.POSITIVE_INFINITY);

  const pass =
    (runResult.status ?? 1) === 0 &&
    failedRate < 0.02 &&
    p95 < 1200 &&
    statusNon200 <= 10 &&
    bizCodeNon200 <= 10;

  return {
    profile: profile.key,
    hotRate: profile.hotRate,
    missRate: profile.missRate,
    hotDurationSeconds: profile.hotDurationSeconds,
    missDurationSeconds: profile.missDurationSeconds,
    exitCode: runResult.status ?? null,
    pass,
    metrics: {
      httpReqFailedRate: round(failedRate, 6),
      httpReqDurationP95Ms: round(p95, 2),
      httpReqRate: round(requestRate, 2),
      statusNon200Count: round(statusNon200, 0),
      bizCodeNon200Count: round(bizCodeNon200, 0),
    },
  };
};

if (!BASE_URL) {
  fail('缺少 BASE_URL，请先传入压测目标地址（例如 http://127.0.0.1:8080/api）');
}

if (!fs.existsSync(K6_SCRIPT_PATH)) {
  fail(`压测脚本不存在: ${K6_SCRIPT_PATH}`);
}

const selectedProfiles = pickProfiles();
const startedAt = new Date().toISOString();
const results = selectedProfiles.map((profile) => runSingleProfile(profile));
const endedAt = new Date().toISOString();
const hasFailedProfile = results.some((item) => !item.pass);

ensureReportDir();
const reportPayload = {
  startedAt,
  endedAt,
  baseUrl: BASE_URL,
  profileFilter: PROFILE_FILTER || null,
  profiles: results,
};
fs.writeFileSync(REPORT_PATH, JSON.stringify(reportPayload, null, 2), 'utf8');

// eslint-disable-next-line no-console
console.log('\n=== 商品查询压测矩阵汇总 ===');
for (const result of results) {
  const failedPercent = Number.isFinite(result.metrics.httpReqFailedRate)
    ? `${(result.metrics.httpReqFailedRate * 100).toFixed(2)}%`
    : 'N/A';
  const p95Label = Number.isFinite(result.metrics.httpReqDurationP95Ms)
    ? `${result.metrics.httpReqDurationP95Ms.toFixed(2)}ms`
    : 'N/A';
  const rpsLabel = Number.isFinite(result.metrics.httpReqRate) ? result.metrics.httpReqRate.toFixed(2) : 'N/A';
  // eslint-disable-next-line no-console
  console.log(
    `${result.profile.padEnd(8)} hot=${String(result.hotRate).padStart(4)} miss=${String(result.missRate).padStart(
      4,
    )} rps=${rpsLabel.padStart(8)} p95=${p95Label.padStart(10)} fail=${failedPercent.padStart(8)} non200=${String(
      result.metrics.statusNon200Count,
    ).padStart(4)} bizNon200=${String(result.metrics.bizCodeNon200Count).padStart(4)} status=${
      result.pass ? 'PASS' : 'FAIL'
    }`,
  );
}

// eslint-disable-next-line no-console
console.log(`[product-query-load-matrix] 报告已写入: ${REPORT_PATH}`);

if (hasFailedProfile) {
  process.exit(1);
}
