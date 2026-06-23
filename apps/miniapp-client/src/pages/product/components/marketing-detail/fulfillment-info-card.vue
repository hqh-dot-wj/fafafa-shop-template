<script lang="ts" setup>
/**
 * 报名前确认卡片 — 按原型 FulfillmentBlock 布局重构。
 *
 * 拼课时显示：上课地点 / 上课时间 / 成班规则 / 失败处理
 * 非拼课时不渲染（v-if="isCourseGroup"）
 * 有阻断原因时仅显示阻断提示
 */
import type { FulfillmentInfoProps } from './marketing-detail.types';

defineProps<FulfillmentInfoProps>();
</script>

<template>
  <view v-if="isCourseGroup" class="fulfill-card">
    <view v-if="blockedReason" class="fulfill-card__blocked">
      <view class="fulfill-card__blocked-inner">
        <view class="i-carbon-warning-alt fulfill-card__blocked-icon" />
        <text class="fulfill-card__blocked-text">{{ blockedReason }}</text>
      </view>
    </view>

    <template v-else>
      <text class="fulfill-card__title">报名前请确认</text>

      <view class="fulfill-card__rows">
        <view v-if="addressText" class="fulfill-card__row">
          <text class="fulfill-card__label">上课地点</text>
          <text class="fulfill-card__value">{{ addressText }}</text>
        </view>
        <view v-if="scheduleText" class="fulfill-card__row">
          <text class="fulfill-card__label">上课时间</text>
          <text class="fulfill-card__value">{{ scheduleText }}</text>
        </view>
        <view v-if="countText" class="fulfill-card__row">
          <text class="fulfill-card__label">成班进度</text>
          <text class="fulfill-card__value">{{ countText }}</text>
        </view>
        <view v-if="failureHint" class="fulfill-card__row fulfill-card__row--last">
          <text class="fulfill-card__label">没成班</text>
          <text class="fulfill-card__value">{{ failureHint }}</text>
        </view>
      </view>
    </template>
  </view>
</template>

<style lang="scss" scoped>
.fulfill-card {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.fulfill-card__blocked {
  padding: 0;
}

.fulfill-card__blocked-inner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
}

.fulfill-card__blocked-icon {
  font-size: var(--font-title-large);
  color: var(--color-func-warning);
  flex-shrink: 0;
  margin-top: 2rpx;
}

.fulfill-card__blocked-text {
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

.fulfill-card__title {
  display: block;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-md);
}

.fulfill-card__rows {
  display: flex;
  flex-direction: column;
}

.fulfill-card__row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-lg);
  padding: var(--space-sm) 0;
  border-bottom: 2rpx solid var(--color-border-default);
}

.fulfill-card__row--last {
  border-bottom: none;
}

.fulfill-card__row:last-child {
  border-bottom: none;
}

.fulfill-card__label {
  flex-shrink: 0;
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

.fulfill-card__value {
  font-size: var(--font-body-large);
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: right;
  line-height: var(--lh-relaxed);
}
</style>
