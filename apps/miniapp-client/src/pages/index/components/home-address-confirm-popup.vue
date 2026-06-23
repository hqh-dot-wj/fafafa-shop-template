<script lang="ts" setup>
/** 收货地址列表项（用于多选展示） */
export interface HomeShippingAddressItem {
  id: string;
  line: string;
  tag?: string;
}

export type HomeAddressConfirmPayload = { mode: 'location' } | { mode: 'shipping'; addressId: string };

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 当前定位展示文案 */
    locationLine: string;
    /** 收货地址列表（空则仅展示定位） */
    shippingItems: HomeShippingAddressItem[];
    /** 是否允许确认「当前定位」 */
    canPickLocation?: boolean;
  }>(),
  {
    canPickLocation: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [payload: HomeAddressConfirmPayload];
  'change-address': [];
}>();

/** 选中项：'location' 或收货地址 id */
const selectedKey = ref<'location' | string>('location');

/** 每次打开弹层默认选中「当前定位」，不默认选中收货地址 */
function resolveInitialSelection(): 'location' | string {
  return 'location';
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedKey.value = resolveInitialSelection();
    }
  },
);

function onMoreAddresses() {
  emit('change-address');
}

function onConfirm() {
  if (selectedKey.value === 'location') {
    if (!props.canPickLocation) {
      return;
    }
    emit('confirm', { mode: 'location' });
    return;
  }
  const id = selectedKey.value;
  if (!props.shippingItems.some((i) => i.id === id)) {
    return;
  }
  emit('confirm', { mode: 'shipping', addressId: id });
}

function selectLocation() {
  if (!props.canPickLocation) {
    return;
  }
  selectedKey.value = 'location';
}

function selectShipping(id: string) {
  selectedKey.value = id;
}

function isShippingSelected(id: string): boolean {
  return selectedKey.value === id;
}

/** 超过 2 条时固定可视高度约两行，其余滚动查看（scroll-view 需明确高度，小程序才生效） */
const shippingListScrollable = computed(() => props.shippingItems.length > 2);
</script>

<template>
  <wd-popup
    :model-value="modelValue"
    position="center"
    :close-on-click-modal="false"
    :z-index="10002"
    :lock-scroll="true"
    custom-class="home-address-popup-root"
    custom-style="width: 86%; max-width: 640rpx; background: transparent;"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <view class="home-address-popup-card bg-surface" @touchmove.stop>
      <view class="home-address-popup-card__header px-space-lg pb-space-sm pt-space-lg">
        <view class="text-center text-title-md text-ink font-bold">请确认地址</view>
        <view class="home-address-popup-card__title-rule mt-space-sm" />
      </view>

      <view class="home-address-popup-card__body px-space-lg pb-space-md">
        <!-- 当前定位 -->
        <view class="pick-row flex items-center" hover-class="opacity-90" @click="selectLocation">
          <view class="pick-row__main min-w-0 flex-1">
            <text class="pick-row__label">当前定位：</text>
            <text class="pick-row__addr block text-body-md text-ink">{{ locationLine }}</text>
          </view>
          <view class="radio-indicator" :class="{ 'radio-indicator--on': selectedKey === 'location' }">
            <text v-if="selectedKey === 'location'" class="radio-indicator__check">✓</text>
          </view>
        </view>

        <view v-if="shippingItems.length > 0" class="section-rule" />

        <!-- 收货地址：≤2 条全展；>2 条仅可视约两行高度，其余纵向滚动 -->
        <template v-if="shippingItems.length > 0">
          <view class="section-label text-caption text-ink-light">收货地址：</view>
          <scroll-view
            v-if="shippingListScrollable"
            class="shipping-list-scroll"
            scroll-y
            :show-scrollbar="true"
            :enable-flex="true"
          >
            <view
              v-for="item in shippingItems"
              :key="item.id"
              class="pick-row flex items-center"
              hover-class="opacity-90"
              @click="selectShipping(item.id)"
            >
              <view class="pick-row__main min-w-0 flex-1">
                <view class="address-line-row min-w-0 flex flex-1 flex-nowrap items-center gap-space-xs">
                  <wd-tag v-if="item.tag?.trim()" custom-class="address-select-tag" type="primary">
                    {{ item.tag.trim() }}
                  </wd-tag>
                  <text class="pick-row__addr min-w-0 flex-1 truncate text-body-lg text-ink leading-[1.5]">{{
                    item.line
                  }}</text>
                </view>
              </view>
              <view class="radio-indicator" :class="{ 'radio-indicator--on': isShippingSelected(item.id) }">
                <text v-if="isShippingSelected(item.id)" class="radio-indicator__check">✓</text>
              </view>
            </view>
          </scroll-view>
          <view v-else class="shipping-list-static">
            <view
              v-for="item in shippingItems"
              :key="item.id"
              class="pick-row flex items-center"
              hover-class="opacity-90"
              @click="selectShipping(item.id)"
            >
              <view class="pick-row__main min-w-0 flex-1">
                <view class="address-line-row min-w-0 flex flex-1 flex-nowrap items-center gap-space-xs">
                  <wd-tag v-if="item.tag?.trim()" custom-class="address-select-tag" type="primary">
                    {{ item.tag.trim() }}
                  </wd-tag>
                  <text class="pick-row__addr min-w-0 flex-1 truncate text-body-lg text-ink leading-[1.5]">{{
                    item.line
                  }}</text>
                </view>
              </view>
              <view class="radio-indicator" :class="{ 'radio-indicator--on': isShippingSelected(item.id) }">
                <text v-if="isShippingSelected(item.id)" class="radio-indicator__check">✓</text>
              </view>
            </view>
          </view>
        </template>

        <view class="footer-rule mt-space-md" />

        <view class="mt-space-md flex gap-space-xs">
          <button
            class="btn-ghost-more flex-1 text-body-md text-ink font-medium"
            hover-class="opacity-80"
            @click="onMoreAddresses"
          >
            更多地址
          </button>
          <button
            class="btn-primary-compact flex-1 text-body-md text-white font-medium"
            hover-class="opacity-90"
            @click="onConfirm"
          >
            确认选择
          </button>
        </view>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss">
/* wot wd-popup 根节点默认直角白底，仅内层圆角时四角会露出父级；透明底由内容区承担圆角卡片 */
.home-address-popup-root.wd-popup {
  background: transparent !important;
  box-shadow: none;
}
</style>

<style lang="scss" scoped>
.home-address-popup-card {
  box-sizing: border-box;
  border-radius: var(--radius-popup);
  border: 1rpx solid var(--color-border-default);
  overflow: hidden;
}

.home-address-popup-card__title-rule {
  height: 1rpx;
  background-color: var(--color-border-default);
  opacity: 0.85;
}

.home-address-popup-card__body {
  box-sizing: border-box;
}

.pick-row {
  box-sizing: border-box;
  min-height: var(--tap-target-min);
  padding: var(--space-sm) 0;
}

.pick-row__label {
  display: block;
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  line-height: var(--lh-normal);
}

.pick-row__addr {
  margin-top: var(--space-xs);
  line-height: var(--lh-relaxed);
  word-break: break-all;
}

.pick-row__main .address-line-row .pick-row__addr {
  margin-top: 0;
  min-width: 0;
  flex: 1;
}

/** 与地址列表 / 选择地址页「家、公司」等 wd-tag 一致 */
.address-line-row {
  align-items: center;
}

:deep(.address-select-tag) {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.section-label {
  padding-top: var(--space-xs);
  padding-bottom: var(--space-xs);
}

/* 约两行：2×最小热区 + 额外间距，供单行地址；多行时略紧但仍可滚动看全 */
.shipping-list-scroll {
  box-sizing: border-box;
  height: calc(var(--tap-target-min) * 2 + var(--space-xl));
}

.shipping-list-static {
  box-sizing: border-box;
}

.section-rule,
.footer-rule {
  height: 1rpx;
  background-color: var(--color-border-default);
  margin: 0 calc(-1 * var(--space-lg));
  width: calc(100% + 2 * var(--space-lg));
}

.footer-rule {
  margin-top: 0;
  margin-bottom: 0;
}

.radio-indicator {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  margin-left: var(--space-sm);
  border: 2rpx solid var(--color-text-tertiary);
  border-radius: 50%;
}

.radio-indicator--on {
  border-color: var(--color-brand-primary);
  background-color: var(--color-brand-primary);
}

.radio-indicator__check {
  font-size: var(--font-caption);
  font-weight: 700;
  line-height: 1;
  color: var(--color-bg-surface);
}

button::after {
  border: none;
}

.btn-ghost-more {
  box-sizing: border-box;
  margin: 0;
  min-height: 0;
  line-height: var(--lh-normal);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  border: 1rpx solid var(--color-border-default);
  background: transparent;
}

.btn-primary-compact {
  box-sizing: border-box;
  margin: 0;
  min-height: 0;
  line-height: var(--lh-normal);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  border: 1rpx solid transparent;
  background-color: var(--color-brand-primary);
}
</style>
