<script lang="ts" setup>
import { getCourseGroupTeamStatusMeta } from '@libs/common-constants';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    minCount: number;
    maxCount: number;
    effectiveMembers?: number;
    realPaidMembers?: number;
    currentMembers?: number;
    paidMembers?: number;
    teamStatus?: string;
    compact?: boolean;
  }>(),
  {
    currentMembers: 0,
    paidMembers: 0,
    teamStatus: 'RECRUITING',
    compact: false,
  },
);

// 人数进度展示的是后端 effectiveMembers 口径，可包含虚拟补位；真实支付人数单独展示，不能混为成团人数。
const effectiveMembersValue = computed(() => props.effectiveMembers ?? props.currentMembers ?? 0);
const realPaidMembersValue = computed(() => props.realPaidMembers ?? props.paidMembers ?? 0);

const progressPercent = computed(() => {
  const target = Math.max(props.minCount, 1);
  return Math.min(100, Math.max(0, (effectiveMembersValue.value / target) * 100));
});

const remainToForm = computed(() => Math.max(props.minCount - effectiveMembersValue.value, 0));
const remainingSlots = computed(() => Math.max(props.maxCount - effectiveMembersValue.value, 0));
const paidLabel = computed(() => `${realPaidMembersValue.value} 人已支付`);
const statusMeta = computed(() => getCourseGroupTeamStatusMeta(props.teamStatus));

const statusClass = computed(() => {
  if (statusMeta.value.tone === 'success') return 'progress-status--success';
  if (statusMeta.value.tone === 'running') return 'progress-status--running';
  if (statusMeta.value.tone === 'muted') return 'progress-status--muted';
  return 'progress-status--active';
});

const hintText = computed(() => {
  if (props.teamStatus === 'FINISHED') return '本团已完课，可查看成员记录';
  if (props.teamStatus === 'IN_CLASS') return '课程进行中，按时到店上课';
  if (props.teamStatus === 'FORMED') return `已成团，剩余 ${remainingSlots.value} 个可报名名额`;
  if (props.teamStatus === 'FAILED' || props.teamStatus === 'CLOSED') return '当前团队已结束，不可继续报名';
  if (remainToForm.value > 0) return `还差 ${remainToForm.value} 人即可成团`;
  return `已达开课人数，剩余 ${remainingSlots.value} 个名额`;
});
</script>

<template>
  <view class="team-progress" :class="{ 'team-progress--compact': compact }">
    <view class="team-progress__header">
      <text class="team-progress__title">人数进度</text>
      <text class="team-progress__status" :class="statusClass">{{ statusMeta.label }}</text>
    </view>

    <view class="team-progress__meta">
      <text>{{ effectiveMembersValue }} / {{ minCount }} 人成团</text>
      <text>{{ paidLabel }}</text>
    </view>

    <view class="team-progress__track">
      <view class="team-progress__bar" :style="{ width: `${progressPercent}%` }" />
    </view>

    <view class="team-progress__footer">
      <text>{{ hintText }}</text>
      <text>最多 {{ maxCount }} 人</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.team-progress {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #fff8f2 0%, #ffffff 100%);
  border: 1rpx solid rgba(255, 122, 69, 0.14);

  &--compact {
    padding: 20rpx;
    gap: 10rpx;
  }

  &__header,
  &__meta,
  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16rpx;
  }

  &__title {
    font-size: 26rpx;
    color: #1f2937;
    font-weight: 600;
  }

  &__status {
    padding: 8rpx 18rpx;
    border-radius: 999rpx;
    font-size: 20rpx;
    font-weight: 600;

    &.progress-status--active {
      color: #d9480f;
      background: rgba(255, 122, 69, 0.14);
    }

    &.progress-status--running {
      color: #1d4ed8;
      background: rgba(59, 130, 246, 0.14);
    }

    &.progress-status--success {
      color: #15803d;
      background: rgba(34, 197, 94, 0.14);
    }

    &.progress-status--muted {
      color: #6b7280;
      background: rgba(107, 114, 128, 0.12);
    }
  }

  &__meta,
  &__footer {
    font-size: 22rpx;
    color: #6b7280;
  }

  &__track {
    width: 100%;
    height: 16rpx;
    border-radius: 999rpx;
    overflow: hidden;
    background: #fde5d8;
  }

  &__bar {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ff7a45 0%, #ff4d4f 100%);
  }
}
</style>
