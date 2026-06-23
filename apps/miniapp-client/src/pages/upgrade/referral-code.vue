<script lang="ts" setup>
import type { ReferralCodeInfo } from '@/api/upgrade';
import { onMounted, ref } from 'vue';
import { getMyReferralCode } from '@/api/upgrade';

definePage({
  style: {
    navigationBarTitleText: '我的推荐码',
  },
});

const loading = ref(true);
const info = ref<ReferralCodeInfo | null>(null);
const errorMsg = ref('');

onMounted(async () => {
  try {
    const res = await getMyReferralCode();
    if (res) {
      info.value = res;
    }
  } catch (err: any) {
    errorMsg.value = err.msg || err.message || '获取失败';
  } finally {
    loading.value = false;
  }
});

function handleCopy() {
  if (info.value?.code) {
    uni.setClipboardData({
      data: info.value.code,
      success: () => {
        uni.showToast({ title: '已复制', icon: 'success' });
      },
    });
  }
}

function handleSaveQr() {
  if (info.value?.qrCodeUrl) {
    uni.showLoading({ title: '保存中...' });
    uni.downloadFile({
      url: info.value.qrCodeUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          uni.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
            fail: () => uni.showToast({ title: '保存失败', icon: 'none' }),
          });
        }
      },
      fail: () => uni.showToast({ title: '下载失败', icon: 'none' }),
      complete: () => uni.hideLoading(),
    });
  }
}

function handleBack() {
  uni.navigateBack();
}
</script>

<template>
  <view class="rc-page">
    <!-- 顶部品牌渐变区 -->
    <view class="rc-page__hero">
      <text class="rc-page__hero-title">专属推荐码</text>
      <text class="rc-page__hero-subtitle">邀请小伙伴，共创美好前程</text>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="rc-page__loading">
      <wd-loading size="60rpx" color="var(--color-brand-primary)" />
      <text class="rc-page__loading-text">正在生成您的专属推荐码...</text>
    </view>

    <!-- 错误态 -->
    <view v-else-if="errorMsg" class="rc-page__error-card">
      <wd-icon name="warn-circle" size="80rpx" color="var(--color-func-error)" />
      <text class="rc-page__error-msg">{{ errorMsg }}</text>
      <text class="rc-page__error-hint">仅共享股东(C2)角色可享受团队招募特权</text>
      <wd-button type="primary" size="small" @click="handleBack">返回</wd-button>
    </view>

    <!-- 正常内容 -->
    <view v-else class="rc-page__body">
      <!-- 邀请码卡片（票券风格） -->
      <view class="rc-card">
        <view class="rc-card__top">
          <text class="rc-card__label">我的邀请码</text>
          <view class="rc-card__code-row" hover-class="opacity-80" @click="handleCopy">
            <text class="rc-card__code">{{ info?.code }}</text>
            <view class="rc-card__copy-btn">
              <wd-icon name="content-copy" size="28rpx" color="var(--color-bg-surface)" />
              <text class="rc-card__copy-text">复制</text>
            </view>
          </view>
          <text class="rc-card__tip">点击邀请码即可快速复制</text>
        </view>

        <!-- 票券锯齿分割线 -->
        <view class="rc-card__divider">
          <view class="rc-card__divider-notch rc-card__divider-notch--left" />
          <view class="rc-card__divider-line" />
          <view class="rc-card__divider-notch rc-card__divider-notch--right" />
        </view>

        <view class="rc-card__bottom">
          <!-- 二维码 -->
          <view class="rc-card__qr-wrap" @click="handleSaveQr">
            <view v-if="info?.qrCodeUrl" class="rc-card__qr-box">
              <image class="rc-card__qr-img" :src="info.qrCodeUrl" mode="aspectFit" />
            </view>
            <view v-else class="rc-card__qr-placeholder">
              <wd-icon name="scan" size="64rpx" color="var(--color-border-default)" />
              <text class="rc-card__qr-placeholder-text">暂无二维码</text>
            </view>
          </view>
          <text class="rc-card__qr-tip">点击二维码保存到相册</text>
        </view>
      </view>

      <!-- 统计数据 -->
      <view class="rc-stats">
        <view class="rc-stats__item">
          <text class="rc-stats__num">{{ info?.usageCount || 0 }}</text>
          <text class="rc-stats__label">已成功邀请（人）</text>
        </view>
      </view>

      <!-- 底部操作 -->
      <view class="rc-page__footer">
        <!-- #ifdef MP -->
        <wd-button type="primary" block size="large" open-type="share" custom-class="rc-page__share-btn">
          立即发送给好友
        </wd-button>
        <!-- #endif -->
        <!-- #ifdef H5 -->
        <wd-button type="primary" block size="large" custom-class="rc-page__share-btn" @click="handleCopy">
          复制邀请码分享给好友
        </wd-button>
        <!-- #endif -->
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.rc-page {
  min-height: 100vh;
  background: var(--color-bg-body);
  display: flex;
  flex-direction: column;
}

/* ========== 顶部品牌渐变 ========== */
.rc-page__hero {
  padding: var(--space-xl) var(--space-lg) 80rpx;
  background: linear-gradient(
    135deg,
    var(--color-brand-primary) 0%,
    var(--color-brand-gradient-start) 50%,
    var(--color-brand-gradient-end) 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.rc-page__hero-title {
  font-size: var(--font-title-large);
  font-weight: 800;
  color: var(--color-bg-surface);
  letter-spacing: 4rpx;
}

.rc-page__hero-subtitle {
  font-size: var(--font-body-medium);
  color: rgba(255, 255, 255, 0.85);
}

/* ========== 加载态 ========== */
.rc-page__loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-xl);
}

.rc-page__loading-text {
  font-size: var(--font-body-medium);
  color: var(--color-text-tertiary);
}

/* ========== 错误态 ========== */
.rc-page__error-card {
  margin: -40rpx var(--space-lg) 0;
  position: relative;
  z-index: 1;
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  padding: var(--space-xl) var(--space-lg);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.rc-page__error-msg {
  font-size: var(--font-title-medium);
  font-weight: 600;
  color: var(--color-text-primary);
}

.rc-page__error-hint {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  text-align: center;
}

/* ========== 内容区 ========== */
.rc-page__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: -40rpx;
  position: relative;
  z-index: 1;
}

/* ========== 票券风格卡片 ========== */
.rc-card {
  margin: 0 var(--space-lg);
  background: var(--color-bg-surface);
  border-radius: var(--radius-popup);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.rc-card__top {
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.rc-card__label {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  letter-spacing: 2rpx;
}

.rc-card__code-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-brand-light);
  border-radius: var(--radius-card);
  width: 100%;
  box-sizing: border-box;
  justify-content: center;
}

.rc-card__code {
  font-size: var(--font-display-medium);
  font-weight: 800;
  color: var(--color-brand-primary);
  letter-spacing: 8rpx;
  line-height: var(--lh-tight);
}

.rc-card__copy-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: var(--color-brand-primary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}

.rc-card__copy-text {
  font-size: var(--font-micro);
  color: var(--color-bg-surface);
  font-weight: 600;
  line-height: 1;
}

.rc-card__tip {
  font-size: var(--font-micro);
  color: var(--color-text-tertiary);
}

/* 票券锯齿分割 */
.rc-card__divider {
  position: relative;
  height: 1rpx;
  margin: var(--space-sm) 0;
}

.rc-card__divider-line {
  position: absolute;
  top: 0;
  left: var(--space-xl);
  right: var(--space-xl);
  height: 1rpx;
  border-top: 2rpx dashed var(--color-border-default);
}

.rc-card__divider-notch {
  position: absolute;
  top: 50%;
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background: var(--color-bg-body);
  transform: translateY(-50%);
}

.rc-card__divider-notch--left {
  left: -12rpx;
}

.rc-card__divider-notch--right {
  right: -12rpx;
}

.rc-card__bottom {
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.rc-card__qr-wrap {
  width: 320rpx;
  height: 320rpx;
}

.rc-card__qr-box {
  width: 100%;
  height: 100%;
  padding: var(--space-sm);
  box-sizing: border-box;
  border: 2rpx solid var(--color-border-default);
  border-radius: var(--radius-card);
}

.rc-card__qr-img {
  width: 100%;
  height: 100%;
}

.rc-card__qr-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  background: var(--color-bg-body);
  border-radius: var(--radius-card);
}

.rc-card__qr-placeholder-text {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.rc-card__qr-tip {
  font-size: var(--font-micro);
  color: var(--color-text-tertiary);
}

/* ========== 统计 ========== */
.rc-stats {
  margin: var(--space-lg) var(--space-lg) 0;
  background: var(--color-bg-surface);
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  box-shadow: var(--shadow-card);
  display: flex;
  justify-content: center;
}

.rc-stats__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}

.rc-stats__num {
  font-size: var(--font-display-medium);
  font-weight: 800;
  color: var(--color-brand-primary);
  line-height: var(--lh-tight);
}

.rc-stats__label {
  font-size: var(--font-caption);
  color: var(--color-text-secondary);
}

/* ========== 底部按钮 ========== */
.rc-page__footer {
  margin-top: auto;
  padding: var(--space-xl) var(--space-lg);
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom));
}

:deep(.rc-page__share-btn) {
  border-radius: var(--radius-pill) !important;
  height: 96rpx !important;
  font-size: var(--font-title-medium) !important;
  font-weight: 700 !important;
}
</style>
