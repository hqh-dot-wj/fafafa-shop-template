<script lang="ts" setup>
/**
 * 非拼课商品：服务/实物属性展示卡片。
 * 接收原始 prop 值，内部格式化时长和距离。
 */
import type { SimpleRuntimeProps } from './marketing-detail.types';

defineProps<SimpleRuntimeProps>();

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
}

function formatRadius(meters?: number): string {
  if (!meters) return '';
  if (meters < 1000) return `${meters}米`;
  return `${(meters / 1000).toFixed(1)}公里`;
}
</script>

<template>
  <view v-if="isService || isReal" class="runtime-card">
    <text class="runtime-card__title">活动说明</text>

    <view class="runtime-card__list">
      <template v-if="isService">
        <view class="runtime-card__item">
          <view class="i-carbon-time runtime-card__item-icon" />
          <text>服务时长：{{ formatDuration(serviceDuration) || '待确认' }}</text>
        </view>
        <view class="runtime-card__item">
          <view class="i-carbon-area runtime-card__item-icon" />
          <text>服务范围：{{ formatRadius(serviceRadius) || '待确认' }}</text>
        </view>
        <view v-if="needBooking" class="runtime-card__item">
          <view class="i-carbon-calendar runtime-card__item-icon" />
          <text>需提前预约</text>
        </view>
      </template>

      <template v-if="isReal">
        <view class="runtime-card__item">
          <view class="i-carbon-delivery runtime-card__item-icon" />
          <text>{{ isFreeShip ? '免运费配送' : '运费另计' }}</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.runtime-card {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.runtime-card__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-md);
}

.runtime-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.runtime-card__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: var(--lh-normal);
}

.runtime-card__item-icon {
  font-size: var(--font-title-medium);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}
</style>
