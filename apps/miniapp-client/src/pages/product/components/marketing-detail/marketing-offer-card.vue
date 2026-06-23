<script lang="ts" setup>
import type { MarketingOfferProps } from './marketing-detail.types';
import MarketingPriceLine from '@/components/marketing-card/marketing-price-line.vue';

defineProps<MarketingOfferProps>();
</script>

<template>
  <view class="offer-card">
    <view class="offer-card__price-panel">
      <MarketingPriceLine
        :price-label="priceLabel"
        :current-price="Number(displayPrice)"
        :original-price="originalPrice != null ? Number(originalPrice) : undefined"
        size="lg"
      />
    </view>

    <view v-if="offerTitle || offerDesc" class="offer-card__intro">
      <text v-if="offerTitle" class="offer-card__title">{{ offerTitle }}</text>
      <text v-if="offerDesc" class="offer-card__desc">{{ offerDesc }}</text>
    </view>

    <view v-if="explainItems?.length" class="offer-card__explains">
      <view v-for="(item, index) in explainItems" :key="index" class="offer-card__explain-row">
        <view class="offer-card__explain-num">{{ index + 1 }}</view>
        <text class="offer-card__explain-text">{{ item }}</text>
      </view>
    </view>

    <view
      v-if="commissionHint"
      class="offer-card__commission"
      :class="{ 'offer-card__commission--active': canEarnCommission }"
    >
      <view class="i-carbon-wallet offer-card__commission-icon" />
      <text>{{ commissionHint }}</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.offer-card {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.offer-card__price-panel {
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-card);
  background: var(--color-bg-promo-soft);
}

.offer-card__intro {
  margin-top: var(--space-lg);
}

.offer-card__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-snug);
}

.offer-card__desc {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

.offer-card__explains {
  margin-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.offer-card__explain-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
}

.offer-card__explain-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);
  font-size: var(--font-micro);
  font-weight: 700;
  flex-shrink: 0;
}

.offer-card__explain-text {
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: var(--lh-normal);
}

.offer-card__commission {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
  color: var(--color-text-tertiary);
  font-size: var(--font-body-medium);
  line-height: var(--lh-normal);
}

.offer-card__commission--active {
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
}

.offer-card__commission-icon {
  font-size: var(--font-body-large);
  flex-shrink: 0;
}
</style>
