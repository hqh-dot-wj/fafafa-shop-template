<template>
  <view v-if="show" class="fixed inset-0" style="background: transparent" @touchmove="absorbTouchMove" />
  <wd-popup
    :model-value="show"
    position="bottom"
    :close-on-click-modal="false"
    custom-class="rounded-t-xl overflow-hidden"
    :z-index="999"
    :lock-scroll="true"
    :root-portal="true"
    @update:model-value="onVisibleChange"
  >
    <view
      v-if="show"
      class="bg-surface p-space-lg"
      style="padding-bottom: calc(env(safe-area-inset-bottom) + 60px)"
      @touchmove="absorbTouchMove"
    >
      <view class="mb-space-md text-center text-title-lg text-ink font-bold">用户协议与隐私政策提示</view>
      <!-- 单段 text + 内嵌可点 text，避免多个并列 text 在小程序里行高/空隙异常 -->
      <view class="mb-space-lg w-full">
        <text class="agreement-body text-body-lg text-ink-light">
          在您使用前，请仔细阅读
          <text class="agreement-link text-primary" @click.stop="handleOpenAgreement('user')">《用户协议》</text>
          与
          <text class="agreement-link text-primary" @click.stop="handleOpenAgreement('privacy')">《隐私政策》</text>
          。点击"同意并继续"代表您已同意前述协议。
        </text>
      </view>
      <view class="flex flex-row gap-space-sm">
        <button
          class="flex-1 rounded-pill bg-fill py-space-sm text-body-lg text-ink-light font-medium"
          hover-class="opacity-80"
          @click="handleDisagree"
        >
          暂不同意
        </button>
        <button
          class="flex-1 rounded-pill bg-primary py-space-sm text-body-lg text-white font-medium"
          hover-class="opacity-80"
          @click="handleAgree"
        >
          同意并继续
        </button>
      </view>
    </view>
  </wd-popup>
</template>

<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';
import { useAuthStore } from '@/store/auth';
import { completeRuntimePopup, enqueueRuntimePopup, useRuntimePopupOrchestrator } from '@/store/popup-orchestrator';
import { useTokenStore } from '@/store/token';
import { absorbTouchMove } from '@/utils/touch';

const emit = defineEmits(['decided']);
const authStoreForSync = useAuthStore();
const popup = useRuntimePopupOrchestrator();
const show = computed(() => authStoreForSync.requireAgreement && popup.activeKind.value === 'agreement');

watch(
  show,
  (visible) => {
    authStoreForSync.setAgreementPopupVisible(visible);
  },
  { immediate: true },
);

function checkAgreement() {
  if (authStoreForSync.requireAgreement) {
    enqueueRuntimePopup('agreement');
  } else {
    emit('decided');
  }
}

async function handleAgree() {
  authStoreForSync.recordAgreement(true);
  completeRuntimePopup('agreement');
  emit('decided');

  // #ifdef MP-WEIXIN
  try {
    await useTokenStore().wxLogin();
  } catch {
    // silent login is optional
  }
  // #endif
}

function handleDisagree() {
  authStoreForSync.recordAgreement(false);
  completeRuntimePopup('agreement');
  /** 仅结束本轮展示；requireAgreement 仍为 true，后续进入仍会再询问 */
  emit('decided');
}

function onVisibleChange(visible: boolean) {
  if (!visible && show.value) {
    completeRuntimePopup('agreement');
  }
}

function handleOpenAgreement(type: 'user' | 'privacy') {
  uni.showToast({
    title: `查看${type === 'user' ? '用户协议' : '隐私政策'}`,
    icon: 'none',
  });
}

defineExpose({ checkAgreement });

onMounted(() => {
  checkAgreement();
});
</script>

<style lang="scss" scoped>
.agreement-body {
  line-height: var(--lh-relaxed);
  word-wrap: break-word;
}

.agreement-link {
  display: inline;
  margin: 0;
  padding: 0;
  vertical-align: baseline;
}
</style>
