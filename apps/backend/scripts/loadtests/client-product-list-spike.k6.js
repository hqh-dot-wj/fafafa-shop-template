/* global __ENV, __ITER */
/**
 * C端商品列表压测脚本（查询链路）
 *
 * 运行示例：
 * k6 run \
 *   -e BASE_URL=http://127.0.0.1:8080/api \
 *   -e TOKEN=xxx \
 *   -e TENANT_ID=100001 \
 *   -e HOT_MAX_RATE=800 \
 *   -e MISS_MAX_RATE=300 \
 *   apps/backend/scripts/loadtests/client-product-list-spike.k6.js
 *
 * 说明：
 * - HOT 场景：固定关键词，观察缓存命中下吞吐与延迟
 * - MISS 场景：多关键词轮询，观察缓存命中下降时的数据库承压
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const bizFailedRate = new Rate('biz_failed_rate');
const statusNon200 = new Counter('status_non_200_count');
const bizCodeNon200 = new Counter('biz_code_non_200_count');
const productListDuration = new Trend('product_list_duration_ms', true);

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = __ENV.TOKEN || '';
const TENANT_ID = __ENV.TENANT_ID || '';
const PAGE_SIZE = Number(__ENV.PAGE_SIZE || '20');
const HOT_KEYWORD = __ENV.HOT_KEYWORD || '保洁';
const MISS_KEYWORDS = (__ENV.MISS_KEYWORDS || '保洁,家政,清洗,护理,上门,课程,拼课,会员,洗衣液,体验课')
  .split(',')
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

const HOT_MAX_RATE = Number(__ENV.HOT_MAX_RATE || '800');
const MISS_MAX_RATE = Number(__ENV.MISS_MAX_RATE || '300');
const HOT_DURATION_SECONDS = Number(__ENV.HOT_DURATION_SECONDS || '120');
const MISS_DURATION_SECONDS = Number(__ENV.MISS_DURATION_SECONDS || '120');
const HOT_PRE_ALLOCATED_VUS = Number(__ENV.HOT_PRE_ALLOCATED_VUS || '100');
const HOT_MAX_VUS = Number(__ENV.HOT_MAX_VUS || '3000');
const MISS_PRE_ALLOCATED_VUS = Number(__ENV.MISS_PRE_ALLOCATED_VUS || '80');
const MISS_MAX_VUS = Number(__ENV.MISS_MAX_VUS || '3000');

const headers = {};
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}
if (TENANT_ID) {
  headers['tenant-id'] = TENANT_ID;
}

function buildRateScenario({ exec, maxRate, durationSeconds, preAllocatedVUs, maxVUs }) {
  if (maxRate <= 0) {
    return null;
  }
  return {
    executor: 'ramping-arrival-rate',
    exec,
    timeUnit: '1s',
    startRate: Math.max(1, Math.floor(maxRate * 0.2)),
    preAllocatedVUs,
    maxVUs,
    stages: [
      { duration: '30s', target: Math.max(1, Math.floor(maxRate * 0.5)) },
      { duration: `${durationSeconds}s`, target: maxRate },
      { duration: '30s', target: 0 },
    ],
  };
}

const scenarios = {};
const hotScenario = buildRateScenario({
  exec: 'runHotCacheQueries',
  maxRate: HOT_MAX_RATE,
  durationSeconds: HOT_DURATION_SECONDS,
  preAllocatedVUs: HOT_PRE_ALLOCATED_VUS,
  maxVUs: HOT_MAX_VUS,
});
const missScenario = buildRateScenario({
  exec: 'runCacheMissQueries',
  maxRate: MISS_MAX_RATE,
  durationSeconds: MISS_DURATION_SECONDS,
  preAllocatedVUs: MISS_PRE_ALLOCATED_VUS,
  maxVUs: MISS_MAX_VUS,
});
if (hotScenario) {
  scenarios.hot_cache_queries = hotScenario;
}
if (missScenario) {
  scenarios.cache_miss_queries = missScenario;
}

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200', 'p(99)<2000'],
    biz_failed_rate: ['rate<0.02'],
    status_non_200_count: ['count<10'],
    biz_code_non_200_count: ['count<10'],
  },
};

function assertEnvReady() {
  if (!BASE_URL) {
    return false;
  }
  return true;
}

function pickMissKeyword(iteration) {
  if (MISS_KEYWORDS.length === 0) {
    return HOT_KEYWORD;
  }
  return MISS_KEYWORDS[iteration % MISS_KEYWORDS.length];
}

function requestProductList(keyword, pageNum = 1) {
  const url = `${BASE_URL}/client/product/list?name=${encodeURIComponent(keyword)}&pageNum=${pageNum}&pageSize=${PAGE_SIZE}`;
  const res = http.get(url, { headers });
  productListDuration.add(res.timings.duration);

  const statusOk = check(res, {
    'HTTP status is 200': (r) => r.status === 200,
  });

  if (!statusOk) {
    statusNon200.add(1);
    bizFailedRate.add(1);
    return;
  }

  let payload = null;
  try {
    payload = res.json();
  } catch {
    bizFailedRate.add(1);
    bizCodeNon200.add(1);
    return;
  }

  const bizOk = check(payload, {
    'biz code is 200': (body) => body && body.code === 200,
    'has rows array': (body) => !!body?.data?.rows && Array.isArray(body.data.rows),
  });

  if (!bizOk) {
    bizCodeNon200.add(1);
    bizFailedRate.add(1);
    return;
  }

  bizFailedRate.add(0);
}

export function runHotCacheQueries() {
  if (!assertEnvReady()) {
    return;
  }
  requestProductList(HOT_KEYWORD, 1);
}

export function runCacheMissQueries() {
  if (!assertEnvReady()) {
    return;
  }
  const pageNum = (__ITER % 3) + 1;
  const keyword = pickMissKeyword(__ITER);
  requestProductList(keyword, pageNum);
}
