import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { evaluateLocationDrift, getReverseGeocode } from '@/api/location';
import { LOCATION_DRIFT_CLIENT_COOLDOWN_MS, LOCATION_DRIFT_LAST_EVALUATED_AT_KEY } from '@/constants/location-drift';
import { httpGet, httpPost } from '@/http/http';
import {
  isDevLocationMockEnabled,
  resolveDevMockCompanyName,
  resolveDevMockCoordinates,
  resolveDevMockTenantId,
} from '@/utils/dev-location-mock';
import { useAuthStore } from './auth';
import { cancelRuntimePopup, enqueueRuntimePopup } from './popup-orchestrator';

interface TenantInfo {
  tenantId: string;
  companyName: string;
  distance?: number;
}

/** H5 上 gcj02 需配置地图 Key，否则会报 map provider not configured；小程序/App 仍用国测局坐标 */
function getUniLocationType(): 'gcj02' | 'wgs84' {
  // #ifdef H5
  return 'wgs84';
  // #endif
  // #ifndef H5
  return 'gcj02';
  // #endif
}

/** 与 backend `ResponseCode.DATA_NOT_FOUND` 一致（非 HTTP 404） */
const BUSINESS_DATA_NOT_FOUND = 1002;

/** `requestLocation` 可选参数 */
export interface RequestLocationOptions {
  /** 为 true 时只拉坐标并逆地理展示，不调用 matchTenant（用于首页「请确认地址」确认前） */
  skipMatchTenant?: boolean;
}

function readHttpBizError(err: unknown): { code?: number; message?: string } {
  if (typeof err !== 'object' || err === null) return {};
  const rec: { code?: unknown; msg?: unknown; message?: unknown } = err;
  const code = typeof rec.code === 'number' ? rec.code : undefined;
  const fromMsg = typeof rec.msg === 'string' ? rec.msg : undefined;
  const fromMessage = typeof rec.message === 'string' ? rec.message : undefined;
  const message = fromMessage ?? fromMsg;
  const result: { code?: number; message?: string } = {};
  if (code !== undefined) result.code = code;
  if (message !== undefined) result.message = message;
  return result;
}

/**
 * 位置与租户状态管理
 * 用于分类页面的位置授权和租户切换
 */
export const useLocationStore = defineStore(
  'location',
  () => {
    const locating = ref(false);
    const latitude = ref<number | null>(null);
    const longitude = ref<number | null>(null);
    const currentTenantId = ref<string | null>(null);
    const currentCompanyName = ref<string | null>(null);
    const locationGranted = ref(false);
    const nearbyTenants = ref<TenantInfo[]>([]);
    // 控制租户选择器弹窗显示
    const showTenantSelector = ref(false);

    /** 结算前：定位门店与结算门店不一致时的强确认弹层 */
    const addressRiskModalVisible = ref(false);
    const pendingCheckoutTenantId = ref<string | null>(null);
    let addressRiskResolve: ((ok: boolean) => void) | null = null;

    /** 高德逆地理得到的展示地址（与租户名不同；手动选租户时会清空） */
    const reverseFormattedAddress = ref<string | null>(null);

    /** 页面展示统一以“定位状态/地址文案”为主，不展示租户名 */
    const locationDisplayName = computed(() => {
      if (locating.value) return '正在定位中';
      if (reverseFormattedAddress.value) return reverseFormattedAddress.value;
      if (locationGranted.value) return '当前定位';
      return '正在定位中';
    });

    /**
     * H5 本地开发：写入超级租户与模拟坐标，跳过 match-tenant（围栏通常不匹配 000000）。
     */
    function applyDevMockLocation(): void {
      if (!isDevLocationMockEnabled()) {
        return;
      }
      const { lat, lng } = resolveDevMockCoordinates();
      latitude.value = lat;
      longitude.value = lng;
      locationGranted.value = true;
      locating.value = false;
      currentTenantId.value = resolveDevMockTenantId();
      currentCompanyName.value = resolveDevMockCompanyName();
      reverseFormattedAddress.value = '本地开发（模拟定位）';
    }

    async function refreshReverseFormatted(): Promise<void> {
      if (isDevLocationMockEnabled()) {
        return;
      }
      if (latitude.value === null || longitude.value === null) {
        reverseFormattedAddress.value = null;
        return;
      }
      try {
        const res = await getReverseGeocode(latitude.value, longitude.value);
        const text = res?.formattedAddress?.trim();
        reverseFormattedAddress.value = text && text.length > 0 ? text : null;
      } catch {
        reverseFormattedAddress.value = null;
      }
    }

    /**
     * 逆地理文案未持久化：冷启动/Tab 返回时若已有坐标但无展示文案，补一次逆地理（避免顶栏长期停在「当前定位」）。
     * 不在已有文案时重复请求；协议未通过时不请求。
     */
    async function hydrateReverseGeocodeWhenMissing(): Promise<void> {
      const authStore = useAuthStore();
      if (authStore.requireAgreement) {
        return;
      }
      if (latitude.value === null || longitude.value === null) {
        return;
      }
      if (reverseFormattedAddress.value?.trim()) {
        return;
      }
      await refreshReverseFormatted();
    }

    /**
     * 使用指定坐标更新定位并重新匹配租户（如从收货地址同步）
     */
    async function applyCoordinatesAndMatch(lat: number, lng: number): Promise<void> {
      latitude.value = lat;
      longitude.value = lng;
      locationGranted.value = true;
      await matchTenant();
    }

    /**
     * 根据当前位置匹配归属租户
     */
    async function matchTenant(): Promise<void> {
      if (isDevLocationMockEnabled()) {
        applyDevMockLocation();
        return;
      }
      if (latitude.value === null || longitude.value === null) {
        reverseFormattedAddress.value = null;
        return;
      }

      try {
        const result = await httpPost<{ tenantId: string; companyName: string }>(
          '/client/location/match-tenant',
          {
            lat: latitude.value,
            lng: longitude.value,
          },
          undefined,
          undefined,
          { hideErrorToast: true },
        );

        if (result) {
          currentTenantId.value = result.tenantId;
          currentCompanyName.value = result.companyName;
        }
      } catch (err: unknown) {
        console.error('匹配租户失败:', err);
        const { code, message } = readHttpBizError(err);
        const noService = code === BUSINESS_DATA_NOT_FOUND || code === 404 || message?.includes('暂未开通服务');
        if (noService) {
          currentTenantId.value = null;
          currentCompanyName.value = '暂无服务商家';
          uni.showToast({ title: message ?? '该位置暂无开通服务', icon: 'none' });
        } else {
          uni.showToast({ title: '定位服务暂不可用', icon: 'none' });
        }
      } finally {
        await refreshReverseFormatted();
      }
    }

    /**
     * 请求用户位置授权并获取位置
     */
    async function requestLocation(options?: RequestLocationOptions): Promise<boolean> {
      if (isDevLocationMockEnabled()) {
        applyDevMockLocation();
        return true;
      }
      const skipMatchTenant = options?.skipMatchTenant === true;
      locating.value = true;
      const success = await new Promise<boolean>((resolve) => {
        uni.getLocation({
          type: getUniLocationType(),
          success: (res) => {
            latitude.value = res.latitude;
            longitude.value = res.longitude;
            locationGranted.value = true;
            resolve(true);
          },
          fail: (err) => {
            console.error('获取位置失败:', err);
            const msg = err.errMsg ?? '';

            if (msg.includes('translate coordinate') || msg.includes('map provider')) {
              uni.showToast({
                title: '无法完成定位，请在顶部手动选择服务区域',
                icon: 'none',
              });
              resolve(false);
              return;
            }

            const looksLikePermissionDeny =
              msg.includes('deny') || msg.includes('auth') || msg.includes('permission') || msg.includes('拒绝');

            if (looksLikePermissionDeny) {
              // #ifdef MP-WEIXIN
              uni.showModal({
                title: '位置授权',
                content: '需要获取您的位置信息以匹配附近的服务商家，请在设置中开启位置权限',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    uni.openSetting({});
                  }
                },
              });
              // #endif
              // #ifndef MP-WEIXIN
              uni.showModal({
                title: '位置授权',
                content:
                  '需要位置信息以匹配附近商家。请在浏览器或系统设置中允许定位；也可稍后在页面顶部手动选择服务区域。',
                showCancel: false,
              });
              // #endif
            }
            resolve(false);
          },
        });
      });

      try {
        if (success) {
          if (skipMatchTenant) {
            await refreshReverseFormatted();
          } else {
            await matchTenant();
          }
        }
      } finally {
        locating.value = false;
      }

      return success;
    }

    /**
     * 获取附近租户列表 (用于手动切换)
     */
    async function fetchNearbyTenants(): Promise<void> {
      if (isDevLocationMockEnabled()) {
        nearbyTenants.value = [
          {
            tenantId: resolveDevMockTenantId(),
            companyName: resolveDevMockCompanyName(),
            distance: 0,
          },
        ];
        return;
      }
      if (latitude.value === null || longitude.value === null) {
        return;
      }

      try {
        const result = await httpGet<TenantInfo[]>('/client/location/nearby-tenants', {
          lat: latitude.value,
          lng: longitude.value,
        });

        if (result) {
          nearbyTenants.value = result;
        }
      } catch (err) {
        console.error('获取附近租户失败:', err);
      }
    }

    /**
     * 手动切换租户
     */
    function setTenant(tenant: TenantInfo): void {
      reverseFormattedAddress.value = null;
      currentTenantId.value = tenant.tenantId;
      currentCompanyName.value = tenant.companyName;
    }

    /** 首页首次确认前清空租户与逆地理文案，避免顶栏沿用上次结果；坐标由后续 getLocation 写入 */
    function clearTenantMatch(): void {
      currentTenantId.value = null;
      currentCompanyName.value = null;
      reverseFormattedAddress.value = null;
    }

    /**
     * 清除位置信息
     */
    function clearLocation(): void {
      latitude.value = null;
      longitude.value = null;
      currentTenantId.value = null;
      currentCompanyName.value = null;
      reverseFormattedAddress.value = null;
      locationGranted.value = false;
      locating.value = false;
      nearbyTenants.value = [];
    }

    /**
     * 打开租户选择器
     */
    async function openTenantSelector(): Promise<void> {
      await fetchNearbyTenants();
      showTenantSelector.value = true;
    }

    function readLastDriftEvaluatedAt(): number | undefined {
      const raw = uni.getStorageSync(LOCATION_DRIFT_LAST_EVALUATED_AT_KEY);
      const n = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }

    function markDriftEvaluatedNow(): void {
      uni.setStorageSync(LOCATION_DRIFT_LAST_EVALUATED_AT_KEY, Date.now());
    }

    /**
     * 首页/重入：无感漂移判定（协议未通过时不请求定位与接口）
     */
    async function evaluateDriftAndMaybeSwitch(): Promise<'switched' | 'skipped' | 'unchanged'> {
      if (isDevLocationMockEnabled()) {
        applyDevMockLocation();
        return 'skipped';
      }
      const authStore = useAuthStore();
      if (authStore.requireAgreement) {
        return 'skipped';
      }

      const lastLocal = readLastDriftEvaluatedAt();
      if (lastLocal !== undefined && Date.now() - lastLocal < LOCATION_DRIFT_CLIENT_COOLDOWN_MS) {
        await hydrateReverseGeocodeWhenMissing();
        return 'skipped';
      }

      const prevLat = latitude.value;
      const prevLng = longitude.value;
      const prevTenant = currentTenantId.value?.trim() ?? '';

      const located = await requestLocation({ skipMatchTenant: true });
      if (!located) {
        await hydrateReverseGeocodeWhenMissing();
        return 'skipped';
      }

      const nowLat = latitude.value;
      const nowLng = longitude.value;
      if (nowLat === null || nowLng === null) {
        return 'skipped';
      }

      const hasLastConfirm = prevLat !== null && prevLng !== null;

      try {
        const driftPayload: Parameters<typeof evaluateLocationDrift>[0] = {
          lat: nowLat,
          lng: nowLng,
          lastConfirmedLat: hasLastConfirm ? prevLat : nowLat,
          lastConfirmedLng: hasLastConfirm ? prevLng : nowLng,
        };
        if (prevTenant) driftPayload.lastTenantId = prevTenant;
        if (lastLocal !== undefined) driftPayload.lastEvaluatedAt = lastLocal;

        const result = await evaluateLocationDrift(driftPayload);

        markDriftEvaluatedNow();

        if (result.shouldSwitch && result.matchedTenant) {
          currentTenantId.value = result.matchedTenant.tenantId;
          currentCompanyName.value = result.matchedTenant.companyName;
          await refreshReverseFormatted();
          uni.showToast({ title: '已切换至您附近的服务门店', icon: 'none' });
          uni.$emit('tenant-changed');
          return 'switched';
        }

        if (!currentTenantId.value && result.matchedTenant) {
          currentTenantId.value = result.matchedTenant.tenantId;
          currentCompanyName.value = result.matchedTenant.companyName;
          await refreshReverseFormatted();
          uni.$emit('tenant-changed');
          return 'unchanged';
        }

        return 'unchanged';
      } catch (err: unknown) {
        console.error('evaluateLocationDrift failed:', err);
        return 'skipped';
      }
    }

    /**
     * 提交订单前：当前定位门店须与结算 tenantId 一致，否则阻断并弹层
     */
    async function ensureCheckoutAddressAligned(checkoutTenantId: string): Promise<boolean> {
      const authStore = useAuthStore();
      if (authStore.requireAgreement || authStore.agreementPopupVisible) {
        enqueueRuntimePopup('agreement');
        return false;
      }

      const tid = checkoutTenantId.trim();
      if (!tid) {
        uni.showToast({ title: '缺少门店信息', icon: 'none' });
        return false;
      }
      if (!currentTenantId.value) {
        uni.showToast({ title: '请先完成定位或选择门店', icon: 'none' });
        return false;
      }
      if (currentTenantId.value === tid) {
        return true;
      }
      pendingCheckoutTenantId.value = tid;
      addressRiskModalVisible.value = true;
      enqueueRuntimePopup('address', { resumeAction: 'submitOrder' });
      return await new Promise<boolean>((resolve) => {
        addressRiskResolve = resolve;
      });
    }

    function submitAddressRiskRecheck(): void {
      const want = pendingCheckoutTenantId.value;
      pendingCheckoutTenantId.value = null;
      addressRiskModalVisible.value = false;
      cancelRuntimePopup('address');
      const ok = Boolean(want && currentTenantId.value === want);
      addressRiskResolve?.(ok);
      addressRiskResolve = null;
      if (!ok) {
        uni.showToast({ title: '请先切换至与结算单一致的门店', icon: 'none' });
      }
    }

    function cancelAddressRiskConfirm(): void {
      pendingCheckoutTenantId.value = null;
      addressRiskModalVisible.value = false;
      cancelRuntimePopup('address');
      addressRiskResolve?.(false);
      addressRiskResolve = null;
    }

    return {
      latitude,
      longitude,
      locating,
      currentTenantId,
      currentCompanyName,
      reverseFormattedAddress,
      locationDisplayName,
      locationGranted,
      nearbyTenants,
      showTenantSelector,
      requestLocation,
      matchTenant,
      fetchNearbyTenants,
      setTenant,
      clearTenantMatch,
      clearLocation,
      openTenantSelector,
      applyDevMockLocation,
      applyCoordinatesAndMatch,
      refreshReverseFormatted,
      hydrateReverseGeocodeWhenMissing,
      evaluateDriftAndMaybeSwitch,
      addressRiskModalVisible,
      ensureCheckoutAddressAligned,
      submitAddressRiskRecheck,
      cancelAddressRiskConfirm,
    };
  },
  {
    persist: {
      paths: ['currentTenantId', 'currentCompanyName', 'locationGranted', 'latitude', 'longitude'],
    },
  },
);
