<script lang="ts" setup>
import type { IWxRegisterParams } from '@/api/types/login';
import { computed, ref, watch } from 'vue';
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';
import WdPopup from 'wot-design-uni/components/wd-popup/wd-popup.vue';
import { getWxCode } from '@/api/login';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { completeRuntimePopup, useRuntimePopupOrchestrator } from '@/store/popup-orchestrator';
import { useTokenStore } from '@/store/token';
import { readLocalImagePathAsDataUrl } from '@/utils/read-local-image-data-url';

const authStore = useAuthStore();
const tokenStore = useTokenStore();
const locationStore = useLocationStore();
const popup = useRuntimePopupOrchestrator();
const visible = computed(() => authStore.showAuthModal && popup.activeKind.value === 'login');

const avatar = ref('');
const nickname = ref('');
const submitting = ref(false);

watch(
  visible,
  (v) => {
    if (v) {
      const path = authStore.generateRandomAvatar();
      avatar.value = path;
    }
  },
  { immediate: true },
);

async function submitAuth() {
  submitting.value = true;
  try {
    // #ifdef MP-WEIXIN
    const wxRes = await getWxCode();

    const finalNickname = nickname.value || authStore.generateRandomNickname();
    const pathToRead = avatar.value || authStore.tempAvatar;
    const avatarImageBase64 = await readLocalImagePathAsDataUrl(pathToRead);
    const registerParams: IWxRegisterParams = {
      loginCode: wxRes.code,
      tenantId: locationStore.currentTenantId || '000000',
      userInfo: {
        nickName: finalNickname,
        avatarUrl: '',
      },
      avatarImageBase64,
    };
    const referrerId = authStore.getShareUserId();
    if (referrerId) registerParams.referrerId = referrerId;

    await tokenStore.wxRegister(registerParams);

    uni.showToast({ title: '登录成功', icon: 'success' });
    authStore.onAuthSuccess();
    completeRuntimePopup('login');
    // #endif
  } catch {
    uni.showToast({ title: '授权失败，请重试', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function onClose() {
  authStore.closeAuthModal();
  completeRuntimePopup('login');
}
</script>

<template>
  <wd-popup
    :model-value="visible"
    position="bottom"
    :safe-area-inset-bottom="true"
    :root-portal="true"
    @close="onClose"
  >
    <view
      v-if="visible"
      class="auth-modal rounded-t-popup bg-surface p-space-lg"
      style="padding-bottom: calc(40rpx + env(safe-area-inset-bottom))"
    >
      <view class="mb-space-lg text-center">
        <text class="mb-space-xs block text-title-lg text-ink font-bold">完善个人信息</text>
        <text class="block text-body-md text-ink-lighter">完善信息后享受更好的服务体验</text>
      </view>

      <view class="mb-space-lg">
        <!-- 头像选择 -->
        <view class="mb-space-lg flex flex-col items-center">
          <button
            class="relative h-160rpx w-160rpx border-none bg-transparent p-0"
            open-type="chooseAvatar"
            @chooseavatar="avatar = $event.detail.avatarUrl || avatar"
          >
            <image
              class="h-160rpx w-160rpx border-2 border-line rounded-full"
              :src="avatar || '/static/images/default-avatar.png'"
              mode="aspectFill"
            />
            <view class="absolute bottom--10rpx left-50% translate-x--50% whitespace-nowrap text-micro text-primary">
              点击更换头像
            </view>
          </button>
        </view>

        <!-- 昵称输入 -->
        <view>
          <text class="mb-space-xs block text-body-lg text-ink">昵称</text>
          <view class="flex items-center rounded-card bg-fill px-space-md">
            <input
              v-model="nickname"
              type="nickname"
              class="h-88rpx flex-1 text-body-lg"
              placeholder="点击使用微信昵称（可选）"
            />
          </view>
        </view>
      </view>

      <view>
        <wd-button type="primary" block :loading="submitting" @click="submitAuth">一键填写并登录</wd-button>
        <view class="p-space-md text-center text-body-md text-ink-lighter" hover-class="opacity-80" @click="onClose">
          暂不登录
        </view>
      </view>
    </view>
  </wd-popup>
</template>
