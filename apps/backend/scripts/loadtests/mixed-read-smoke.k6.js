/* global __ENV, __ITER, open */
/**
 * P2 只读混合链路压测：C 端商品列表 + 后台商品列表 + C 端营销场景。
 *
 * 默认档位面向本地验证，故意低于开发环境默认 throttler 限流阈值。
 * 写入类导入压测请单独执行 store-product-import-excel-spike.k6.js。
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = (__ENV.TOKEN || (__ENV.TOKEN_FILE ? open(__ENV.TOKEN_FILE) : '') || '').trim();
const TENANT_ID = __ENV.TENANT_ID || '';

const DURATION_SECONDS = Number(__ENV.DURATION_SECONDS || '20');
const CLIENT_RATE = Math.max(0, Math.floor(Number(__ENV.CLIENT_RATE || '1')));
const ADMIN_RATE = Math.max(0, Math.floor(Number(__ENV.ADMIN_RATE || '1')));
const SCENE_RATE = Math.max(0, Math.floor(Number(__ENV.SCENE_RATE || '1')));
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || '4');
const MAX_VUS = Number(__ENV.MAX_VUS || '20');

const PAGE_SIZE = Number(__ENV.PAGE_SIZE || '20');
const CLIENT_HOT_KEYWORD = __ENV.CLIENT_HOT_KEYWORD || '保洁';
const CLIENT_MISS_KEYWORDS = (__ENV.CLIENT_MISS_KEYWORDS || '保洁,家政,清洗,护理,上门')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const ADMIN_KEYWORDS = (__ENV.ADMIN_KEYWORDS || '数学,语文,英语,课程,服务,拼团')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const ADMIN_PAGE_MAX = Number(__ENV.ADMIN_PAGE_MAX || '3');
const SCENE_CODE = __ENV.SCENE_CODE || 'HF_SCENE_HOME';
const SCENE_CHANNEL = __ENV.SCENE_CHANNEL || 'MINIAPP';
const SCENE_MODULE_LIMIT = Number(__ENV.SCENE_MODULE_LIMIT || '8');
const SCENE_PRODUCT_LIMIT = Number(__ENV.SCENE_PRODUCT_LIMIT || '20');

const bizFailedRate = new Rate('biz_failed_rate');
const statusNon200Count = new Counter('status_non_200_count');
const bizCodeNon200Count = new Counter('biz_code_non_200_count');
const status401Count = new Counter('status_401_count');
const status403Count = new Counter('status_403_count');
const status429Count = new Counter('status_429_count');
const status5xxCount = new Counter('status_5xx_count');
const clientProductDuration = new Trend('client_product_list_duration_ms', true);
const adminProductDuration = new Trend('admin_product_list_duration_ms', true);
const sceneModulesDuration = new Trend('marketing_scene_modules_duration_ms', true);

function buildScenario(exec, rate) {
  if (rate <= 0) {
    return null;
  }
  return {
    executor: 'constant-arrival-rate',
    exec,
    rate,
    timeUnit: '1s',
    duration: `${DURATION_SECONDS}s`,
    preAllocatedVUs: PRE_ALLOCATED_VUS,
    maxVUs: MAX_VUS,
  };
}

const scenarios = {};
const clientScenario = buildScenario('runClientProductList', CLIENT_RATE);
const adminScenario = buildScenario('runAdminProductList', ADMIN_RATE);
const sceneScenario = buildScenario('runMarketingSceneModules', SCENE_RATE);
if (clientScenario) scenarios.client_product_list = clientScenario;
if (adminScenario) scenarios.admin_product_list = adminScenario;
if (sceneScenario) scenarios.marketing_scene_modules = sceneScenario;
if (Object.keys(scenarios).length === 0) {
  throw new Error('至少需要一个混合压测场景，CLIENT_RATE / ADMIN_RATE / SCENE_RATE 不能全部为 0');
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

const headers = {
  'Content-Type': 'application/json',
};
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}
if (TENANT_ID) {
  headers['tenant-id'] = TENANT_ID;
}

function assertEnvReady() {
  return Boolean(BASE_URL && TOKEN && TENANT_ID);
}

function recordHttpFailure(res) {
  if (res.status === 401) {
    status401Count.add(1);
  } else if (res.status === 403) {
    status403Count.add(1);
  } else if (res.status === 429) {
    status429Count.add(1);
  } else if (res.status >= 500) {
    status5xxCount.add(1);
  }
  statusNon200Count.add(1);
  bizFailedRate.add(1);
}

function parsePayload(res) {
  try {
    return res.json();
  } catch {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return null;
  }
}

function pick(items, fallback) {
  if (items.length === 0) {
    return fallback;
  }
  return items[__ITER % items.length];
}

export function runClientProductList() {
  if (!assertEnvReady()) return;

  const keyword = __ITER % 3 === 0 ? pick(CLIENT_MISS_KEYWORDS, CLIENT_HOT_KEYWORD) : CLIENT_HOT_KEYWORD;
  const pageNum = (__ITER % 3) + 1;
  const url = `${BASE_URL}/client/product/list?name=${encodeURIComponent(keyword)}&pageNum=${pageNum}&pageSize=${PAGE_SIZE}`;
  const res = http.get(url, { headers });
  clientProductDuration.add(res.timings.duration);

  const statusOk = check(res, { 'client product HTTP status is 200': (r) => r.status === 200 });
  if (!statusOk) {
    recordHttpFailure(res);
    return;
  }

  const payload = parsePayload(res);
  if (!payload) return;

  const bizOk = check(payload, {
    'client product biz code is 200': (body) => body && body.code === 200,
    'client product has rows array': (body) => !!body?.data?.rows && Array.isArray(body.data.rows),
  });
  if (!bizOk) {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }
  bizFailedRate.add(0);
}

export function runAdminProductList() {
  if (!assertEnvReady()) return;

  const url = `${BASE_URL}/store/product/list`;
  const body = JSON.stringify({
    pageNum: (__ITER % Math.max(1, ADMIN_PAGE_MAX)) + 1,
    pageSize: PAGE_SIZE,
    name: pick(ADMIN_KEYWORDS, ''),
  });
  const res = http.post(url, body, { headers });
  adminProductDuration.add(res.timings.duration);

  const statusOk = check(res, { 'admin product HTTP status is 200/201': (r) => r.status === 200 || r.status === 201 });
  if (!statusOk) {
    recordHttpFailure(res);
    return;
  }

  const payload = parsePayload(res);
  if (!payload) return;

  const bizOk = check(payload, {
    'admin product biz code is 200': (body) => body && body.code === 200,
    'admin product has rows array': (body) => !!body?.data?.rows && Array.isArray(body.data.rows),
  });
  if (!bizOk) {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }
  bizFailedRate.add(0);
}

export function runMarketingSceneModules() {
  if (!assertEnvReady()) return;

  const url = `${BASE_URL}/client/marketing/scene/${encodeURIComponent(
    SCENE_CODE,
  )}/modules?channel=${encodeURIComponent(SCENE_CHANNEL)}&moduleLimit=${SCENE_MODULE_LIMIT}&productLimit=${SCENE_PRODUCT_LIMIT}`;
  const res = http.get(url, { headers });
  sceneModulesDuration.add(res.timings.duration);

  const statusOk = check(res, { 'scene modules HTTP status is 200': (r) => r.status === 200 });
  if (!statusOk) {
    recordHttpFailure(res);
    return;
  }

  const payload = parsePayload(res);
  if (!payload) return;

  const bizOk = check(payload, {
    'scene modules biz code is 200': (body) => body && body.code === 200,
    'scene modules has modules array': (body) => !!body?.data?.modules && Array.isArray(body.data.modules),
  });
  if (!bizOk) {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }
  bizFailedRate.add(0);
}
