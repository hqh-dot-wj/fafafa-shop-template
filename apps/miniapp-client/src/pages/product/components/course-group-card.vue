<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    displayPrice: string | number;
    originalPrice?: string | number | null;
    storeName?: string;
    countText: string;
    scheduleText: string;
    addressText: string;
    joinableTeamCount?: number;
    latestTeamSummary?: string;
    openQualificationText?: string;
    commissionHint?: string;
    failureHint?: string;
    canOpen?: boolean;
    canJoin?: boolean;
    opening?: boolean;
  }>(),
  {
    storeName: '',
    originalPrice: null,
    joinableTeamCount: 0,
    latestTeamSummary: '',
    openQualificationText: '',
    commissionHint: '',
    failureHint: '',
    canOpen: false,
    canJoin: true,
    opening: false,
  },
);

// 商品详情里的拼课卡片展示后端活动摘要，按钮只发出开团/参团意图。
// 展示价、可开团、可参团都不能替代订单页和 CourseGroupClientController 的最终校验。
const emit = defineEmits<{
  openGroup: [];
  joinGroup: [];
}>();

const priceText = computed(() => Number(props.displayPrice || 0).toFixed(2));
const originalPriceText = computed(() => {
  const n = Number(props.originalPrice ?? Number.NaN);
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
});

function onOpenGroup() {
  emit('openGroup');
}

function onJoinGroup() {
  emit('joinGroup');
}
</script>

<template>
  <view class="course-card">
    <view class="course-card__head">
      <view class="course-card__title-wrap">
        <text class="course-card__title">拼课专享</text>
        <text class="course-card__store">{{ storeName || '当前门店待定' }}</text>
      </view>
      <view class="course-card__price-wrap">
        <text class="course-card__price">¥{{ priceText }}</text>
        <text v-if="originalPriceText && originalPriceText !== priceText" class="course-card__origin"
          >¥{{ originalPriceText }}</text
        >
      </view>
    </view>

    <view class="course-card__rule">
      <text>{{ countText }}</text>
    </view>
    <view class="course-card__row"
      ><text>上课时间</text><text>{{ scheduleText }}</text></view
    >
    <view class="course-card__row"
      ><text>上课地址</text><text>{{ addressText }}</text></view
    >
    <view class="course-card__row"
      ><text>可加入团数</text><text>{{ joinableTeamCount }}</text></view
    >
    <view v-if="latestTeamSummary" class="course-card__latest">{{ latestTeamSummary }}</view>
    <view v-if="openQualificationText" class="course-card__hint">{{ openQualificationText }}</view>
    <view v-if="commissionHint" class="course-card__hint">{{ commissionHint }}</view>
    <view v-if="failureHint" class="course-card__hint">{{ failureHint }}</view>

    <view class="course-card__actions">
      <button class="course-card__btn course-card__btn--open" :disabled="!canOpen || opening" @click="onOpenGroup">
        {{ opening ? '提交中...' : '我要开团' }}
      </button>
      <button class="course-card__btn course-card__btn--join" :disabled="!canJoin" @click="onJoinGroup">
        参与拼课
      </button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.course-card {
  margin-bottom: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.course-card__head {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
}

.course-card__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.course-card__title {
  font-size: 30rpx;
  color: #222;
  font-weight: 600;
}

.course-card__store {
  font-size: 22rpx;
  color: #666;
}

.course-card__price-wrap {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
}

.course-card__price {
  font-size: 36rpx;
  color: #ff4d4f;
  font-weight: 700;
}

.course-card__origin {
  font-size: 22rpx;
  color: #999;
  text-decoration: line-through;
}

.course-card__rule {
  font-size: 24rpx;
  color: #444;
  background: #fff7e6;
  border-radius: 12rpx;
  padding: 12rpx;
}

.course-card__row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  font-size: 24rpx;
  color: #555;
}

.course-card__latest {
  font-size: 22rpx;
  color: #333;
}

.course-card__hint {
  font-size: 22rpx;
  color: #999;
  line-height: 1.5;
}

.course-card__actions {
  margin-top: 8rpx;
  display: flex;
  gap: 16rpx;
}

.course-card__btn {
  margin: 0;
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 999rpx;
  border: none;
  font-size: 26rpx;
}

.course-card__btn::after {
  border: none;
}

.course-card__btn--open {
  color: #fff;
  background: linear-gradient(90deg, #ff7a45, #ff4d4f);
}

.course-card__btn--join {
  color: #fa8c16;
  background: #fff7e6;
}
</style>
