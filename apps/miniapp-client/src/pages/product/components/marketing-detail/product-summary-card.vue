<script lang="ts" setup>
import type { ProductSummaryProps } from './marketing-detail.types';

defineProps<ProductSummaryProps>();
</script>

<template>
  <view class="summary-card">
    <view v-if="activityBadge || storeName" class="summary-card__badges">
      <view v-if="activityBadge" class="summary-card__badge summary-card__badge--activity">
        <view class="summary-card__badge-dot" />
        <text>{{ activityBadge }}</text>
      </view>
      <view v-if="storeName" class="summary-card__badge summary-card__badge--store">
        <view class="i-carbon-location summary-card__badge-icon" />
        <text>{{ storeName }}</text>
      </view>
    </view>

    <text class="summary-card__name">{{ name }}</text>
    <text v-if="subTitle" class="summary-card__sub">{{ subTitle }}</text>
  </view>
</template>

<style lang="scss" scoped>
.summary-card {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.summary-card__badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.summary-card__badge {
  display: inline-flex;
  align-items: center;
  gap: 6rpx;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  font-size: var(--font-caption);
  font-weight: 700;
  line-height: var(--lh-normal);
}

.summary-card__badge--activity {
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
}

.summary-card__badge--store {
  background: var(--color-bg-body);
  color: var(--color-text-secondary);
}

.summary-card__badge-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-brand-primary);
}

.summary-card__badge-icon {
  font-size: var(--font-caption);
  flex-shrink: 0;
}

.summary-card__name {
  display: block;
  font-size: var(--font-title-large);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-snug);
}

.summary-card__sub {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}
</style>
