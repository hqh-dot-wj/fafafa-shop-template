import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluateLocationDrift, getReverseGeocode } from '@/api/location';
import { LOCATION_DRIFT_CLIENT_COOLDOWN_MS, LOCATION_DRIFT_LAST_EVALUATED_AT_KEY } from '@/constants/location-drift';
import { clearTestStorage } from '@/test/setup';
import { useLocationStore } from './location';

vi.mock('@/api/location', () => ({
  evaluateLocationDrift: vi.fn(),
  getReverseGeocode: vi.fn().mockResolvedValue({ formattedAddress: null }),
}));

const mockedEvaluate = vi.mocked(evaluateLocationDrift);
const mockedReverse = vi.mocked(getReverseGeocode);

describe('location evaluateDriftAndMaybeSwitch', () => {
  beforeEach(() => {
    clearTestStorage();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
    vi.mocked(uni.getLocation).mockImplementation((opts) => {
      opts?.success?.({
        accuracy: 0,
        altitude: 0,
        horizontalAccuracy: 0,
        latitude: 31.23,
        longitude: 121.46,
        speed: 0,
        verticalAccuracy: 0,
      });
    });
  });

  it('同租户且未超过阈值时不触发无感切换', async () => {
    mockedEvaluate.mockResolvedValue({
      shouldSwitch: false,
      reason: 'TENANT_UNCHANGED',
      distanceMeters: 100,
      dynamicThresholdMeters: 1800,
      cooldownHit: false,
      matchedTenant: { tenantId: 'T1', companyName: 'A店' },
    });

    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      currentCompanyName: 'A店',
      locationGranted: true,
    });

    const r = await store.evaluateDriftAndMaybeSwitch();
    expect(r).toBe('unchanged');
    expect(store.currentTenantId).toBe('T1');
  });

  it('定位成功但无逆地理文案时展示“当前定位”', () => {
    const store = useLocationStore();
    store.$patch({
      locating: false,
      locationGranted: true,
      reverseFormattedAddress: null,
    });
    expect(store.locationDisplayName).toBe('当前定位');
  });

  it('定位请求进行中时展示“正在定位中”', () => {
    const store = useLocationStore();
    store.$patch({
      locating: true,
      locationGranted: false,
      reverseFormattedAddress: null,
    });
    expect(store.locationDisplayName).toBe('正在定位中');
  });

  it('租户变化且服务端建议切换时更新门店', async () => {
    mockedEvaluate.mockResolvedValue({
      shouldSwitch: true,
      reason: 'TENANT_CHANGED_AND_DISTANCE_EXCEEDED',
      distanceMeters: 2400,
      dynamicThresholdMeters: 1800,
      cooldownHit: false,
      matchedTenant: { tenantId: 'T2', companyName: 'B店' },
    });

    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      currentCompanyName: 'A店',
      locationGranted: true,
    });

    const r = await store.evaluateDriftAndMaybeSwitch();
    expect(r).toBe('switched');
    expect(store.currentTenantId).toBe('T2');
    expect(store.currentCompanyName).toBe('B店');
  });

  it('协议未通过时不打开门店强确认弹层', async () => {
    uni.setStorageSync('privacyDecision', 'rejected');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      locationGranted: true,
    });
    const r = await store.ensureCheckoutAddressAligned('T2');
    expect(r).toBe(false);
    expect(store.addressRiskModalVisible).toBe(false);
  });

  it('时间窗内重复进入不重复请求漂移接口', async () => {
    uni.setStorageSync(LOCATION_DRIFT_LAST_EVALUATED_AT_KEY, Date.now());
    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      locationGranted: true,
      reverseFormattedAddress: '已缓存展示地址',
    });

    const r = await store.evaluateDriftAndMaybeSwitch();
    expect(r).toBe('skipped');
    expect(mockedEvaluate).not.toHaveBeenCalled();
    expect(mockedReverse).not.toHaveBeenCalled();
  });

  it('漂移冷却内仍用已有坐标补逆地理（详细地址未缓存时）', async () => {
    mockedReverse.mockResolvedValueOnce({ formattedAddress: '上海市浦东新区世纪大道' });
    uni.setStorageSync(LOCATION_DRIFT_LAST_EVALUATED_AT_KEY, Date.now());
    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      locationGranted: true,
      reverseFormattedAddress: null,
    });

    const r = await store.evaluateDriftAndMaybeSwitch();
    expect(r).toBe('skipped');
    expect(mockedEvaluate).not.toHaveBeenCalled();
    expect(mockedReverse).toHaveBeenCalled();
    expect(store.reverseFormattedAddress).toBe('上海市浦东新区世纪大道');
  });

  it('冷却将尽时可再次请求（超过客户端时间窗）', async () => {
    uni.setStorageSync(LOCATION_DRIFT_LAST_EVALUATED_AT_KEY, Date.now() - LOCATION_DRIFT_CLIENT_COOLDOWN_MS - 1000);
    mockedEvaluate.mockResolvedValue({
      shouldSwitch: false,
      reason: 'TENANT_UNCHANGED',
      distanceMeters: 0,
      dynamicThresholdMeters: 1800,
      cooldownHit: false,
      matchedTenant: { tenantId: 'T1', companyName: 'A店' },
    });

    const store = useLocationStore();
    store.$patch({
      latitude: 31.22,
      longitude: 121.45,
      currentTenantId: 'T1',
      locationGranted: true,
    });

    await store.evaluateDriftAndMaybeSwitch();
    expect(mockedEvaluate).toHaveBeenCalled();
  });
});

vi.mock('@/utils/dev-location-mock', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/dev-location-mock')>();
  return {
    ...actual,
    isDevLocationMockEnabled: vi.fn(() => false),
  };
});

describe('location dev mock', () => {
  beforeEach(() => {
    clearTestStorage();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('applyDevMockLocation 写入超级租户与模拟坐标', async () => {
    const devMock = await import('@/utils/dev-location-mock');
    vi.mocked(devMock.isDevLocationMockEnabled).mockReturnValue(true);

    const store = useLocationStore();
    store.applyDevMockLocation();

    expect(store.currentTenantId).toBe('000000');
    expect(store.currentCompanyName).toBe('湖南科技有限公司');
    expect(store.locationGranted).toBe(true);
    expect(store.latitude).toBe(28.228209);
    expect(store.longitude).toBe(112.938814);
    expect(store.reverseFormattedAddress).toBe('本地开发（模拟定位）');

    await store.requestLocation();
    expect(uni.getLocation).not.toHaveBeenCalled();
  });
});
