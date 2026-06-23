<script lang="ts" setup>
import type { CourseGroupTeamSummary } from '@/api/course-group';
import TeamMemberProgress from './team-member-progress.vue';

defineProps<{
  team: CourseGroupTeamSummary;
  joining?: boolean;
}>();

const emit = defineEmits<{
  detail: [team: CourseGroupTeamSummary];
  join: [team: CourseGroupTeamSummary];
}>();

// 列表卡片只展示团队摘要；点击参团后页面仍会调用 join-preview 重新校验名额、门店和价格。
function formatDateTime(value?: string): string {
  if (!value) return '待定';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日 ${String(parsed.getHours()).padStart(2, '0')}:${String(
    parsed.getMinutes(),
  ).padStart(2, '0')}`;
}
</script>

<template>
  <view class="team-card" @click="emit('detail', team)">
    <view class="team-card__top">
      <view class="team-card__leader">
        <image
          class="team-card__avatar"
          :src="team.leader.avatar || '/static/images/default-avatar.png'"
          mode="aspectFill"
        />
        <view class="team-card__leader-meta">
          <view class="team-card__leader-row">
            <text class="team-card__leader-name">{{ team.leader.name }}</text>
            <text v-if="team.recommended" class="team-card__badge">推荐</text>
          </view>
          <text class="team-card__leader-subtitle">团长发起 · {{ team.tenantName || '当前门店' }}</text>
        </view>
      </view>
      <view class="i-carbon-chevron-right text-28rpx text-hex-bfbfbf" />
    </view>

    <view class="team-card__schedule">
      <view class="team-card__schedule-item">
        <text class="i-carbon-time team-card__schedule-icon" />
        <text>{{ formatDateTime(team.classStartTime) }} 开课</text>
      </view>
      <view class="team-card__schedule-item">
        <text class="i-carbon-location team-card__schedule-icon" />
        <text class="line-clamp-1">{{ team.classAddress || '门店地址待确认' }}</text>
      </view>
    </view>

    <TeamMemberProgress
      :min-count="team.minCount"
      :max-count="team.maxCount"
      :effective-members="team.effectiveMemberCount"
      :real-paid-members="team.realPaidMemberCount"
      :team-status="team.teamStatus"
      compact
    />

    <view class="team-card__bottom">
      <view class="team-card__tips">
        <text>{{ team.ruleSummary || `剩余 ${team.remainingSlots} 个名额` }}</text>
        <text v-if="!team.joinable && team.joinBlockReasonText" class="team-card__block-reason">
          {{ team.joinBlockReasonText }}
        </text>
        <text v-if="team.revenueHint">{{ team.revenueHint }}</text>
      </view>
      <wd-button
        type="primary"
        size="small"
        :loading="joining"
        :custom-class="!team.joinable ? 'team-card__button team-card__button--disabled' : 'team-card__button'"
        :disabled="!team.joinable || joining"
        @click.stop="emit('join', team)"
      >
        {{ joining ? '提交中...' : team.joinable ? '立即参团并支付' : '当前不可参团' }}
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.team-card {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.06);

  &__top,
  &__bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rpx;
  }

  &__leader {
    display: flex;
    align-items: center;
    gap: 18rpx;
    min-width: 0;
  }

  &__avatar {
    width: 84rpx;
    height: 84rpx;
    border-radius: 50%;
    background: #f3f4f6;
    flex-shrink: 0;
  }

  &__leader-meta {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
  }

  &__leader-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    min-width: 0;
  }

  &__leader-name {
    font-size: 30rpx;
    color: #111827;
    font-weight: 700;
  }

  &__badge {
    flex-shrink: 0;
    padding: 6rpx 14rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
    color: #ffffff;
    background: linear-gradient(90deg, #fa8c16 0%, #fa541c 100%);
  }

  &__leader-subtitle {
    font-size: 22rpx;
    color: #6b7280;
  }

  &__schedule {
    display: grid;
    gap: 12rpx;
  }

  &__schedule-item {
    display: flex;
    align-items: flex-start;
    gap: 10rpx;
    font-size: var(--font-body-medium);
    line-height: var(--lh-normal);
    color: var(--color-text-secondary);
  }

  &__schedule-icon {
    flex-shrink: 0;
    margin-top: 2rpx;
    font-size: 28rpx;
    line-height: 1;
    color: var(--color-brand-primary);
  }

  &__tips {
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    font-size: 22rpx;
    color: #6b7280;
  }

  &__block-reason {
    color: #d46b08;
  }

  :deep(.team-card__button) {
    min-width: 224rpx !important;
    height: 72rpx !important;
    border: none !important;
    border-radius: var(--radius-pill) !important;
    background: var(--color-brand-primary) !important;
    color: var(--color-bg-surface) !important;
    font-weight: 600 !important;
  }

  :deep(.team-card__button--disabled.is-disabled),
  :deep(.team-card__button--disabled.is-disabled .wd-button__text) {
    border: 2rpx solid var(--color-border-default) !important;
    background: var(--color-bg-body) !important;
    color: var(--color-text-tertiary) !important;
    opacity: 1 !important;
  }
}
</style>
