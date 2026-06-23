import { defineStore } from 'pinia';
import type { AuthLoginRes, DoubleTokenRes, PasswordLoginParams, SmsLoginParams } from '@/types/auth';
import {
  loginOrRegisterBySms,
  logout as apiLogout,
  passwordLogin,
  refreshToken as apiRefreshToken,
} from '@/service/api/auth';
import { useUserStore } from '@/stores/user';
import { useApi } from '@/hooks/use-api';

const ACCESS_EXPIRE_KEY = 'c-web-accessTokenExpireTime';
const REFRESH_EXPIRE_KEY = 'c-web-refreshTokenExpireTime';

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

function emptyToken(): DoubleTokenRes {
  return { access_token: '', refresh_token: '', expire_in: 0, refresh_expire_in: 0, token: '', expiresIn: 0 };
}

function readExpireTime(key: string): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(key);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function writeExpireTimes(accessExpire: number, refreshExpire: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_EXPIRE_KEY, String(accessExpire));
  localStorage.setItem(REFRESH_EXPIRE_KEY, String(refreshExpire));
}

function clearExpireTimes() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_EXPIRE_KEY);
  localStorage.removeItem(REFRESH_EXPIRE_KEY);
}

export const useTokenStore = defineStore(
  'c-web-token',
  () => {
    const tokenInfo = ref<DoubleTokenRes>(emptyToken());
    const nowTime = ref(Date.now());

    function updateNowTime() {
      nowTime.value = Date.now();
      return useTokenStore();
    }

    function setTokenInfo(val: DoubleTokenRes) {
      updateNowTime();
      tokenInfo.value = val;
      const now = Date.now();
      writeExpireTimes(now + val.expire_in * 1000, now + val.refresh_expire_in * 1000);
    }

    const isTokenExpired = computed(() => {
      if (!tokenInfo.value.access_token) return true;
      const expireTime = readExpireTime(ACCESS_EXPIRE_KEY);
      if (!expireTime) return true;
      return nowTime.value >= expireTime;
    });

    const isRefreshTokenExpired = computed(() => {
      const expireTime = readExpireTime(REFRESH_EXPIRE_KEY);
      if (!expireTime) return true;
      return nowTime.value >= expireTime;
    });

    const validToken = computed(() => {
      if (isTokenExpired.value) return '';
      return tokenInfo.value.access_token || '';
    });

    const hasLogin = computed(() => !!tokenInfo.value.access_token && !isTokenExpired.value);

    async function postLogin(res: AuthLoginRes) {
      const dual: DoubleTokenRes = {
        access_token: res.access_token,
        refresh_token: res.refresh_token,
        expire_in: res.expire_in,
        refresh_expire_in: res.refresh_expire_in,
        token: res.token || res.access_token,
        expiresIn: res.expiresIn || res.expire_in,
      };
      setTokenInfo(dual);
      const userStore = useUserStore();
      await userStore.fetchUserInfo();
    }

    async function smsLogin(params: SmsLoginParams) {
      const { apiClient } = useApi();
      try {
        const res = await loginOrRegisterBySms(apiClient, params);
        await postLogin(res);
        return res;
      } finally {
        updateNowTime();
      }
    }

    async function pwdLogin(params: PasswordLoginParams) {
      const { apiClient } = useApi();
      try {
        const res = await passwordLogin(apiClient, params);
        await postLogin(res);
        return res;
      } finally {
        updateNowTime();
      }
    }

    async function doRefreshToken() {
      const { apiClient } = useApi();
      if (!tokenInfo.value.refresh_token) {
        throw new Error('无效的 refreshToken');
      }
      try {
        const res = await apiRefreshToken(apiClient, tokenInfo.value.refresh_token);
        setTokenInfo(res);
        return res;
      } finally {
        updateNowTime();
      }
    }

    async function tryGetValidToken(): Promise<string> {
      updateNowTime();
      if (validToken.value) return validToken.value;

      if (isRefreshing && refreshPromise) return refreshPromise;

      if (!isRefreshTokenExpired.value) {
        isRefreshing = true;
        refreshPromise = (async () => {
          try {
            await doRefreshToken();
            return validToken.value;
          } catch {
            return '';
          } finally {
            isRefreshing = false;
            refreshPromise = null;
          }
        })();
        return refreshPromise;
      }

      return '';
    }

    async function logout() {
      const { apiClient } = useApi();
      try {
        if (tokenInfo.value.access_token) {
          await apiLogout(apiClient);
        }
      } catch {
        // 登出接口失败仍清本地态
      } finally {
        updateNowTime();
        clearExpireTimes();
        tokenInfo.value = emptyToken();
        useUserStore().clearUserInfo();
      }
    }

    return {
      tokenInfo,
      hasLogin,
      validToken,
      setTokenInfo,
      updateNowTime,
      smsLogin,
      pwdLogin,
      refreshToken: doRefreshToken,
      tryGetValidToken,
      logout,
    };
  },
  { persist: true },
);
