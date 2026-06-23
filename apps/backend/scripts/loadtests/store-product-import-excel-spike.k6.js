/* global __ENV, __ITER, open */
/**
 * 后台商品批量上传（import-excel）压测脚本
 *
 * 运行示例：
 * k6 run \
 *   -e BASE_URL=http://127.0.0.1:8080/api \
 *   -e TOKEN=xxx \
 *   -e TENANT_ID=000000 \
 *   -e IMPORT_CATEGORY_ID=205 \
 *   -e IMPORT_PRODUCT_ID=hf-service-math-001 \
 *   -e IMPORT_SKU_ID=hf-service-math-001-sku-1 \
 *   -e MAX_RATE=80 \
 *   apps/backend/scripts/loadtests/store-product-import-excel-spike.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/$/, '');
const TOKEN = (__ENV.TOKEN || (__ENV.TOKEN_FILE ? open(__ENV.TOKEN_FILE) : '') || '').trim();
const TENANT_ID = __ENV.TENANT_ID || '';

const MAX_RATE = Number(__ENV.MAX_RATE || '80');
const DURATION_SECONDS = Number(__ENV.DURATION_SECONDS || '90');
const RAMP_UP_SECONDS = Number(__ENV.RAMP_UP_SECONDS || '20');
const RAMP_DOWN_SECONDS = Number(__ENV.RAMP_DOWN_SECONDS || '20');
const PRE_ALLOCATED_VUS = Number(__ENV.PRE_ALLOCATED_VUS || '40');
const MAX_VUS = Number(__ENV.MAX_VUS || '2000');

const IMPORT_CATEGORY_ID = Number(__ENV.IMPORT_CATEGORY_ID || '205');
const IMPORT_PRODUCT_ID = __ENV.IMPORT_PRODUCT_ID || 'hf-service-math-001';
const IMPORT_SKU_ID = __ENV.IMPORT_SKU_ID || 'hf-service-math-001-sku-1';
const IMPORT_PRICE = Number(__ENV.IMPORT_PRICE || '4000');
const IMPORT_STOCK = Number(__ENV.IMPORT_STOCK || '100');
const IMPORT_DIST_RATE = Number(__ENV.IMPORT_DIST_RATE || '0.8');
const IMPORT_DIST_MODE = __ENV.IMPORT_DIST_MODE || 'RATIO';
const POLL_IMPORT_JOB_RESULT = String(__ENV.POLL_IMPORT_JOB_RESULT || 'false').toLowerCase() === 'true';
const POLL_MAX_TRIES = Number(__ENV.POLL_MAX_TRIES || '12');
const POLL_INTERVAL_MS = Number(__ENV.POLL_INTERVAL_MS || '500');

const bizFailedRate = new Rate('import_biz_failed_rate');
const status200Count = new Counter('import_status_200_count');
const status201Count = new Counter('import_status_201_count');
const status202Count = new Counter('import_status_202_count');
const statusNon200Count = new Counter('import_status_non_200_count');
const bizCodeNon200Count = new Counter('import_biz_code_non_200_count');
const status401Count = new Counter('import_status_401_count');
const status403Count = new Counter('import_status_403_count');
const status429Count = new Counter('import_status_429_count');
const status5xxCount = new Counter('import_status_5xx_count');
const importAcceptedJobs = new Counter('import_accepted_jobs');
const importSuccessRows = new Counter('import_success_rows');
const importFailRows = new Counter('import_fail_rows');
const importDuration = new Trend('store_product_import_excel_duration_ms', true);

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
    store_product_import_excel: {
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
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000', 'p(99)<4000'],
    import_biz_failed_rate: ['rate<0.05'],
    import_status_non_200_count: ['count<30'],
    import_biz_code_non_200_count: ['count<30'],
  },
};

function assertEnvReady() {
  return Boolean(BASE_URL && TOKEN && TENANT_ID && IMPORT_PRODUCT_ID && IMPORT_SKU_ID && IMPORT_CATEGORY_ID > 0);
}

function buildBody(iteration) {
  return JSON.stringify({
    categoryId: IMPORT_CATEGORY_ID,
    rows: [
      {
        rowNo: iteration + 1,
        productId: IMPORT_PRODUCT_ID,
        globalSkuId: IMPORT_SKU_ID,
        price: IMPORT_PRICE,
        stock: IMPORT_STOCK,
        distRate: IMPORT_DIST_RATE,
        distMode: IMPORT_DIST_MODE,
      },
    ],
  });
}

export default function () {
  if (!assertEnvReady()) {
    return;
  }

  const url = `${BASE_URL}/store/product/import-excel`;
  const body = buildBody(__ITER);
  const res = http.post(url, body, { headers });
  importDuration.add(res.timings.duration);

  const statusOk = check(res, {
    'HTTP status is 200/201/202': (r) => r.status === 200 || r.status === 201 || r.status === 202,
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
  } else if (res.status === 202) {
    status202Count.add(1);
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
    'has job id': (bodyValue) => bodyValue && bodyValue.data && typeof bodyValue.data.jobId === 'string',
  });

  if (!bizOk) {
    bizCodeNon200Count.add(1);
    bizFailedRate.add(1);
    return;
  }

  importAcceptedJobs.add(1);
  if (!POLL_IMPORT_JOB_RESULT) {
    bizFailedRate.add(0);
    return;
  }

  const jobId = payload.data.jobId;
  const jobUrl = `${BASE_URL}/store/product/import-jobs/${jobId}`;
  let donePayload = null;
  for (let i = 0; i < POLL_MAX_TRIES; i++) {
    const jobRes = http.get(jobUrl, { headers });
    const jobStatusOk = check(jobRes, {
      'job query status is 200': (r) => r.status === 200,
    });
    if (!jobStatusOk) {
      bizFailedRate.add(1);
      return;
    }

    let current = null;
    try {
      current = jobRes.json();
    } catch {
      bizFailedRate.add(1);
      return;
    }

    if (!current || current.code !== 200 || !current.data || typeof current.data.status !== 'string') {
      bizFailedRate.add(1);
      return;
    }

    if (current.data.status === 'DONE') {
      donePayload = current.data;
      break;
    }
    if (current.data.status === 'FAILED') {
      bizFailedRate.add(1);
      return;
    }

    sleep(POLL_INTERVAL_MS / 1000);
  }

  if (!donePayload) {
    bizFailedRate.add(1);
    return;
  }

  const successCount = Number(donePayload.successCount || 0);
  const failCount = Number(donePayload.failCount || 0);
  importSuccessRows.add(successCount);
  importFailRows.add(failCount);

  if (failCount > 0 || successCount < 1) {
    bizFailedRate.add(1);
    return;
  }

  bizFailedRate.add(0);
}
