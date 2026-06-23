/** 与 backend `TenantContext.SUPER_TENANT_ID` / 种子 `sys_tenant.tenant_id` 一致 */
export const DEV_MOCK_SUPER_TENANT_ID = '000000';

/** 种子超级租户默认公司名（`platform-bootstrap`） */
export const DEV_MOCK_SUPER_COMPANY_NAME = '湖南科技有限公司';

/** 默认模拟坐标：长沙市中心，便于与湖南种子数据联调 */
export const DEV_MOCK_DEFAULT_LAT = 28.228209;
export const DEV_MOCK_DEFAULT_LNG = 112.938814;

function readEnvTrimmed(key: keyof ImportMetaEnv): string {
  const raw = import.meta.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

function parseEnvBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/**
 * H5 本地开发：跳过浏览器定位，固定使用超级租户上下文发起请求。
 * 需 `import.meta.env.DEV` 且 `VITE_DEV_MOCK_LOCATION=true`（见 `.env.development`）。
 */
export function isDevLocationMockEnabled(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  if (!parseEnvBoolean(readEnvTrimmed('VITE_DEV_MOCK_LOCATION'))) {
    return false;
  }
  // #ifdef H5
  return true;
  // #endif
  // #ifndef H5
  return false;
  // #endif
}

export function resolveDevMockTenantId(): string {
  return readEnvTrimmed('VITE_DEV_MOCK_TENANT_ID') || DEV_MOCK_SUPER_TENANT_ID;
}

export function resolveDevMockCompanyName(): string {
  return readEnvTrimmed('VITE_DEV_MOCK_COMPANY_NAME') || DEV_MOCK_SUPER_COMPANY_NAME;
}

export function resolveDevMockCoordinates(): { lat: number; lng: number } {
  const latRaw = readEnvTrimmed('VITE_DEV_MOCK_LAT');
  const lngRaw = readEnvTrimmed('VITE_DEV_MOCK_LNG');
  const lat = latRaw ? Number(latRaw) : DEV_MOCK_DEFAULT_LAT;
  const lng = lngRaw ? Number(lngRaw) : DEV_MOCK_DEFAULT_LNG;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: DEV_MOCK_DEFAULT_LAT, lng: DEV_MOCK_DEFAULT_LNG };
  }
  return { lat, lng };
}
