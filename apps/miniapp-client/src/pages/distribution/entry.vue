<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app';
import { ref } from 'vue';
import { resolveShareToken } from '@/api/distribution';
import { useAuthStore } from '@/store/auth';
import {
  extractDistShareContext,
  navigateByPath,
  saveShareSid,
} from '@/utils/dist-share-context';

definePage({
  style: {
    navigationBarTitleText: '分销入口',
  },
});

const authStore = useAuthStore();

const loading = ref(true);
const errorText = ref('');

async function resolveAndJump(rawOptions: Record<string, unknown>) {
  const context = extractDistShareContext(rawOptions);
  const fallbackTarget = '/pages/index/index';
  let targetPath = context.targetPath || fallbackTarget;

  if (context.sid) {
    saveShareSid(context.sid);
    try {
      const resolved = await resolveShareToken({ sid: context.sid });
      if (resolved?.shareUserId) {
        authStore.setShareUserId(String(resolved.shareUserId));
      } else if (context.shareUserId) {
        authStore.setShareUserId(String(context.shareUserId));
      }

      if (resolved?.targetPath) {
        targetPath = resolved.targetPath;
      }
    } catch {
      if (context.shareUserId) {
        authStore.setShareUserId(String(context.shareUserId));
      }
    }
  } else if (context.shareUserId) {
    authStore.setShareUserId(String(context.shareUserId));
  }

  if (targetPath.startsWith('/pages/distribution/entry')) {
    targetPath = fallbackTarget;
  }

  navigateByPath(targetPath, fallbackTarget);
}

onLoad(async options => {
  loading.value = true;
  errorText.value = '';
  try {
    await resolveAndJump(options || {});
  } catch (error: any) {
    errorText.value = error?.message || '分销入口处理失败，请稍后重试';
  } finally {
    loading.value = false;
  }
});

function retry() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as { options?: Record<string, unknown> } | undefined;
  void resolveAndJump(current?.options || {});
}
</script>

<template>
  <view class="dist-entry-page">
    <view v-if="loading" class="dist-entry-page__loading">
      <wd-loading />
      <text>正在跳转分销页面...</text>
    </view>
    <view v-else-if="errorText" class="dist-entry-page__error">
      <text>{{ errorText }}</text>
      <wd-button type="primary" size="small" @click="retry">重试</wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.dist-entry-page {
  min-height: 100vh;
  background: #f7f8fa;
}

.dist-entry-page__loading,
.dist-entry-page__error {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  flex-direction: column;
  color: #6b7280;
  padding: 32rpx;
  text-align: center;
}
</style>
