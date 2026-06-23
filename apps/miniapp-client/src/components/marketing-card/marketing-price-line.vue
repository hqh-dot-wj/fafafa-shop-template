<script lang="ts" setup>
import { computed } from 'vue';
import { formatPrice } from '@/utils/money';

const props = defineProps<{
  priceLabel?: string;
  currentPrice?: number;
  originalPrice?: number;
  size?: 'xl' | 'lg' | 'md';
}>();

const priceText = computed(() => {
  if (!Number.isFinite(Number(props.currentPrice))) return '';
  return formatPrice(props.currentPrice);
});

const originPriceText = computed(() => {
  if (!Number.isFinite(Number(props.originalPrice))) return '';
  return formatPrice(props.originalPrice);
});

const showOriginPrice = computed(() => Boolean(originPriceText.value && originPriceText.value !== priceText.value));
</script>

<template>
  <view class="mkt-price-line" :class="size ? `mkt-price-line--${size}` : ''">
    <view v-if="priceLabel" class="mkt-price-line__label">
      <text>{{ priceLabel }}</text>
    </view>
    <view v-if="priceText" class="mkt-price-line__row">
      <text class="mkt-price-line__symbol">¥</text>
      <text
        class="mkt-price-line__main"
        :class="{
          'mkt-price-line__main--lg': size === 'lg',
          'mkt-price-line__main--xl': size === 'xl',
        }"
      >
        {{ priceText }}
      </text>
      <text v-if="showOriginPrice" class="mkt-price-line__origin">¥{{ originPriceText }}</text>
    </view>
    <text v-else class="mkt-price-line__consult">到店咨询</text>
  </view>
</template>

<style lang="scss" scoped>
.mkt-price-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx 12rpx;
}

.mkt-price-line__label {
  padding: 4rpx 12rpx;
  border-radius: var(--radius-sm, 8rpx);
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.4;
}

.mkt-price-line__row {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  color: var(--color-price);
}

.mkt-price-line__symbol {
  font-size: 24rpx;
  font-weight: 600;
}

.mkt-price-line__main {
  font-size: 36rpx;
  font-weight: 700;
  line-height: 1;
}

.mkt-price-line__main--lg {
  font-size: 48rpx;
}

.mkt-price-line__main--xl {
  font-size: 52rpx;
}

.mkt-price-line--xl .mkt-price-line__symbol {
  font-size: 30rpx;
}

.mkt-price-line--xl .mkt-price-line__label {
  font-size: 26rpx;
}

.mkt-price-line--xl .mkt-price-line__origin {
  font-size: 28rpx;
}

.mkt-price-line--xl .mkt-price-line__consult {
  font-size: 32rpx;
}

.mkt-price-line__origin {
  margin-left: 8rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  text-decoration: line-through;
}

.mkt-price-line__consult {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  font-weight: 600;
}
</style>
