<script lang="ts" setup>
/**
 * 拼课 SKU 已参与活动，但当前无可直接加入的推荐团（无团 / 仅已成团）。
 * 与 RecommendedTeamCard（有团）区分，避免复用头像墙与错误进度文案。
 */
import type { CourseGroupPendingProps } from './marketing-detail.types';

const props = withDefaults(defineProps<CourseGroupPendingProps>(), {
  headerTitle: '暂无可直接加入的团',
  hintText: '可先自己开团，或查看全部正在招募的团',
  canOpen: false,
  opening: false,
});

const emit = defineEmits<{
  browseTeams: [];
  openGroup: [];
}>();
</script>

<template>
  <view class="cg-pending">
    <view class="cg-pending__header">
      <text class="cg-pending__title">{{ headerTitle }}</text>
      <view v-if="storeName" class="cg-pending__store-pill">
        <view class="i-carbon-location cg-pending__store-icon" />
        <text>{{ storeName }}</text>
      </view>
    </view>

    <text class="cg-pending__hint">{{ hintText }}</text>

    <view class="cg-pending__info">
      <view v-if="countText" class="cg-pending__row">
        <text class="cg-pending__label">成班规则</text>
        <text class="cg-pending__value">{{ countText }}</text>
      </view>
      <view v-if="scheduleText" class="cg-pending__row">
        <text class="cg-pending__label">参考开课</text>
        <text class="cg-pending__value">{{ scheduleText }}</text>
      </view>
      <view v-if="addressText" class="cg-pending__row">
        <text class="cg-pending__label">上课地点</text>
        <text class="cg-pending__value">{{ addressText }}</text>
      </view>
    </view>

    <view class="cg-pending__actions">
      <button class="cg-pending__btn cg-pending__btn--secondary" @click="emit('browseTeams')">查看全部团</button>
      <button
        class="cg-pending__btn cg-pending__btn--primary"
        :disabled="!canOpen || opening"
        @click="emit('openGroup')"
      >
        {{ opening ? '提交中...' : '自己开团' }}
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.cg-pending {
  margin: var(--space-sm) var(--space-sm) 0;
  padding: var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
}

.cg-pending__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}

.cg-pending__title {
  flex: 1;
  font-size: var(--font-title-medium);
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: var(--lh-snug);
}

.cg-pending__store-pill {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
  font-size: var(--font-caption);
  font-weight: 700;
}

.cg-pending__hint {
  display: block;
  margin-top: var(--space-xs);
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

.cg-pending__info {
  margin-top: var(--space-md);
  padding: var(--space-md);
  border-radius: var(--radius-card);
  background: var(--color-bg-body);
}

.cg-pending__row {
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  & + & {
    margin-top: var(--space-sm);
  }
}

.cg-pending__label {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.cg-pending__value {
  font-size: var(--font-body-large);
  color: var(--color-text-primary);
  line-height: var(--lh-relaxed);
}

.cg-pending__actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.cg-pending__btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: var(--font-body-large);
  font-weight: 600;
  border-radius: var(--radius-pill);
  border: none;

  &--secondary {
    background: var(--color-bg-body);
    color: var(--color-text-primary);
  }

  &--primary {
    background: var(--color-brand-primary);
    color: var(--color-text-inverse);
  }

  &[disabled] {
    opacity: 0.5;
  }
}
</style>
