<script lang="ts" setup>
import { onShareAppMessage } from '@dcloudio/uni-app';
import { ref } from 'vue';
import InviteRecordList from './components/invite-record-list.vue';
import QrcodeModal from './components/qrcode-modal.vue';
import TeamMemberList from './components/team-member-list.vue';

defineOptions({ name: 'InvitePage' });

definePage({
  style: {
    navigationBarTitleText: '邀请有礼',
  },
});

type MainTab = 'records' | 'team';

const activeMainTab = ref<MainTab>('records');
const showQrcodeModal = ref(false);
const recordListRef = ref<InstanceType<typeof InviteRecordList> | null>(null);
const teamListRef = ref<InstanceType<typeof TeamMemberList> | null>(null);

const INVITE_RULES = [
  '分享邀请链接给好友，好友注册成功即为邀请成功',
  '被邀请好友首次下单成功后，您可获得相应奖励',
  '奖励将在订单完成后自动发放到您的账户',
  '每位用户只能被邀请一次，重复邀请不计入统计',
];

function switchMainTab(tab: MainTab) {
  activeMainTab.value = tab;
}

function openQrcodeModal() {
  showQrcodeModal.value = true;
}

/** H5 分享：复制当前页面链接到剪贴板 */
function handleH5Share() {
  // #ifdef H5
  const url = `${window.location.origin}/pages/index/index`;
  uni.setClipboardData({
    data: url,
    success: () => uni.showToast({ title: '链接已复制，快去分享给好友吧', icon: 'none' }),
  });
  // #endif
}

onShareAppMessage(() => ({
  title: '我在这里发现了好东西，快来看看吧！',
  path: '/pages/index/index',
}));
</script>

<template>
  <view class="invite-page">
    <!-- 顶部英雄区 -->
    <view class="invite-page__hero">
      <view class="invite-page__hero-bg" />
      <view class="invite-page__hero-content">
        <text class="invite-page__hero-title">邀请好友 共享好礼</text>
        <text class="invite-page__hero-subtitle">邀请好友注册下单，双方均可获得奖励</text>
      </view>
    </view>

    <!-- 邀请操作区 -->
    <view class="invite-page__actions">
      <!-- 立即邀请按钮 — 小程序转发分享；H5 走复制链接 -->
      <!-- #ifdef MP -->
      <wd-button type="primary" block size="large" open-type="share" custom-class="invite-page__share-btn">
        立即邀请
      </wd-button>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <wd-button type="primary" block size="large" custom-class="invite-page__share-btn" @click="handleH5Share">
        立即邀请
      </wd-button>
      <!-- #endif -->

      <!-- 面对面扫码邀请 -->
      <view class="invite-page__qr-entry" hover-class="opacity-80" @click="openQrcodeModal">
        <wd-icon name="scan" size="32rpx" color="var(--color-brand-primary)" />
        <text class="invite-page__qr-text">面对面扫码邀请</text>
        <wd-icon name="arrow-right" size="28rpx" color="var(--color-text-tertiary)" />
      </view>
    </view>

    <!-- 邀请说明 -->
    <view class="invite-page__rules">
      <view class="invite-page__rules-header">
        <view class="invite-page__rules-dot" />
        <text class="invite-page__rules-title">邀请说明</text>
        <view class="invite-page__rules-dot" />
      </view>
      <view class="invite-page__rules-body">
        <view v-for="(rule, idx) in INVITE_RULES" :key="idx" class="invite-page__rule-item">
          <text class="invite-page__rule-num">{{ idx + 1 }}</text>
          <text class="invite-page__rule-text">{{ rule }}</text>
        </view>
      </view>
    </view>

    <!-- 主 tabs: 我的邀请记录 / 团队成员 -->
    <view class="invite-page__tabs">
      <view class="invite-page__tab-bar">
        <view
          class="invite-page__tab-item"
          :class="{ 'invite-page__tab-item--active': activeMainTab === 'records' }"
          @click="switchMainTab('records')"
        >
          <text class="invite-page__tab-label">我的邀请记录</text>
          <view v-if="activeMainTab === 'records'" class="invite-page__tab-indicator" />
        </view>
        <view
          class="invite-page__tab-item"
          :class="{ 'invite-page__tab-item--active': activeMainTab === 'team' }"
          @click="switchMainTab('team')"
        >
          <text class="invite-page__tab-label">团队成员</text>
          <view v-if="activeMainTab === 'team'" class="invite-page__tab-indicator" />
        </view>
      </view>

      <view class="invite-page__tab-body">
        <InviteRecordList v-show="activeMainTab === 'records'" ref="recordListRef" />
        <TeamMemberList v-show="activeMainTab === 'team'" ref="teamListRef" />
      </view>
    </view>

    <!-- 面对面扫码弹窗 -->
    <QrcodeModal v-model="showQrcodeModal" />
  </view>
</template>

<style lang="scss" scoped>
.invite-page {
  min-height: 100vh;
  background: var(--color-bg-body);
}

/* ========== 英雄区 ========== */
.invite-page__hero {
  position: relative;
  padding: var(--space-xl) var(--space-lg) 80rpx;
  overflow: hidden;
}

.invite-page__hero-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    var(--color-brand-primary) 0%,
    var(--color-brand-gradient-start) 50%,
    var(--color-brand-gradient-end) 100%
  );
}

.invite-page__hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.invite-page__hero-title {
  font-size: var(--font-title-large);
  font-weight: 800;
  color: var(--color-bg-surface);
  letter-spacing: 4rpx;
}

.invite-page__hero-subtitle {
  font-size: var(--font-body-medium);
  color: rgba(255, 255, 255, 0.85);
}

/* ========== 操作区 ========== */
.invite-page__actions {
  margin: -40rpx var(--space-lg) 0;
  position: relative;
  z-index: 2;
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
}

:deep(.invite-page__share-btn) {
  border-radius: var(--radius-pill) !important;
  height: 96rpx !important;
  font-size: var(--font-title-medium) !important;
  font-weight: 700 !important;
}

.invite-page__qr-entry {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  margin-top: var(--space-md);
  padding: var(--space-sm) 0;
  cursor: pointer;
}

.invite-page__qr-text {
  font-size: var(--font-body-medium);
  color: var(--color-brand-primary);
  font-weight: 500;
}

/* ========== 邀请说明 ========== */
.invite-page__rules {
  margin: var(--space-lg) var(--space-lg) 0;
  background: var(--color-bg-surface);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
}

.invite-page__rules-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.invite-page__rules-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--color-brand-primary);
}

.invite-page__rules-title {
  font-size: var(--font-body-large);
  font-weight: 600;
  color: var(--color-text-primary);
}

.invite-page__rules-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.invite-page__rule-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
}

.invite-page__rule-num {
  flex-shrink: 0;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: var(--color-brand-light);
  color: var(--color-brand-primary);
  font-size: var(--font-micro);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  margin-top: 4rpx;
}

.invite-page__rule-text {
  flex: 1;
  font-size: var(--font-body-medium);
  color: var(--color-text-secondary);
  line-height: var(--lh-relaxed);
}

/* ========== 主 Tabs ========== */
.invite-page__tabs {
  margin-top: var(--space-lg);
}

.invite-page__tab-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 60rpx;
  padding: var(--space-sm) 0 0;
  background: var(--color-bg-body);
}

.invite-page__tab-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-sm) 0;
  cursor: pointer;
}

.invite-page__tab-label {
  font-size: var(--font-body-large);
  color: var(--color-text-secondary);
  font-weight: 500;
  line-height: var(--lh-normal);
  transition: color var(--duration-fast);
}

.invite-page__tab-item--active .invite-page__tab-label {
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 30rpx;
}

.invite-page__tab-indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 40rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: var(--color-brand-primary);
  transform: translateX(-50%);
}

.invite-page__tab-body {
  padding-top: var(--space-sm);
}
</style>
