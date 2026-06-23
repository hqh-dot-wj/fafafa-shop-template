<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app';
import { isMp } from '@uni-helper/uni-env';
import { ref } from 'vue';
import { resetPassword, sendResetCode } from '@/api/login';
import { LOGIN_PAGE, LOGIN_PAGE_ENABLE_IN_MP } from '@/router/config';
import { useAuthStore } from '@/store/auth';
import { HOME_PAGE } from '@/utils';

definePage({
  style: { navigationBarTitleText: '重置密码' },
});

const mobile = ref('');
const smsCode = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const countdown = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;

onLoad(() => {
  if (isMp && !LOGIN_PAGE_ENABLE_IN_MP) {
    useAuthStore().requireAuth();
    uni.switchTab({ url: HOME_PAGE });
  }
});

async function handleSendCode() {
  if (!/^1\d{10}$/.test(mobile.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return;
  }
  try {
    await sendResetCode({ mobile: mobile.value });
    uni.showToast({ title: '验证码已发送', icon: 'none' });
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    }, 1000);
  } catch {
    // error handled by http layer
  }
}

async function doReset() {
  if (!mobile.value || !smsCode.value || !newPassword.value) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' });
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' });
    return;
  }
  try {
    await resetPassword({
      mobile: mobile.value,
      code: smsCode.value,
      newPassword: newPassword.value,
    });
    uni.showToast({ title: '密码已重置', icon: 'success' });
    setTimeout(() => {
      uni.redirectTo({ url: LOGIN_PAGE });
    }, 1500);
  } catch {
    // error handled by http layer
  }
}

function toLogin() {
  uni.redirectTo({ url: LOGIN_PAGE });
}
</script>

<template>
  <view class="reset-container p-space-lg">
    <view class="mb-space-xl mt-space-xl text-center">
      <text class="text-title-lg text-ink font-bold">重置密码</text>
    </view>

    <view class="form-item mb-space-md">
      <input
        v-model="mobile"
        class="h-96rpx w-full rounded-card bg-fill px-space-md text-body-lg"
        type="number"
        :maxlength="11"
        placeholder="请输入手机号"
      />
    </view>

    <view class="form-item mb-space-md flex items-center gap-space-sm">
      <input
        v-model="smsCode"
        class="h-96rpx flex-1 rounded-card bg-fill px-space-md text-body-lg"
        type="number"
        :maxlength="6"
        placeholder="验证码"
      />
      <button
        class="h-96rpx whitespace-nowrap rounded-card bg-primary px-space-md text-body-lg text-white"
        :disabled="countdown > 0"
        @click="handleSendCode"
      >
        {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
      </button>
    </view>

    <view class="form-item mb-space-md">
      <input
        v-model="newPassword"
        class="h-96rpx w-full rounded-card bg-fill px-space-md text-body-lg"
        password
        placeholder="请输入新密码"
      />
    </view>

    <view class="form-item mb-space-lg">
      <input
        v-model="confirmPassword"
        class="h-96rpx w-full rounded-card bg-fill px-space-md text-body-lg"
        password
        placeholder="确认新密码"
      />
    </view>

    <button class="w-full rounded-pill bg-primary py-space-sm text-body-lg text-white" @click="doReset">
      重置密码
    </button>

    <view class="mt-space-lg text-center">
      <text class="text-body-md text-primary" @click="toLogin">返回登录</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.reset-container {
  min-height: 100vh;
  background-color: var(--color-bg-body, #f5f5f5);
}
</style>
