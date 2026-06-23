<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app';
import { isMp } from '@uni-helper/uni-env';
import { computed, onMounted, ref } from 'vue';
import { sendLoginCode } from '@/api/login';
import { LOGIN_PAGE_ENABLE_IN_MP, LOGIN_PAGE_LIST } from '@/router/config';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { useTokenStore } from '@/store/token';
import { isPageTabbar } from '@/tabbar/store';
import { HOME_PAGE } from '@/utils';
import { DEV_MOCK_SUPER_TENANT_ID } from '@/utils/dev-location-mock';

definePage({
  style: { navigationBarTitleText: '登录' },
});

// #ifdef H5
onMounted(() => {
  uni.setNavigationBarTitle({ title: '手机号码登录/注册' });
});
// #endif

const tokenStore = useTokenStore();
const locationStore = useLocationStore();

function resolveLoginTenantId(): string {
  return locationStore.currentTenantId || DEV_MOCK_SUPER_TENANT_ID;
}

type LoginTab = 'sms' | 'password';
const activeTab = ref<LoginTab>('sms');
const mobile = ref('');
const smsCode = ref('');
const password = ref('');
const countdown = ref(0);
const redirectPath = ref('');
let timer: ReturnType<typeof setInterval> | null = null;

onLoad((options?: { redirect?: string }) => {
  if (isMp && !LOGIN_PAGE_ENABLE_IN_MP) {
    useAuthStore().requireAuth();
    uni.switchTab({ url: HOME_PAGE });
    return;
  }
  redirectPath.value = safeDecodeRedirect(options?.redirect || '');
});

function switchTab(tab: LoginTab) {
  activeTab.value = tab;
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(mobile.value)) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return;
  }
  try {
    await sendLoginCode({ mobile: mobile.value, tenantId: resolveLoginTenantId() });
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

async function doSmsLogin() {
  if (!mobile.value || !smsCode.value) {
    uni.showToast({ title: '请输入手机号和验证码', icon: 'none' });
    return;
  }
  try {
    await tokenStore.smsLogin({ mobile: mobile.value, code: smsCode.value, tenantId: resolveLoginTenantId() });
    goAfterLogin();
  } catch {
    // error handled by http layer
  }
}

async function doPwdLogin() {
  if (!mobile.value || !password.value) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' });
    return;
  }
  try {
    await tokenStore.pwdLogin({
      mobile: mobile.value,
      password: password.value,
      tenantId: resolveLoginTenantId(),
    });
    goAfterLogin();
  } catch {
    // error handled by http layer
  }
}

function toResetPassword() {
  uni.navigateTo({ url: '/pages-auth/register' });
}

function safeDecodeRedirect(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeInternalRoute(value: string): string {
  const trimmed = safeDecodeRedirect(value).trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('pages/') || trimmed.startsWith('pages-auth/') || trimmed.startsWith('pages-ai/')) {
    return `/${trimmed}`;
  }
  return '';
}

function resolvePostLoginUrl(): string {
  const target = normalizeInternalRoute(redirectPath.value);
  const [routeOnly = ''] = target.split('?');
  if (!target || LOGIN_PAGE_LIST.includes(routeOnly)) {
    return HOME_PAGE;
  }
  return target;
}

function resumeAuthCallbackIfPresent(): boolean {
  const callback = useAuthStore().consumeAuthCallback();
  if (!callback) return false;

  uni.navigateBack({
    success: () => {
      setTimeout(callback, 0);
    },
    fail: () => {
      callback();
    },
  });
  return true;
}

function goAfterLogin() {
  if (resumeAuthCallbackIfPresent()) return;

  const target = resolvePostLoginUrl();
  const [routeOnly = ''] = target.split('?');
  if (isPageTabbar(routeOnly)) {
    uni.switchTab({ url: routeOnly });
    return;
  }
  uni.redirectTo({ url: target });
}

const smsSubmitReady = computed(() => /^1\d{10}$/.test(mobile.value) && smsCode.value.length === 6);

const pwdSubmitReady = computed(() => /^1\d{10}$/.test(mobile.value) && password.value.length > 0);
</script>

<template>
  <!-- #ifdef H5 -->
  <view class="login-container login-container--h5">
    <fg-login-brand-slot />

    <view class="login-h5-tabs">
      <text
        class="login-h5-tab"
        :class="activeTab === 'sms' ? 'login-h5-tab--active' : 'login-h5-tab--idle'"
        @click="switchTab('sms')"
      >
        验证码登录
      </text>
      <text
        class="login-h5-tab"
        :class="activeTab === 'password' ? 'login-h5-tab--active' : 'login-h5-tab--idle'"
        @click="switchTab('password')"
      >
        密码登录
      </text>
    </view>

    <template v-if="activeTab === 'sms'">
      <view class="login-h5-field-row">
        <input
          v-model="mobile"
          class="login-h5-input login-h5-input--grow"
          type="number"
          :maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="text-ink-lighter"
        />
        <button
          class="login-h5-link-btn"
          hover-class="login-h5-link-btn--active"
          :disabled="countdown > 0"
          @click="handleSendCode"
        >
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>
      <view class="login-h5-field-row">
        <input
          v-model="smsCode"
          class="login-h5-input login-h5-input--grow"
          type="number"
          :maxlength="6"
          placeholder="请输入验证码"
          placeholder-class="text-ink-lighter"
        />
      </view>
      <button
        class="login-h5-submit"
        hover-class="login-h5-submit--pressed"
        :class="{ 'login-h5-submit--ready': smsSubmitReady }"
        @click="doSmsLogin"
      >
        登录
      </button>
    </template>
    <template v-else>
      <view class="login-h5-field-row">
        <input
          v-model="mobile"
          class="login-h5-input login-h5-input--grow"
          type="number"
          :maxlength="11"
          placeholder="请输入手机号"
          placeholder-class="text-ink-lighter"
        />
      </view>
      <view class="login-h5-field-row">
        <input
          v-model="password"
          class="login-h5-input login-h5-input--grow"
          password
          placeholder="请输入密码"
          placeholder-class="text-ink-lighter"
        />
      </view>
      <button
        class="login-h5-submit"
        hover-class="login-h5-submit--pressed"
        :class="{ 'login-h5-submit--ready': pwdSubmitReady }"
        @click="doPwdLogin"
      >
        登录
      </button>
    </template>

    <view class="login-h5-footer">
      <text v-if="activeTab === 'password'" class="login-h5-footer-link" @click="toResetPassword">忘记密码？</text>
      <text class="login-h5-footer-hint">未注册手机号将自动创建账号</text>
    </view>
  </view>
  <!-- #endif -->
  <!-- #ifndef H5 -->
  <view class="login-container p-space-lg">
    <view class="mb-space-xl mt-space-xl text-center">
      <text class="text-title-lg text-ink font-bold">欢迎登录</text>
    </view>

    <!-- 切换标签 -->
    <view class="mb-space-lg flex justify-center gap-space-lg">
      <text
        class="pb-space-xs text-body-lg"
        :class="activeTab === 'sms' ? 'text-primary border-b-2 border-primary font-bold' : 'text-ink-light'"
        @click="switchTab('sms')"
      >
        验证码登录
      </text>
      <text
        class="pb-space-xs text-body-lg"
        :class="activeTab === 'password' ? 'text-primary border-b-2 border-primary font-bold' : 'text-ink-light'"
        @click="switchTab('password')"
      >
        密码登录
      </text>
    </view>

    <!-- 手机号 -->
    <view class="form-item mb-space-md">
      <input
        v-model="mobile"
        class="h-96rpx w-full rounded-card bg-fill px-space-md text-body-lg"
        type="number"
        :maxlength="11"
        placeholder="请输入手机号"
      />
    </view>

    <!-- 验证码模式 -->
    <template v-if="activeTab === 'sms'">
      <view class="form-item mb-space-lg flex items-center gap-space-sm">
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
      <button class="w-full rounded-pill bg-primary py-space-sm text-body-lg text-white" @click="doSmsLogin">
        登录
      </button>
    </template>

    <!-- 密码模式 -->
    <template v-else>
      <view class="form-item mb-space-lg">
        <input
          v-model="password"
          class="h-96rpx w-full rounded-card bg-fill px-space-md text-body-lg"
          password
          placeholder="请输入密码"
        />
      </view>
      <button class="w-full rounded-pill bg-primary py-space-sm text-body-lg text-white" @click="doPwdLogin">
        登录
      </button>
    </template>

    <view v-if="activeTab === 'password'" class="mt-space-lg text-center">
      <text class="text-body-md text-primary" @click="toResetPassword">忘记密码？</text>
    </view>

    <view class="mt-space-md text-center">
      <text class="text-body-md text-ink-lighter">未注册手机号将自动创建账号</text>
    </view>
  </view>
  <!-- #endif -->
</template>

<style lang="scss" scoped>
.login-container {
  min-height: 100vh;
  background-color: var(--color-bg-body, #f5f5f5);
}

/* #ifdef H5 */
.login-container--h5 {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom, 0px));
  background-color: var(--color-bg-surface);
}

.login-h5-tabs {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: var(--space-xl);
  margin-bottom: var(--space-lg);
}

.login-h5-tab {
  padding-bottom: var(--space-xs);
  font-size: var(--font-body-large);
}

.login-h5-tab--active {
  font-weight: 700;
  color: var(--color-brand-primary);
  border-bottom: 2px solid var(--color-brand-primary);
}

.login-h5-tab--idle {
  color: var(--color-text-tertiary);
}

.login-h5-field-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  min-height: 96rpx;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border-default);
}

.login-h5-input {
  box-sizing: border-box;
  min-width: 0;
  font-size: var(--font-body-large);
  color: var(--color-text-primary);
  background-color: transparent;
  border-width: 0;
}

.login-h5-input--grow {
  flex: 1;
}

.login-h5-link-btn {
  flex-shrink: 0;
  padding: var(--space-xs) var(--space-sm);
  margin: 0;
  font-size: var(--font-body-large);
  line-height: var(--lh-normal);
  color: var(--color-text-primary);
  background-color: transparent;
  border-width: 0;
}

.login-h5-link-btn::after {
  border: none;
}

.login-h5-link-btn[disabled] {
  color: var(--color-text-tertiary);
}

.login-h5-link-btn--active {
  opacity: 0.75;
}

.login-h5-submit {
  width: 100%;
  margin-top: var(--space-xl);
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-body-large);
  font-weight: 600;
  line-height: var(--lh-snug);
  color: var(--color-bg-surface);
  background-color: var(--color-brand-primary);
  border-width: 0;
  border-radius: var(--radius-card);
  opacity: 0.42;
}

.login-h5-submit::after {
  border: none;
}

.login-h5-submit--ready {
  opacity: 1;
}

.login-h5-submit--pressed {
  opacity: 0.88;
}

.login-h5-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
}

.login-h5-footer-link {
  font-size: var(--font-body-medium);
  color: var(--color-brand-primary);
}

.login-h5-footer-hint {
  font-size: var(--font-body-medium);
  color: var(--color-text-tertiary);
  text-align: center;
}
/* #endif */
</style>
