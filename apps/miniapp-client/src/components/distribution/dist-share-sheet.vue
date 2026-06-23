<script lang="ts" setup>
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    loading?: boolean;
    allowTimeline?: boolean;
    allowMiniCode?: boolean;
  }>(),
  {
    loading: false,
    allowTimeline: true,
    allowMiniCode: true,
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'share-friend'): void;
  (event: 'share-timeline'): void;
  (event: 'copy-link'): void;
  (event: 'generate-poster'): void;
  (event: 'generate-qrcode'): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
});

function close() {
  visible.value = false;
}

function onShareFriend() {
  emit('share-friend');
  close();
}

function onShareTimeline() {
  emit('share-timeline');
  close();
}

function onCopyLink() {
  emit('copy-link');
  close();
}

function onGeneratePoster() {
  emit('generate-poster');
  close();
}

function onGenerateQrcode() {
  emit('generate-qrcode');
  close();
}
</script>

<template>
  <wd-popup v-model="visible" position="bottom" :safe-area-inset-bottom="true">
    <view class="dist-share-sheet">
      <view class="dist-share-sheet__header">
        <text class="dist-share-sheet__title">分销分享</text>
        <text class="dist-share-sheet__subtitle">优先通过 sid 分享，自动走统一分销归因</text>
      </view>

      <view class="dist-share-sheet__actions">
        <button class="dist-share-sheet__action-button" open-type="share" :disabled="loading" @click="onShareFriend">
          <view class="i-carbon-share dist-share-sheet__icon" />
          <text>分享好友</text>
        </button>

        <button
          v-if="allowTimeline"
          class="dist-share-sheet__action-button"
          :disabled="loading"
          @click="onShareTimeline"
        >
          <view class="i-carbon-launch dist-share-sheet__icon" />
          <text>朋友圈</text>
        </button>

        <button class="dist-share-sheet__action-button" :disabled="loading" @click="onCopyLink">
          <view class="i-carbon-copy dist-share-sheet__icon" />
          <text>复制链接</text>
        </button>

        <button class="dist-share-sheet__action-button" :disabled="loading" @click="onGeneratePoster">
          <view class="i-carbon-image dist-share-sheet__icon" />
          <text>分享海报</text>
        </button>

        <button
          v-if="allowMiniCode"
          class="dist-share-sheet__action-button"
          :disabled="loading"
          @click="onGenerateQrcode"
        >
          <view class="i-carbon-qr-code dist-share-sheet__icon" />
          <text>小程序码</text>
        </button>
      </view>

      <wd-button plain block custom-class="dist-share-sheet__cancel" @click="close">取消</wd-button>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.dist-share-sheet {
  background: #fff;
  border-radius: 28rpx 28rpx 0 0;
  padding: 30rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));

  &__header {
    display: grid;
    gap: 8rpx;
    margin-bottom: 24rpx;
    text-align: center;
  }

  &__title {
    font-size: 32rpx;
    font-weight: 700;
    color: #111827;
  }

  &__subtitle {
    font-size: 22rpx;
    color: #6b7280;
  }

  &__actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14rpx;
    margin-bottom: 24rpx;
  }

  &__action-button {
    border: none;
    background: #f8fafc;
    border-radius: 18rpx;
    min-height: 132rpx;
    padding: 14rpx 6rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    font-size: 22rpx;
    color: #334155;
    line-height: 1.2;
  }

  &__icon {
    font-size: 36rpx;
    color: #1677ff;
  }
}

:deep(.dist-share-sheet__cancel) {
  border-radius: 999rpx !important;
}
</style>
