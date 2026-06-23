<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    allow: boolean;
    title?: string;
    message?: string;
  }>(),
  {
    title: '仅分销身份可用',
    message: '当前账号暂无分销权限，请先完成分销升级后再使用该功能。',
  },
);

function goReferralPage() {
  uni.navigateTo({ url: '/pages/upgrade/referral-code' });
}
</script>

<template>
  <view v-if="allow" class="dist-role-guard__pass">
    <slot />
  </view>
  <view v-else class="dist-role-guard__block">
    <view class="dist-role-guard__card">
      <view class="dist-role-guard__icon i-carbon-user-role" />
      <text class="dist-role-guard__title">{{ props.title }}</text>
      <text class="dist-role-guard__message">{{ props.message }}</text>
      <wd-button type="primary" size="small" @click="goReferralPage">查看我的推荐码</wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dist-role-guard__pass {
  min-height: 0;
}

.dist-role-guard__block {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.dist-role-guard__card {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 36rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  box-shadow: 0 16rpx 40rpx rgba(15, 23, 42, 0.08);
}

.dist-role-guard__icon {
  font-size: 56rpx;
  color: #1677ff;
}

.dist-role-guard__title {
  font-size: 32rpx;
  color: #1f2937;
  font-weight: 700;
}

.dist-role-guard__message {
  text-align: center;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.7;
  margin-bottom: 8rpx;
}
</style>
