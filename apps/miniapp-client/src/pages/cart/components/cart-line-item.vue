<script lang="ts" setup>
import type { CartItem } from '@/store/cart';
import { computed } from 'vue';
import { formatPrice, splitMoneyParts } from '@/utils/money';

const props = defineProps<{
  item: CartItem;
}>();

const emit = defineEmits<{
  'toggle-check': [];
  'quantity-change': [payload: { value: string | number }];
  delete: [];
  detail: [];
}>();

function activityTagClass(type: string | null | undefined): string {
  const normalized = String(type || '').toUpperCase();
  if (normalized === 'FLASH_SALE') return 'bg-promo-soft text-error';
  if (normalized.includes('COURSE_GROUP')) return 'bg-primary-light text-warning';
  return 'bg-primary-light text-primary';
}

function activityTagLabel(type: string | null | undefined): string {
  const normalized = String(type || '').toUpperCase();
  if (!normalized) return '活动';
  const labels: Record<string, string> = {
    FLASH_SALE: '秒杀',
    COURSE_GROUP: '拼课',
    NEWCOMER: '新人',
    MEMBER_PRICE: '会员',
  };
  if (normalized.includes('COURSE_GROUP')) return '拼课';
  return labels[normalized] ?? '活动';
}

const displayMain = computed(() => splitMoneyParts(props.item.displayPriceSnapshot ?? props.item.currentPrice));
const displayStrikeCurrent = computed(() => formatPrice(props.item.currentPrice));
const displayStrikeAdd = computed(() => formatPrice(props.item.addPrice));
</script>

<template>
  <view
    class="mx-space-md mt-space-sm box-border overflow-hidden border border-line rounded-card bg-surface shadow-card"
  >
    <view class="cart-line-swipe-clip">
      <wd-swipe-action custom-class="cart-line-swipe-custom">
        <view class="box-border w-full flex items-center bg-surface p-space-md">
          <view class="flex shrink-0 items-center self-stretch pr-space-xs">
            <wd-checkbox
              :model-value="item.checked"
              :disabled="item.stockStatus !== 'normal'"
              hover-class="opacity-80"
              @change="emit('toggle-check')"
            />
          </view>

          <image
            class="mr-space-sm h-160rpx w-160rpx flex-shrink-0 rounded-card"
            :src="item.productImg || '/static/images/placeholder.png'"
            mode="aspectFill"
            lazy-load
            hover-class="opacity-90"
            @click="emit('detail')"
          />

          <view class="min-h-160rpx min-w-0 flex flex-1 flex-col" hover-class="opacity-90" @click="emit('detail')">
            <view class="min-w-0 flex flex-nowrap items-center gap-x-space-xs text-body-lg text-ink leading-snug">
              <text
                v-if="item.activityType"
                class="shrink-0 rounded-sm px-1 py-0.5 text-micro font-medium leading-none"
                :class="activityTagClass(item.activityType)"
              >
                {{ activityTagLabel(item.activityType) }}
              </text>
              <view class="min-w-0 flex-1 truncate text-body-lg text-ink leading-snug">
                {{ item.productName }}
              </view>
            </view>

            <text v-if="item.specData" class="mt-space-xs text-caption text-ink-light">
              {{ Object.values(item.specData).join(' / ') }}
            </text>

            <view v-if="item.priceChanged" class="mt-space-xs flex items-center text-micro text-warning">
              <wd-icon name="warning" size="24rpx" class="text-warning" />
              <text class="ml-6rpx">价格已更新</text>
            </view>

            <text v-if="item.stockStatus === 'insufficient'" class="mt-space-xs text-micro text-warning">库存不足</text>
            <text v-else-if="item.stockStatus === 'soldOut'" class="mt-space-xs text-micro text-error">已售罄</text>

            <view class="mt-auto flex items-center justify-between">
              <view class="flex items-baseline text-price">
                <text class="text-caption">¥</text>
                <text class="text-display-md font-bold">{{ displayMain.int }}</text>
                <text class="text-body-lg">.{{ displayMain.dec }}</text>
                <text v-if="item.displayPriceSnapshot" class="ml-space-sm text-caption text-ink-lighter line-through">
                  ¥{{ displayStrikeCurrent }}
                </text>
                <text v-else-if="item.priceChanged" class="ml-space-sm text-caption text-ink-lighter line-through">
                  ¥{{ displayStrikeAdd }}
                </text>
              </view>
              <wd-input-number
                :model-value="item.quantity"
                :min="1"
                :max="99"
                :disabled="item.stockStatus !== 'normal'"
                size="small"
                @change="(e: { value: string | number }) => emit('quantity-change', e)"
              />
            </view>
          </view>
        </view>

        <template #right>
          <view
            class="h-full w-150rpx flex items-center justify-center bg-error text-body-lg text-surface"
            hover-class="opacity-90"
            @click="emit('delete')"
          >
            删除
          </view>
        </template>
      </wd-swipe-action>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cart-line-swipe-clip {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-card);
  transform: translate3d(0, 0, 0);
}

.cart-line-swipe-clip::after {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 4;
  width: 6rpx;
  height: 100%;
  pointer-events: none;
  content: '';
  background-color: var(--color-bg-surface);
  border-top-right-radius: var(--radius-card);
  border-bottom-right-radius: var(--radius-card);
}

.cart-line-swipe-clip :deep(.cart-line-swipe-custom) {
  width: 100%;
  overflow: hidden;
}

.cart-line-swipe-clip :deep(.wd-swipe-action__wrapper) {
  overflow: hidden;
  border-radius: var(--radius-card);
}

.cart-line-swipe-clip :deep(.wd-swipe-action__right) {
  transform: translate3d(calc(100% + 4px), 0, 0) !important;
  -webkit-transform: translate3d(calc(100% + 4px), 0, 0) !important;
}
</style>
