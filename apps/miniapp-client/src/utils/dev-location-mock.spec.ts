import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEV_MOCK_DEFAULT_LAT,
  DEV_MOCK_DEFAULT_LNG,
  DEV_MOCK_SUPER_COMPANY_NAME,
  DEV_MOCK_SUPER_TENANT_ID,
  resolveDevMockCompanyName,
  resolveDevMockCoordinates,
  resolveDevMockTenantId,
} from './dev-location-mock';

describe('dev-location-mock', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolveDevMockTenantId 默认超级租户', () => {
    expect(resolveDevMockTenantId()).toBe(DEV_MOCK_SUPER_TENANT_ID);
  });

  it('resolveDevMockCompanyName 默认种子公司名', () => {
    expect(resolveDevMockCompanyName()).toBe(DEV_MOCK_SUPER_COMPANY_NAME);
  });

  it('resolveDevMockCoordinates 非法 env 时回退默认坐标', () => {
    vi.stubEnv('VITE_DEV_MOCK_LAT', 'bad');
    vi.stubEnv('VITE_DEV_MOCK_LNG', 'bad');
    expect(resolveDevMockCoordinates()).toEqual({
      lat: DEV_MOCK_DEFAULT_LAT,
      lng: DEV_MOCK_DEFAULT_LNG,
    });
  });

  it('resolveDevMockCoordinates 读取 env 覆盖', () => {
    vi.stubEnv('VITE_DEV_MOCK_LAT', '30.5');
    vi.stubEnv('VITE_DEV_MOCK_LNG', '114.3');
    expect(resolveDevMockCoordinates()).toEqual({ lat: 30.5, lng: 114.3 });
  });
});
