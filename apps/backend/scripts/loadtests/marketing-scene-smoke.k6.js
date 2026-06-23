/* global __ENV */
/**
 * k6 场景接口冒烟压测（需自备 BASE_URL、TOKEN、TENANT_ID）
 *
 * 运行示例：
 *   k6 run -e BASE_URL=https://api.example.com -e TOKEN=... -e TENANT_ID=100001 -e SCENE_CODE=HF_SCENE_HOME apps/backend/scripts/loadtests/marketing-scene-smoke.k6.js
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const bizFailedRate = new Rate('biz_failed_rate');
const statusNon200 = new Counter('status_non_200_count');
const bizCodeNon200 = new Counter('biz_code_non_200_count');
const sceneModulesDuration = new Trend('marketing_scene_modules_duration_ms', true);

const VUS = Number(__ENV.VUS || '5');
const DURATION_SECONDS = Number(__ENV.DURATION_SECONDS || '30');

export const options = {
  vus: VUS,
  duration: `${DURATION_SECONDS}s`,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
    biz_failed_rate: ['rate<0.05'],
    status_non_200_count: ['count<10'],
    biz_code_non_200_count: ['count<10'],
  },
};

const base = __ENV.BASE_URL;
const token = __ENV.TOKEN;
const tenantId = __ENV.TENANT_ID || '';
const sceneCode = __ENV.SCENE_CODE || 'HOME_FEATURED';
const channel = __ENV.CHANNEL || 'MINIAPP';
const moduleLimit = Number(__ENV.MODULE_LIMIT || '8');
const productLimit = Number(__ENV.PRODUCT_LIMIT || '20');

export default function () {
  if (!base || !token) {
    return;
  }
  const url = `${base.replace(/\/$/, '')}/client/marketing/scene/${encodeURIComponent(
    sceneCode,
  )}/modules?channel=${encodeURIComponent(channel)}&moduleLimit=${moduleLimit}&productLimit=${productLimit}`;
  const res = http.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'tenant-id': tenantId,
    },
  });
  sceneModulesDuration.add(res.timings.duration);

  const statusOk = check(res, {
    'status 200': (r) => r.status === 200,
  });
  if (!statusOk) {
    statusNon200.add(1);
    bizFailedRate.add(1);
    sleep(0.3);
    return;
  }

  let payload = null;
  try {
    payload = res.json();
  } catch {
    bizCodeNon200.add(1);
    bizFailedRate.add(1);
    sleep(0.3);
    return;
  }

  const bizOk = check(payload, {
    'biz code is 200': (body) => body && body.code === 200,
    'has modules array': (body) => !!body?.data?.modules && Array.isArray(body.data.modules),
  });
  if (!bizOk) {
    bizCodeNon200.add(1);
    bizFailedRate.add(1);
    sleep(0.3);
    return;
  }

  bizFailedRate.add(0);
  sleep(0.3);
}
