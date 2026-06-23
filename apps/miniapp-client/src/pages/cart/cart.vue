<script lang="ts" setup>
import type { AddressVo } from '@/api/address';
import type { CartItem } from '@/store/cart';
import { onShow } from '@dcloudio/uni-app';
import { computed, ref, watch } from 'vue';
import { fetchUnusedCouponTotal } from '@/api/marketing-coupon';
import { httpGet } from '@/http/http';
import { useAuthStore } from '@/store/auth';
import { useCartStore } from '@/store/cart';
import { useLocationStore } from '@/store/location';
import { useTokenStore } from '@/store/token';
import CartCheckoutBar from './components/cart-checkout-bar.vue';
import CartEmptyState from './components/cart-empty-state.vue';
import CartInvalidSection from './components/cart-invalid-section.vue';
import CartLineItem from './components/cart-line-item.vue';
import CartSyncErrorBar from './components/cart-sync-error-bar.vue';
import CartTopBar from './components/cart-top-bar.vue';
import { MOCK_CART_ITEMS } from './mock-cart-items';

definePage({
  style: {
    navigationBarTitleText: '小象超市',
    /** 与 design-tokens `--color-bg-body` / 页面 `bg-fill` 一致，避免原生标题栏白底与内容区割裂 */
    navigationBarBackgroundColor: '#f5f5f5',
    /** 避免 H5/小程序整页与中间 scroll-view 双重滚动 */
    disableScroll: true,
  },
});

const cartStore = useCartStore();
const locationStore = useLocationStore();
const tokenStore = useTokenStore();
const authStore = useAuthStore();

const isEditing = ref(false);
const headerAddressText = ref('请选择收货地址');
const unusedCouponCount = ref(0);

const isLoggedIn = computed(() => tokenStore.hasLogin);

const showSkeleton = computed(
  () =>
    isLoggedIn.value &&
    !import.meta.env.DEV &&
    Boolean(locationStore.currentTenantId) &&
    cartStore.loading &&
    cartStore.items.length === 0 &&
    cartStore.invalidItems.length === 0,
);

const showErrorEmpty = computed(
  () =>
    isLoggedIn.value &&
    !cartStore.loading &&
    cartStore.listLoadError &&
    cartStore.items.length === 0 &&
    cartStore.invalidItems.length === 0,
);

const showNormalEmpty = computed(
  () =>
    isLoggedIn.value &&
    !cartStore.loading &&
    !cartStore.listLoadError &&
    cartStore.items.length === 0 &&
    cartStore.invalidItems.length === 0,
);

const showCartList = computed(
  () =>
    isLoggedIn.value &&
    !showSkeleton.value &&
    !showErrorEmpty.value &&
    !showNormalEmpty.value &&
    (cartStore.items.length > 0 || cartStore.invalidItems.length > 0),
);

const showSyncErrorBar = computed(
  () => isLoggedIn.value && cartStore.listLoadError && !cartStore.loading && showCartList.value,
);

/** 存在可勾选的有效商品时才允许点「全选」 */
const canSelectAll = computed(() => cartStore.items.some((i) => i.stockStatus === 'normal'));

async function refreshCartHeader(): Promise<void> {
  if (!isLoggedIn.value) {
    headerAddressText.value = '请选择收货地址';
    unusedCouponCount.value = 0;
    return;
  }
  try {
    const addr = await httpGet<AddressVo | null>('/client/address/default', undefined, undefined, {
      hideErrorToast: true,
    });
    headerAddressText.value = addr?.fullAddress?.trim() ? addr.fullAddress : '请选择收货地址';
  } catch {
    headerAddressText.value = '请选择收货地址';
  }
  unusedCouponCount.value = await fetchUnusedCouponTotal();
}

onShow(async () => {
  if (!isLoggedIn.value) return;
  await refreshCartHeader();
  if (import.meta.env.DEV) {
    cartStore.applyDevMockCart(MOCK_CART_ITEMS);
    return;
  }
  if (locationStore.currentTenantId) {
    await cartStore.fetchCartList();
  }
});

watch(
  () => locationStore.currentTenantId,
  async (newVal) => {
    if (!isLoggedIn.value) return;
    if (import.meta.env.DEV) {
      cartStore.applyDevMockCart(MOCK_CART_ITEMS);
      return;
    }
    if (newVal) {
      await cartStore.fetchCartList();
    }
  },
);

watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    void refreshCartHeader();
    if (import.meta.env.DEV) {
      cartStore.applyDevMockCart(MOCK_CART_ITEMS);
    }
  } else {
    headerAddressText.value = '请选择收货地址';
    unusedCouponCount.value = 0;
  }
});

watch(showCartList, (hasList) => {
  if (!hasList) {
    isEditing.value = false;
  }
});

function toggleEditMode() {
  isEditing.value = !isEditing.value;
}

function goAddressList() {
  uni.navigateTo({ url: '/pages/address/list' });
}

function onFrequentBuy() {
  uni.showToast({ title: '常买清单开发中', icon: 'none' });
}

function onOpenCoupons() {
  uni.showToast({ title: '优惠券列表开发中', icon: 'none' });
}

async function retryFetch() {
  if (import.meta.env.DEV) {
    cartStore.applyDevMockCart(MOCK_CART_ITEMS);
  } else {
    await cartStore.fetchCartList();
  }
  await refreshCartHeader();
}

async function onQuantityChange(item: CartItem, event: { value: string | number }) {
  const value = typeof event.value === 'string' ? Number.parseInt(event.value, 10) : event.value;
  if (value < 1 || Number.isNaN(value)) return;
  item.quantity = value;
  await cartStore.updateQuantity(item.skuId, value, item.activityContextKey);
}

async function onDelete(item: CartItem) {
  const res = await uni.showModal({
    title: '提示',
    content: '确定删除该商品吗？',
  });
  if (res.confirm) {
    await cartStore.removeItem(item.id);
  }
}

async function clearInvalid() {
  if (cartStore.invalidItems.length === 0) return;
  const res = await uni.showModal({
    title: '提示',
    content: '确定清空无效商品吗？',
  });
  if (res.confirm) {
    await cartStore.clearInvalidItems();
  }
}

async function deleteSelected() {
  const selected = cartStore.selectedItems;
  if (selected.length === 0) {
    uni.showToast({ title: '请选择要删除的商品', icon: 'none' });
    return;
  }

  const res = await uni.showModal({
    title: '提示',
    content: `确定删除选中的${selected.length}件商品吗？`,
  });
  if (res.confirm) {
    for (const item of selected) {
      await cartStore.removeItem(item.id);
    }
    isEditing.value = false;
  }
}

function onToggleAll() {
  cartStore.toggleAll(!cartStore.isAllChecked);
}

function goCheckout() {
  if (cartStore.selectedCount === 0) {
    uni.showToast({ title: '请选择商品', icon: 'none' });
    return;
  }

  const hasChanged = cartStore.selectedItems.some((i) => i.priceChanged);
  if (hasChanged) {
    uni.showModal({
      title: '价格变动提示',
      content: '部分商品价格已更新，是否继续结算？',
      success: (res) => {
        if (res.confirm) {
          navigateToCheckout();
        }
      },
    });
  } else {
    navigateToCheckout();
  }
}

function navigateToCheckout() {
  uni.navigateTo({
    url: '/pages/order/create',
  });
}

function goLogin() {
  authStore.openAuthModal();
}

function goToDetail(productId: string) {
  uni.navigateTo({
    url: `/pages/product/detail?id=${productId}`,
  });
}

function goShopping() {
  uni.switchTab({
    url: '/pages/category/category',
  });
}
</script>

<template>
  <!--
    微信要求 page-meta 为页面首节点且禁止 wx:if/v-if（见官方文档）。
    未登录态同样适用 overflow:hidden，与 definePage.disableScroll 一致。
  -->
  <page-meta page-style="overflow: hidden;" />
  <view
    class="page-root bg-fill"
    :class="
      isLoggedIn
        ? 'page-root--logged overflow-hidden'
        : 'page-root--guest flex min-h-[calc(100vh-var(--tabbar-total-height))] flex-col pb-100rpx'
    "
  >
    <CartEmptyState v-if="!isLoggedIn" description="登录后可同步购物车商品" button-text="去登录" @primary="goLogin" />

    <view v-else class="cart-logged-shell">
      <view class="cart-top-fixed-wrap">
        <CartTopBar
          :address-text="headerAddressText"
          :coupon-count="unusedCouponCount"
          :is-editing="isEditing"
          :show-manage="showCartList"
          @open-address="goAddressList"
          @frequent-buy="onFrequentBuy"
          @open-coupons="onOpenCoupons"
          @toggle-manage="toggleEditMode"
        />
      </view>

      <!-- 有商品：仅中间固定框内滚动；顶栏、底栏 fixed 脱离文档流 -->
      <scroll-view v-if="showCartList" scroll-y :show-scrollbar="false" class="cart-scroll-fixed">
        <view class="cart-scroll-inner bg-fill">
          <CartSyncErrorBar v-if="showSyncErrorBar" @retry="retryFetch" />

          <view
            class="mx-space-md box-border flex items-center border border-line rounded-card bg-surface px-space-md py-space-xs shadow-card"
          >
            <wd-icon name="shop" size="32rpx" class="text-primary" />
            <text class="ml-space-xs flex-1 text-body-lg text-ink font-medium">
              {{ locationStore.locationDisplayName || '当前门店' }}
            </text>
          </view>

          <CartLineItem
            v-for="item in cartStore.items"
            :key="item.id"
            :item="item"
            @toggle-check="cartStore.toggleCheck(item.id)"
            @quantity-change="(e) => onQuantityChange(item, e)"
            @delete="onDelete(item)"
            @detail="goToDetail(item.productId)"
          />

          <CartInvalidSection :items="cartStore.invalidItems" @clear="clearInvalid" />
        </view>
      </scroll-view>

      <!-- 骨架 / 空态：与列表区同一块「中间视口」，不单独占滚动容器 -->
      <view v-else class="cart-middle-fixed bg-fill">
        <view v-if="showSkeleton" class="skeleton-stack px-space-md pt-space-sm">
          <view v-for="n in 4" :key="n" class="skeleton-row">
            <view class="skeleton-checkbox skeleton-pulse" />
            <view class="skeleton-img skeleton-pulse" />
            <view class="skeleton-body">
              <view class="skeleton-line skeleton-pulse w-80%" />
              <view class="skeleton-line skeleton-pulse w-50%" />
              <view class="skeleton-line skeleton-pulse mt-auto w-40%" />
            </view>
          </view>
        </view>

        <CartEmptyState
          v-else-if="showErrorEmpty"
          description="加载失败，请检查网络后重试"
          button-text="重新加载"
          @primary="retryFetch"
        />

        <CartEmptyState
          v-else-if="showNormalEmpty"
          description="购物车还是空的"
          button-text="去逛逛"
          button-variant="ghost"
          @primary="goShopping"
        />
      </view>

      <!-- 登录后始终展示底栏；无商品或无选中时按钮已禁用 -->
      <CartCheckoutBar
        :is-editing="isEditing"
        :is-all-checked="cartStore.isAllChecked"
        :selected-count="cartStore.selectedCount"
        :selected-total="cartStore.selectedTotal"
        :select-all-disabled="!canSelectAll"
        @toggle-all="onToggleAll"
        @checkout="goCheckout"
        @delete-selected="deleteSelected"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-root {
  box-sizing: border-box;
}

/**
 * 登录后：顶栏、底栏 fixed；中间区域 fixed 钉在两者之间，仅内部 scroll-view 滚动。
 * H5：fixed 相对视口，须加 var(--window-top) 避开原生导航栏；小程序内容区已在导航下 top 用 0。
 */
.page-root--logged {
  /**
   * 与 CartTopBar 实际高度对齐：原 120rpx 常大于单行地址栏（约 py-xs + min-h-72rpx），
   * H5 宽屏下 rpx 换算后会在「地址栏」与列表首行「当前门店」之间留出明显空白。
   */
  --cart-address-strip-height: 100rpx;
  --cart-checkout-bar-height: 128rpx;
  position: relative;
  height: calc(100vh - var(--tabbar-total-height));
}

/* #ifdef H5 */
/**
 * 与分类页一致：H5 上避免 uni-page-body 整页滚动；顶栏/中间区/结算条仍为内部 fixed。
 */
.page-root--logged {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: var(--tabbar-total-height);
  width: 100%;
  box-sizing: border-box;
  height: auto;
  max-height: none;
  min-height: 0;
}

.cart-scroll-fixed,
.cart-middle-fixed {
  min-height: 0;
  max-height: 100%;
}

/** 未登录：默认导航栏下整块区域固定，避免 H5 整页滚动 */
.page-root--guest {
  position: fixed;
  top: var(--window-top, 44px);
  right: 0;
  left: 0;
  bottom: var(--tabbar-total-height);
  width: 100%;
  box-sizing: border-box;
  min-height: 0 !important;
  height: auto;
  max-height: none;
  overflow: hidden;
  padding-bottom: 0;
}

/* #endif */

.cart-logged-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.cart-top-fixed-wrap {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: 2000;
  box-sizing: border-box;
  /** 与 page-root bg-fill 一致，避免顶栏单独白底块 */
  background-color: var(--color-bg-body);
}

.cart-scroll-fixed,
.cart-middle-fixed {
  position: fixed;
  right: 0;
  bottom: calc(var(--tabbar-total-height) + var(--cart-checkout-bar-height));
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  top: var(--cart-address-strip-height);
}

/* #ifdef H5 */
.cart-top-fixed-wrap {
  top: var(--window-top, 44px);
}

.cart-scroll-fixed,
.cart-middle-fixed {
  top: calc(var(--window-top, 44px) + var(--cart-address-strip-height));
}

/* #endif */

.cart-scroll-fixed {
  overflow: hidden;
}

.cart-scroll-inner {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.cart-middle-fixed {
  display: flex;
  overflow: hidden;
  flex-direction: column;
}

.skeleton-stack {
  display: flex;
  flex-direction: column;
}

.skeleton-row {
  display: flex;
  align-items: flex-start;
  padding: var(--space-md) 0;
  gap: var(--space-sm);
}

.skeleton-checkbox {
  width: 40rpx;
  height: 40rpx;
  margin-top: 48rpx;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-img {
  width: 160rpx;
  height: 160rpx;
  border-radius: var(--radius-card);
  flex-shrink: 0;
}

.skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 160rpx;
  gap: var(--space-sm);
}

.skeleton-line {
  height: 28rpx;
  border-radius: var(--radius-sm);
}

.skeleton-pulse {
  background-color: var(--color-border-default);
  animation: sk-pulse 1.2s ease-in-out infinite;
}

@keyframes sk-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}
</style>
