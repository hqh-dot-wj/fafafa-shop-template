<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { getInviteQrCode } from '@/api/invite';

defineOptions({ name: 'InviteQrcodeModal' });

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', val: boolean): void }>();

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const qrcodeUrl = ref('');
const loading = ref(false);

watch(
  () => props.modelValue,
  async (val) => {
    if (val && !qrcodeUrl.value) {
      loading.value = true;
      try {
        const res = await getInviteQrCode();
        qrcodeUrl.value = res?.qrcodeUrl || '';
      } catch {
        uni.showToast({ title: '获取二维码失败', icon: 'none' });
      } finally {
        loading.value = false;
      }
    }
  },
);

function handleClose() {
  visible.value = false;
}

function handleSaveQr() {
  if (!qrcodeUrl.value) return;
  uni.showLoading({ title: '保存中...' });
  uni.downloadFile({
    url: qrcodeUrl.value,
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
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    closable
    lock-scroll
    :safe-area-inset-bottom="true"
    @close="handleClose"
  >
    <view class="qrcode-modal">
      <text class="qrcode-modal__title">面对面扫码邀请</text>
      <text class="qrcode-modal__desc">让对方扫描下方二维码，即可成为您的邀请好友</text>

      <view class="qrcode-modal__card">
        <view v-if="loading" class="qrcode-modal__loading">
          <wd-loading size="60rpx" />
          <text class="qrcode-modal__loading-text">生成中...</text>
        </view>
        <view v-else-if="qrcodeUrl" class="qrcode-modal__img-wrap" @click="handleSaveQr">
          <image class="qrcode-modal__img" :src="qrcodeUrl" mode="aspectFit" />
        </view>
        <view v-else class="qrcode-modal__empty">
          <wd-icon name="scan" size="80rpx" color="var(--color-text-tertiary)" />
          <text class="qrcode-modal__empty-text">暂无二维码</text>
        </view>
      </view>

      <text class="qrcode-modal__save-tip">点击二维码可保存到相册</text>

      <view class="qrcode-modal__footer">
        <wd-button block type="primary" @click="handleClose">关闭</wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.qrcode-modal {
  padding: var(--space-lg) var(--space-lg) 0;
  padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
}

.qrcode-modal__title {
  font-size: var(--font-title-large);
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
}

.qrcode-modal__desc {
  font-size: var(--font-body-medium);
  color: var(--color-text-secondary);
  text-align: center;
  margin-bottom: var(--space-lg);
}

.qrcode-modal__card {
  width: 400rpx;
  height: 400rpx;
  background: var(--color-bg-surface);
  border: 1rpx solid var(--color-border-default);
  border-radius: var(--radius-popup);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qrcode-modal__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.qrcode-modal__loading-text {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.qrcode-modal__img-wrap {
  width: 100%;
  height: 100%;
  padding: var(--space-lg);
  box-sizing: border-box;
}

.qrcode-modal__img {
  width: 100%;
  height: 100%;
}

.qrcode-modal__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.qrcode-modal__empty-text {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
}

.qrcode-modal__save-tip {
  font-size: var(--font-caption);
  color: var(--color-text-tertiary);
  margin-top: var(--space-md);
}

.qrcode-modal__footer {
  width: 100%;
  margin-top: var(--space-lg);
}
</style>
