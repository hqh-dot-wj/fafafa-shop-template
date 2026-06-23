<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';

definePage({
  style: {
    navigationBarTitleText: '小程序码',
  },
});

const sid = ref('');
const qrcodeUrl = ref('');
const expireAt = ref('');
const saving = ref(false);

onLoad(options => {
  if (typeof options?.sid === 'string') sid.value = options.sid;
  if (typeof options?.qrcodeUrl === 'string') qrcodeUrl.value = decodeURIComponent(options.qrcodeUrl);
  if (typeof options?.expireAt === 'string') expireAt.value = decodeURIComponent(options.expireAt);
});

function saveImage() {
  if (!qrcodeUrl.value || saving.value) {
    uni.showToast({ title: '暂无可保存图片', icon: 'none' });
    return;
  }
  saving.value = true;
  uni.showLoading({ title: '保存中...' });
  uni.downloadFile({
    url: qrcodeUrl.value,
    success: (res) => {
      if (res.statusCode !== 200) {
        uni.showToast({ title: '下载失败', icon: 'none' });
        return;
      }
      uni.saveImageToPhotosAlbum({
        filePath: res.tempFilePath,
        success: () => uni.showToast({ title: '已保存到相册', icon: 'success' }),
        fail: () => uni.showToast({ title: '保存失败，请检查相册权限', icon: 'none' }),
      });
    },
    fail: () => {
      uni.showToast({ title: '下载失败', icon: 'none' });
    },
    complete: () => {
      saving.value = false;
      uni.hideLoading();
    },
  });
}
</script>

<template>
  <view class="dist-qrcode-page">
    <view class="dist-qrcode-page__card">
      <text class="dist-qrcode-page__title">分销小程序码</text>
      <image v-if="qrcodeUrl" :src="qrcodeUrl" mode="aspectFit" class="dist-qrcode-page__image" />
      <view v-else class="dist-qrcode-page__placeholder">
        <view class="i-carbon-qr-code text-56rpx text-hex-94a3b8" />
        <text>暂无可展示的小程序码</text>
      </view>

      <view class="dist-qrcode-page__meta">
        <text class="dist-qrcode-page__line">sid：{{ sid || '暂无' }}</text>
        <text v-if="expireAt" class="dist-qrcode-page__line">有效期至：{{ expireAt }}</text>
      </view>
    </view>

    <wd-button type="primary" block :loading="saving" @click="saveImage">保存到相册</wd-button>
  </view>
</template>

<style lang="scss" scoped>
.dist-qrcode-page {
  min-height: 100vh;
  background: #f5f7fb;
  padding: 26rpx;
  display: grid;
  gap: 18rpx;
}

.dist-qrcode-page__card {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  display: grid;
  gap: 18rpx;
}

.dist-qrcode-page__title {
  font-size: 32rpx;
  color: #111827;
  font-weight: 700;
}

.dist-qrcode-page__image {
  width: 100%;
  height: 540rpx;
}

.dist-qrcode-page__placeholder {
  height: 540rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
}

.dist-qrcode-page__meta {
  display: grid;
  gap: 8rpx;
}

.dist-qrcode-page__line {
  color: #475569;
  font-size: 24rpx;
  word-break: break-all;
}
</style>
