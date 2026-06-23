<script lang="ts" setup>
import type { AddressVo } from '@/api/address';
import type { NearbyPlaceSuggestionVo } from '@/api/location';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref, watch } from 'vue';
import { getAddressList, getDefaultAddress, setDefaultAddress } from '@/api/address';
import { getNearbyPlaceSuggestions } from '@/api/location';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { useTokenStore } from '@/store/token';
import { isNearAnySavedAddress } from '@/utils/geo-distance';

definePage({
  style: {
    navigationBarTitleText: '选择地址',
    navigationBarBackgroundColor: '#f5f5f5',
    /** 禁止页面容器滚动，仅中间 scroll-view 滚动，避免 H5/小程序双滚动条 */
    disableScroll: true,
  },
});

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const locationStore = useLocationStore();

const loading = ref(true);
const defaultAddr = ref<AddressVo | null>(null);
const addressList = ref<AddressVo[]>([]);
/** 当前定位周边 POI（高德），非收货地址簿 */
const nearbySuggestions = ref<NearbyPlaceSuggestionVo[]>([]);

/** 我的地址超过 2 条时默认折叠，点击展开 */
const addressListExpanded = ref(false);

const visibleAddresses = computed(() => {
  if (addressListExpanded.value || addressList.value.length <= 2) {
    return addressList.value;
  }
  return addressList.value.slice(0, 2);
});

const showAddressExpandToggle = computed(() => addressList.value.length > 2);

function toggleAddressListExpand() {
  addressListExpanded.value = !addressListExpanded.value;
}

watch(
  () => addressList.value.length,
  (len) => {
    if (len <= 2) {
      addressListExpanded.value = false;
    }
  },
);

/** 与定位能力一致：优先逆地理详细地址，其次定位状态（不用收货地址簿替代展示） */
const locationAddressSummary = computed(() => {
  if (locationStore.locating) return '正在定位中';
  const rev = locationStore.reverseFormattedAddress?.trim();
  if (rev) return rev;
  if (locationStore.locationGranted) return '当前定位';
  return '点击重新定位';
});

/** 已选地址：展示当前用于业务的定位摘要（与 store 中坐标/逆地理一致），非收货地址簿默认项文案 */
const selectedSummary = locationAddressSummary;

/** 用于判断「当前定位是否已是我的地址」：列表 + 默认地址（避免列表未含默认的边界情况） */
const addressesForLocationMatch = computed((): AddressVo[] => {
  const list = addressList.value;
  const d = defaultAddr.value;
  if (!d) return list;
  if (list.some((a) => a.id === d.id)) return list;
  return [...list, d];
});

const currentLocationMatchesSavedAddress = computed(() => {
  const lat = locationStore.latitude;
  const lng = locationStore.longitude;
  if (lat == null || lng == null) return false;
  return isNearAnySavedAddress(lat, lng, addressesForLocationMatch.value);
});

/** 已登录且当前坐标与任一已保存收货地址（带坐标）不重合时，引导添加至地址簿 */
const showAddFromLocation = computed(
  () =>
    tokenStore.hasLogin &&
    !currentLocationMatchesSavedAddress.value &&
    locationStore.latitude != null &&
    locationStore.longitude != null &&
    (Boolean(locationStore.reverseFormattedAddress?.trim()) || locationStore.locationGranted),
);

async function loadPage() {
  loading.value = true;
  nearbySuggestions.value = [];
  try {
    const lat = locationStore.latitude;
    const lng = locationStore.longitude;

    if (lat != null && lng != null) {
      await locationStore.refreshReverseFormatted();
    }

    const nearbyPromise =
      lat != null && lng != null
        ? getNearbyPlaceSuggestions(lat, lng).catch(() => ({ list: [] as NearbyPlaceSuggestionVo[] }))
        : Promise.resolve({ list: [] as NearbyPlaceSuggestionVo[] });

    if (!tokenStore.hasLogin) {
      defaultAddr.value = null;
      addressList.value = [];
      const nearbyRes = await nearbyPromise;
      nearbySuggestions.value = nearbyRes.list ?? [];
      return;
    }

    const [[defRes, listRes], nearbyRes] = await Promise.all([
      Promise.all([getDefaultAddress(), getAddressList()]),
      nearbyPromise,
    ]);
    defaultAddr.value = defRes ?? null;
    addressList.value = listRes?.list ?? [];
    nearbySuggestions.value = nearbyRes.list ?? [];
  } catch (err) {
    console.error('选择地址页加载失败:', err);
  } finally {
    loading.value = false;
  }
}

onShow(() => {
  void loadPage();
});

function onSearchPlaceholderClick() {
  uni.showToast({ title: '即将支持搜索小区/写字楼', icon: 'none' });
}

async function onRelocate() {
  uni.showLoading({ title: '定位中' });
  try {
    await locationStore.requestLocation();
    if (locationStore.latitude != null && locationStore.longitude != null) {
      try {
        const nearbyRes = await getNearbyPlaceSuggestions(locationStore.latitude, locationStore.longitude);
        nearbySuggestions.value = nearbyRes?.list ?? [];
      } catch {
        nearbySuggestions.value = [];
      }
    }
  } finally {
    uni.hideLoading();
  }
}

function goManage() {
  uni.navigateTo({ url: '/pages/address/list' });
}

function goAdd() {
  uni.navigateTo({ url: '/pages/address/edit' });
}

function goAddFromLocation() {
  uni.navigateTo({ url: '/pages/address/edit' });
}

async function onPickAddress(addr: AddressVo) {
  try {
    if (!addr.isDefault) {
      await setDefaultAddress(addr.id);
    }
    if (addr.latitude != null && addr.longitude != null) {
      await locationStore.applyCoordinatesAndMatch(addr.latitude, addr.longitude);
    }
    uni.$emit('tenant-changed');
    uni.navigateBack();
  } catch (err) {
    console.error('选择地址失败:', err);
  }
}

function formatNearbyDistance(meters: number): string {
  if (meters < 1000) {
    return `约${meters}米`;
  }
  return `约${(meters / 1000).toFixed(1)}公里`;
}

async function onPickNearby(item: NearbyPlaceSuggestionVo) {
  try {
    await locationStore.applyCoordinatesAndMatch(item.latitude, item.longitude);
    uni.showToast({ title: '已更新定位', icon: 'none' });
    uni.$emit('tenant-changed');
  } catch (err) {
    console.error('更新定位失败:', err);
  }
}

function onLoginForAddress() {
  authStore.openAuthModal(() => {
    void loadPage();
  });
}

</script>

<template>
  <!-- 辅助禁止外层穿透滚动；H5 仍以根节点 fixed + overflow 为准 -->
  <page-meta page-style="overflow: hidden;" />
  <view class="select-page-root bg-fill">
    <!--
      scroll-view 必须常驻 DOM：H5 + KeepAlive 下 activated 会恢复 scrollTop；
      若 v-if 与 loading 互换导致 scroll-view 被卸载，会触发 Cannot set properties of null (setting 'scrollTop')。
    -->
    <scroll-view scroll-y class="select-scroll" :show-scrollbar="false">
      <view v-if="loading" class="box-border min-h-full flex items-center justify-center py-space-xl">
        <wd-loading />
      </view>
      <view v-else>
        <!-- 已选地址 -->
        <view class="px-space-lg pt-space-sm">
          <view class="flex items-center gap-space-sm">
            <text class="shrink-0 text-body-lg text-primary">已选地址:</text>
            <text class="min-w-0 flex-1 truncate text-body-lg text-ink">{{ selectedSummary }}</text>
            <view
              v-if="showAddFromLocation"
              class="shrink-0 border border-primary rounded-pill px-space-sm py-space-xs"
              hover-class="opacity-80"
              @click="goAddFromLocation"
            >
              <text class="whitespace-nowrap text-caption text-primary">添加至我的地址</text>
            </view>
          </view>
        </view>

        <!-- 搜索占位 -->
        <view class="px-space-lg pt-space-sm">
          <view
            class="flex items-center gap-space-sm border border-line rounded-card bg-surface px-space-md py-space-sm"
            hover-class="opacity-90"
            @click="onSearchPlaceholderClick"
          >
            <wd-icon name="search" size="32rpx" class="text-ink-lighter" />
            <text class="flex-1 text-body-lg text-ink-lighter">搜索小区/写字楼等</text>
            <wd-icon name="arrow-right" size="28rpx" class="text-ink-lighter" />
          </view>
        </view>

        <!-- 当前定位 -->
        <view class="px-space-lg pt-space-sm">
          <text class="mb-space-xs block text-caption text-ink-light">当前定位</text>
          <view
            class="flex items-center justify-between border border-line rounded-card bg-surface px-space-md py-space-sm"
          >
            <text class="min-w-0 flex-1 truncate pr-space-sm text-body-lg text-ink font-medium">
              {{ locationAddressSummary }}
            </text>
            <text class="shrink-0 text-body-lg text-primary" hover-class="opacity-80" @click="onRelocate"
              >重新定位</text
            >
          </view>
        </view>

        <!-- 我的地址 -->
        <view class="px-space-lg pt-space-sm">
          <view class="mb-space-xs flex items-center justify-between">
            <text class="text-caption text-ink-light">我的地址</text>
            <text
              v-if="tokenStore.hasLogin"
              class="text-caption text-primary"
              hover-class="opacity-80"
              @click="goManage"
            >
              管理
            </text>
          </view>

          <view v-if="!tokenStore.hasLogin" class="border border-line rounded-card bg-surface px-space-md py-space-md">
            <text class="mb-space-xs block text-center text-body-md text-ink-light">登录后管理收货地址</text>
            <wd-button type="primary" block @click="onLoginForAddress">去登录</wd-button>
          </view>

          <view
            v-else-if="addressList.length === 0"
            class="border border-line rounded-card bg-surface px-space-md py-space-md"
          >
            <text class="block text-center text-body-md text-ink-light">暂无收货地址</text>
          </view>

          <view v-else class="overflow-hidden border border-line rounded-card bg-surface">
            <view
              v-for="addr in visibleAddresses"
              :key="addr.id"
              class="address-select-row box-border flex flex-col"
              hover-class="bg-fill"
              @click="onPickAddress(addr)"
            >
              <view class="min-w-0 px-space-md pb-space-sm pt-space-sm">
                <view class="address-line-row min-w-0 flex flex-nowrap items-center gap-space-xs">
                  <wd-tag v-if="addr.tag" custom-class="address-select-tag" type="primary">{{ addr.tag }}</wd-tag>
                  <text class="min-w-0 flex-1 truncate text-body-lg text-ink leading-[1.5]">{{
                    addr.fullAddress
                  }}</text>
                </view>
                <text class="mt-space-xs block text-caption text-ink-light leading-[1.4]">{{ addr.name }} {{ addr.phone }}</text>
              </view>
              <view class="address-select-row-divider mx-space-md" aria-hidden="true" />
            </view>
            <view
              v-if="showAddressExpandToggle"
              class="flex items-center justify-center gap-space-xs px-space-md py-space-sm"
              hover-class="opacity-80"
              @click.stop="toggleAddressListExpand"
            >
              <text class="text-body-md text-primary">{{ addressListExpanded ? '收起' : '展开更多' }}</text>
              <wd-icon
                :name="addressListExpanded ? 'chevron-up' : 'chevron-down'"
                size="28rpx"
                class="text-primary"
              />
            </view>
          </view>
        </view>

        <!-- 附近地址：高德周边 POI（五公里内），点击仅更新当前定位 -->
        <view class="px-space-lg pb-space-sm pt-space-sm">
          <text class="mb-space-xs block text-caption text-ink-light">附近地址</text>
          <view class="overflow-hidden border border-line rounded-card bg-surface">
            <view
              v-for="(item, idx) in nearbySuggestions"
              :key="item.id"
              class="px-space-md py-space-sm"
              :class="idx < nearbySuggestions.length - 1 ? 'border-b border-line' : ''"
              hover-class="opacity-90"
              @click="onPickNearby(item)"
            >
              <text class="text-body-lg text-ink">{{ item.fullAddress }}</text>
              <text class="mt-space-xs block text-caption text-ink-light">{{ formatNearbyDistance(item.distanceMeters) }}</text>
            </view>
            <view
              v-if="nearbySuggestions.length === 0"
              class="px-space-md py-space-sm text-center text-body-md text-ink-light"
            >
              暂无
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <view class="select-footer">
      <wd-button type="primary" block @click="goAdd">
        <view class="flex items-center justify-center gap-space-xs">
          <wd-icon name="add" size="28rpx" />
          <text class="text-body-lg">新增收货地址</text>
        </view>
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/**
 * 整页固定 + 中间 scroll-view：根容器不增高，避免 H5 整页滚动条。
 * H5：fixed 相对视口，top 避开原生导航栏（与购物车未登录态一致）。
 */
.select-page-root {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.select-scroll {
  flex: 1;
  min-height: 0;
  /** uni-app scroll-view 在 flex 列中需明确高度链，否则易撑开父级触发整页滚动 */
  height: 0;
}

.select-footer {
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: var(--z-fixed, 10);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-bg-surface);
  border-top: 1rpx solid var(--color-border-default);
  box-shadow: 0 -2rpx 20rpx rgba(0, 0, 0, 0.05);
}

/**
 * 分割线左右与正文同为 space-md（mx-space-md），避免贴卡片两端的「通栏线」。
 */
.address-select-row-divider {
  box-sizing: border-box;
  flex-shrink: 0;
  height: 0;
  border-bottom: 1rpx solid var(--color-border-default);
}

/* #ifdef H5 */
.address-select-row-divider {
  border-bottom-width: 1px;
}

/* #endif */

/** tag 与地址同一行：与正文行高、交叉轴居中对齐（wd-tag 根节点参与 flex） */
.address-line-row {
  align-items: center;
}

:deep(.address-select-tag) {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

/* #ifdef H5 */
.select-page-root {
  position: fixed;
  top: var(--window-top, 44px);
  right: 0;
  bottom: 0;
  left: 0;
  width: 100%;
  height: auto;
  max-height: none;
  min-height: 0;
}

/* #endif */
</style>
