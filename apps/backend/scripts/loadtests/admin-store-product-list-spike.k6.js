/* global __ENV, __ITER, open */
/**
 * 后台店铺商品列表压测脚本（查询链路）
 *
 * 运行示例：
 * k6 run \
 *   -e BASE_URL=http://127.0.0.1:8080/api \
 *   -e TOKEN=xxx \
 *   -e TENANT_ID=000000 \
 *   -e MAX_RATE=1200 \
 *   apps/backend/scripts/loadtests/admin-store-product-list-spike.k6.js
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = (__ENV.TOKEN || (__ENV.TOKEN_FILE ? open(__ENV.TOKEN_FILE) : '') || '').trim();
const TENANT_ID = __ENV.TENANT_ID || '';

const MAX_RATE = Number(__ENV.MAX_RATE || '1200');
const DURATION_SECONDS = Number(__ENV.DURATION_SECONDS || '120');
const RAMP_UP_SECONDS = Number(__ENV.RAMP_UP_SECONDS || '30');
const RAMP_DOWN_SECONDS = Number(__ENV.RAMP_DOWN_SECONDS || '30');
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || '80');
const MAX_VUS = Number(__ENV.MAX_VUS || '3000');
const PAGE_SIZE = Number(__ENV.PAGE_SIZE || '20');
const PAGE_MAX = Number(__ENV.PAGE_MAX || '5');
const KEYWORDS = (__ENV.KEYWORDS || '数学,语文,英语,课程,服务,拼团')
  .split(',')
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

const bizFailedRate = new Rate('biz_failed_rate');
const status200Count = new Counter('status_200_count');
const status201Count = new Counter('status_201_count');
const statusNon200Count = new Counter('status_non_200_count');
const bizCodeNon200Count = new Counter('biz_code_non_200_count');
const status401Count = new Counter('status_401_count');
const status403Count = new Counter('status_403_count');
const status429Count = new Counter('status_429_count');
const status5xxCount = new Counter('status_5xx_count');
const listDuration = new Trend('admin_store_product_list_duration_ms', true);

const headers = {
  'Content-Type': 'application/json',
};
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}
if (TENANT_ID) {
  headers['tenant-id'] = TENANT_ID;
}

export const options = {
  scenarios: {
    admin_store_product_list: {
      executor: 'ramping-arrival-rate',
      timeUnit: '1s',
      startRate: Math.max(1, Math.floor(MAX_RATE * 0.2)),
      preAllocatedVUs: PRE_ALLOCATED_VUS,
      maxVUs: MAX_VUS,
      stages: [
        { duration: `${RAMP_UP_SECONDS}s`, target: Math.max(1, Math.floor(MAX_RATE * 0.5)) },
        { duration: `${DURATION_SECONDS}s`, target: MAX_RATE },
        { duration: `${RAMP_DOWN_SECONDS}s`, target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200', 'p(99)<2000'],
    biz_failed_rate: ['rate<0.02'],
    status_non_200_count: ['count<20'],
    biz_code_non_200_count: ['count<20'],
  },
};

function assertEnvReady() {
  return Boolean(BASE_URL && TOKEN && TENANT_ID);
}

function pickKeyword(iteration) {
  if (KEYWORDS.length === 0) {
    return '';
  }
  return KEYWORDS[iteration % KEYWORDS.length];
}

function buildBody(iteration) {
  return JSON.stringify({
    pageNum: (iteration % Math.max(1, PAGE_MAX)) + 1,
    pageSize: PAGE_SIZE,
    name: pickKeyword(iteration),
  });
}

export default function () {
  if (!assertEnvReady()) {
    return;
  }

  const url = `${BASE_URL}/store/product/list`;
  const body = buildBody(__ITER);
  const res = http.post(url, body, { headers });
  listDuration.add(res.timings.duration);

  const statusOk = check(res, {
    'HTTP status is 200/201': (r) => r.status === 200 || r.status === 201,
  });

  if (!statusOk) {
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
    return;
  }
  if (res.status === 200) {
    status200Count.add(1);
  } else if (res.status === 201) {
    status201Count.add(1);
  }

  let payload = null;
  try {
    payload = res.json();
  } catch {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }

  const bizOk = check(payload, {
    'biz code is 200': (bodyValue) => bodyValue && bodyValue.code === 200,
    'has rows array': (bodyValue) => !!bodyValue?.data?.rows && Array.isArray(bodyValue.data.rows),
    'has total number': (bodyValue) => typeof bodyValue?.data?.total === 'number',
  });

  if (!bizOk) {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }

  bizFailedRate.add(0);
}
