<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';

definePage({
  style: {
    navigationBarTitleText: '分销海报',
  },
});

const sid = ref('');
const title = ref('分销分享海报');
const imageUrl = ref('');
const shareUrl = ref('');
const expireAt = ref('');

onLoad(options => {
  if (typeof options?.sid === 'string') sid.value = options.sid;
  if (typeof options?.title === 'string') title.value = decodeURIComponent(options.title);
  if (typeof options?.imageUrl === 'string') imageUrl.value = decodeURIComponent(options.imageUrl);
  if (typeof options?.shareUrl === 'string') shareUrl.value = decodeURIComponent(options.shareUrl);
  if (typeof options?.expireAt === 'string') expireAt.value = decodeURIComponent(options.expireAt);
});

function copyLink() {
  if (!shareUrl.value) {
    uni.showToast({ title: '暂无分享链接', icon: 'none' });
    return;
  }
  uni.setClipboardData({
    data: shareUrl.value,
    success: () => uni.showToast({ title: '分享链接已复制', icon: 'success' }),
  });
}
</script>

<template>
  <view class="dist-poster-page">
    <view class="dist-poster-page__card">
      <text class="dist-poster-page__title">{{ title }}</text>
      <image
        v-if="imageUrl"
        :src="imageUrl"
        mode="aspectFill"
        class="dist-poster-page__image"
      />
      <view v-else class="dist-poster-page__placeholder">
        <view class="i-carbon-image text-56rpx text-hex-94a3b8" />
        <text>暂未提供商品封面</text>
      </view>

      <view class="dist-poster-page__meta">
        <text class="dist-poster-page__line">sid：{{ sid || '暂无' }}</text>
        <text v-if="expireAt" class="dist-poster-page__line">有效期至：{{ expireAt }}</text>
      </view>
    </view>

    <wd-button type="primary" block @click="copyLink">复制分享链接</wd-button>
    <text class="dist-poster-page__tip">当前是最小可用版本海报页，可先复制链接转发，后续可接服务端渲染海报图。</text>
  </view>
</template>

<style lang="scss" scoped>
.dist-poster-page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 26rpx;
  display: grid;
  gap: 18rpx;
}

.dist-poster-page__card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  display: grid;
  gap: 16rpx;
}

.dist-poster-page__title {
  font-size: 32rpx;
  color: #111827;
  font-weight: 700;
}

.dist-poster-page__image {
  width: 100%;
  height: 460rpx;
  border-radius: 18rpx;
}

.dist-poster-page__placeholder {
  height: 460rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
}

.dist-poster-page__meta {
  display: grid;
  gap: 8rpx;
}

.dist-poster-page__line {
  color: #475569;
  font-size: 24rpx;
  word-break: break-all;
}

.dist-poster-page__tip {
  color: #64748b;
  font-size: 22rpx;
  line-height: 1.8;
}
</style>
