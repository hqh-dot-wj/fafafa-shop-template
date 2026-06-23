<script setup lang="ts">
import { sendLoginCode } from '@/service/api/auth';
import { toastMessage, toastSuccess } from '@/utils/toast';

const route = useRoute();
const router = useRouter();
const tokenStore = useTokenStore();
const shopBranding = useShopBrandingStore();
const { apiClient } = useApi();
const tenantId = useTenantId();

type LoginTab = 'sms' | 'password';
const activeTab = ref<LoginTab>('sms');
const mobile = ref('');
const smsCode = ref('');
const password = ref('');
const countdown = ref(0);
const submitting = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const smsSubmitReady = computed(() => /^1\d{10}$/.test(mobile.value) && smsCode.value.length === 6);
const pwdSubmitReady = computed(() => /^1\d{10}$/.test(mobile.value) && password.value.length > 0);

function resolveRedirect(): string {
  const raw = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  try {
    return decodeURIComponent(raw) || '/';
  } catch {
    return raw || '/';
  }
}

async function handleSendCode() {
  if (!/^1\d{10}$/.test(mobile.value)) {
    toastMessage('请输入正确的手机号');
    return;
  }
  await sendLoginCode(apiClient, { mobile: mobile.value, tenantId });
  toastSuccess('验证码已发送');
  countdown.value = 60;
  timer = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

async function goAfterLogin() {
  const target = resolveRedirect();
  await router.replace(target);
}

async function doSmsLogin() {
  if (!smsSubmitReady.value) {
    toastMessage('请输入手机号和验证码');
    return;
  }
  submitting.value = true;
  try {
    await tokenStore.smsLogin({ mobile: mobile.value, code: smsCode.value, tenantId });
    await goAfterLogin();
  } finally {
    submitting.value = false;
  }
}

async function doPwdLogin() {
  if (!pwdSubmitReady.value) {
    toastMessage('请输入手机号和密码');
    return;
  }
  submitting.value = true;
  try {
    await tokenStore.pwdLogin({ mobile: mobile.value, password: password.value, tenantId });
    await goAfterLogin();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="login__brand">
      <img v-if="shopBranding.logoUrl" :src="shopBranding.logoUrl" alt="" class="login__logo" />
      <h1 class="login__shop">{{ shopBranding.companyName }}</h1>
    </div>
    <h2 class="login__title">手机号码登录/注册</h2>

    <div class="login__tabs" role="tablist">
      <button
        type="button"
        class="login__tab"
        :class="{ 'login__tab--active': activeTab === 'sms' }"
        @click="activeTab = 'sms'"
      >
        验证码登录
      </button>
      <button
        type="button"
        class="login__tab"
        :class="{ 'login__tab--active': activeTab === 'password' }"
        @click="activeTab = 'password'"
      >
        密码登录
      </button>
    </div>

    <form v-if="activeTab === 'sms'" class="login__form" @submit.prevent="doSmsLogin">
      <label class="login__field">
        <span class="login__label">手机号</span>
        <input v-model="mobile" type="tel" maxlength="11" inputmode="numeric" placeholder="请输入手机号" />
      </label>
      <label class="login__field login__field--row">
        <span class="login__label">验证码</span>
        <input v-model="smsCode" type="text" maxlength="6" inputmode="numeric" placeholder="请输入验证码" />
        <button type="button" class="login__link" :disabled="countdown > 0" @click="handleSendCode">
          {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </label>
      <button class="login__submit" type="submit" :disabled="!smsSubmitReady || submitting">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>

    <form v-else class="login__form" @submit.prevent="doPwdLogin">
      <label class="login__field">
        <span class="login__label">手机号</span>
        <input v-model="mobile" type="tel" maxlength="11" inputmode="numeric" placeholder="请输入手机号" />
      </label>
      <label class="login__field">
        <span class="login__label">密码</span>
        <input v-model="password" type="password" placeholder="请输入密码" />
      </label>
      <button class="login__submit" type="submit" :disabled="!pwdSubmitReady || submitting">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>

    <p class="login__hint">未注册手机号将自动创建账号</p>
  </div>
</template>

<style scoped>
.login {
  margin: 0 auto;
  max-width: 420px;
  padding: 32px 20px;
}

.login__brand {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.login__logo {
  border-radius: 12px;
  height: 64px;
  object-fit: contain;
  width: 64px;
}

.login__shop {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  text-align: center;
}

.login__title {
  font-size: 1.125rem;
  margin: 0 0 24px;
  text-align: center;
}

.login__tabs {
  display: flex;
  gap: 24px;
  justify-content: center;
  margin-bottom: 24px;
}

.login__tab {
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 0.9375rem;
  padding: 0 0 8px;
}

.login__tab--active {
  border-bottom-color: var(--shop-theme, #0d9488);
  color: var(--shop-theme, #0d9488);
  font-weight: 600;
}

.login__form {
  display: grid;
  gap: 16px;
}

.login__field {
  border-bottom: 1px solid #e2e8f0;
  display: grid;
  gap: 8px;
  padding-bottom: 8px;
}

.login__field--row {
  align-items: center;
  grid-template-columns: 1fr auto;
}

.login__field--row input {
  grid-column: 1 / -1;
}

.login__field--row .login__link {
  justify-self: end;
}

.login__label {
  color: #64748b;
  font-size: 0.8125rem;
}

.login__field input {
  background: transparent;
  border: none;
  font-size: 1rem;
  outline: none;
  padding: 4px 0;
  width: 100%;
}

.login__link {
  background: transparent;
  border: none;
  color: #0f172a;
  cursor: pointer;
  font-size: 0.875rem;
}

.login__link:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.login__submit {
  background: var(--shop-theme, #0d9488);
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 8px;
  padding: 12px;
}

.login__submit:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.login__hint {
  color: #94a3b8;
  font-size: 0.8125rem;
  margin: 16px 0 0;
  text-align: center;
}
</style>
