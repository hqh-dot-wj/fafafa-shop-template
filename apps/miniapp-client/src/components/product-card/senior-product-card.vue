<script lang="ts" setup>
import type { SeniorProductCardModel, SeniorProductCardVariant } from './product-card.types';
import { computed } from 'vue';
import { formatPrice } from '@/utils/money';

const props = withDefaults(
  defineProps<{
    item: SeniorProductCardModel;
    variant?: SeniorProductCardVariant;
  }>(),
  {
    variant: 'list',
  },
);

const emit = defineEmits<{
  detail: [item: SeniorProductCardModel];
}>();

const priceText = computed(() => {
  if (!Number.isFinite(Number(props.item.currentPrice))) return '';
  return formatPrice(props.item.currentPrice);
});

const originPriceText = computed(() => {
  if (!Number.isFinite(Number(props.item.originalPrice))) return '';
  return formatPrice(props.item.originalPrice);
});

const showOriginPrice = computed(() => Boolean(originPriceText.value && originPriceText.value !== priceText.value));

interface VisibleBadge {
  key: string;
  label: string;
  kind: 'product' | 'purchase';
  priority: number;
}

const visibleBadges = computed<VisibleBadge[]>(() => {
  const isBookingRequired = props.item.purchaseStatus?.code === 'BOOKING_REQUIRED';
  const productTagLimit = isBookingRequired ? 1 : 2;
  const productBadges = [...(props.item.displayTags ?? [])]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, productTagLimit)
    .map(
      (tag): VisibleBadge => ({
        key: `tag-${tag.code}`,
        label: tag.label,
        kind: 'product',
        priority: tag.priority,
      }),
    );

  if (isBookingRequired && props.item.purchaseStatus?.label) {
    productBadges.push({
      key: 'purchase-status',
      label: props.item.purchaseStatus.label,
      kind: 'purchase',
      priority: 85,
    });
  }

  return productBadges.slice(0, 2);
});

function onDetail() {
  emit('detail', props.item);
}
</script>

<template>
  <view
    class="senior-product-card"
    :class="`senior-product-card--${variant}`"
    hover-class="opacity-90"
    @click="onDetail"
  >
    <view class="senior-product-card__image-frame">
      <image
        class="senior-product-card__image"
        :src="item.imageUrl || '/static/images/placeholder.png'"
        mode="aspectFill"
        lazy-load
      />
    </view>
    <view class="senior-product-card__body">
      <text class="senior-product-card__title line-clamp-2">{{ item.title }}</text>
      <view v-if="visibleBadges.length" class="senior-product-card__badges">
        <text
          v-for="badge in visibleBadges"
          :key="badge.key"
          class="senior-product-card__badge"
          :class="`senior-product-card__badge--${badge.kind}`"
        >
          {{ badge.label }}
        </text>
      </view>
      <text v-if="item.subtitle" class="senior-product-card__subtitle line-clamp-1">{{ item.subtitle }}</text>
      <text v-if="item.explain" class="senior-product-card__explain line-clamp-2">{{ item.explain }}</text>

      <view class="senior-product-card__bottom">
        <view class="senior-product-card__price-block">
          <view v-if="item.priceLabel" class="senior-product-card__price-label">
            <text>{{ item.priceLabel }}</text>
          </view>
          <view v-if="priceText" class="senior-product-card__price-row">
            <text class="senior-product-card__price-symbol">¥</text>
            <text class="senior-product-card__price-main">{{ priceText }}</text>
            <text v-if="showOriginPrice" class="senior-product-card__price-origin">¥{{ originPriceText }}</text>
          </view>
          <text v-else class="senior-product-card__consult">到店咨询</text>
        </view>

        <button class="senior-product-card__button" @click.stop="onDetail">
          {{ item.actionText }}
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.senior-product-card {
  overflow: hidden;
  border-radius: 16rpx;
  background: var(--color-bg-surface);
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
}

.senior-product-card__image-frame {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 75%;
  overflow: hidden;
  background: var(--color-bg-category-page);
}

.senior-product-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.senior-product-card__body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx;
}

.senior-product-card__title {
  color: var(--color-text-primary);
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.45;
}

.senior-product-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  min-height: 36rpx;
}

.senior-product-card__badge {
  max-width: 150rpx;
  padding: 5rpx 12rpx;
  overflow: hidden;
  border: 1rpx solid #d8e6dd;
  border-radius: 8rpx;
  background: #f3faf6;
  color: #276749;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.senior-product-card__badge--purchase {
  border-color: #f2d7a6;
  background: #fff8e6;
  color: #8a5a00;
}

.senior-product-card__subtitle {
  color: var(--color-text-secondary);
  font-size: 26rpx;
  line-height: 1.45;
}

.senior-product-card__explain {
  color: #8a5a00;
  font-size: 25rpx;
  line-height: 1.5;
}

.senior-product-card__bottom {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 2rpx;
}

.senior-product-card__price-block {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10rpx 12rpx;
  min-height: 48rpx;
}

.senior-product-card__price-label {
  padding: 5rpx 12rpx;
  border-radius: 8rpx;
  background: #fff2e8;
  color: #c2410c;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.35;
}

.senior-product-card__price-row {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
  color: var(--color-price, #e02020);
}

.senior-product-card__price-symbol {
  font-size: 24rpx;
  font-weight: 600;
}

.senior-product-card__price-main {
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1;
}

.senior-product-card__price-origin {
  margin-left: 10rpx;
  color: var(--color-text-tertiary);
  font-size: 24rpx;
  text-decoration: line-through;
}

.senior-product-card__consult {
  color: var(--color-text-secondary);
  font-size: 28rpx;
  font-weight: 600;
}

.senior-product-card__button {
  width: 100%;
  height: 76rpx;
  margin: 0;
  border: none;
  border-radius: 12rpx;
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 76rpx;
}

.senior-product-card__button::after {
  border: none;
}

.senior-product-card--category {
  border-radius: 14rpx;
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.07);
}

.senior-product-card--category .senior-product-card__body {
  gap: 10rpx;
  padding: 18rpx;
}

.senior-product-card--category .senior-product-card__title {
  font-size: 30rpx;
}

.senior-product-card--category .senior-product-card__button {
  height: 68rpx;
  font-size: 28rpx;
  line-height: 68rpx;
}
</style>
