import type {
  IAuthLoginRes,
  IDoubleTokenRes,
  IPasswordLoginParams,
  IRegisterMobileParams,
  ISmsLoginParams,
  IWxRegisterParams,
} from '@/api/types/login';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  loginOrRegisterBySms as _loginOrRegisterBySms,
  logout as _logout,
  mobileLogin as _mobileLogin,
  passwordLogin as _passwordLogin,
  refreshToken as _refreshToken,
  wxRegister as _wxRegister,
  getWxCode,
  wxCheckLogin,
} from '@/api/login';
import { useUserStore } from './user';

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

function emptyToken(): IDoubleTokenRes {
  return { access_token: '', refresh_token: '', expire_in: 0, refresh_expire_in: 0, token: '', expiresIn: 0 };
}

export const useTokenStore = defineStore(
  'token',
  () => {
    const tokenInfo = ref<IDoubleTokenRes>(emptyToken());
    const nowTime = ref(Date.now());

    const updateNowTime = () => {
      nowTime.value = Date.now();
      return useTokenStore();
    };

    const setTokenInfo = (val: IDoubleTokenRes) => {
      updateNowTime();
      tokenInfo.value = val;

      const now = Date.now();
      const accessExpire = now + val.expire_in * 1000;
      const refreshExpire = now + val.refresh_expire_in * 1000;
      uni.setStorageSync('accessTokenExpireTime', accessExpire);
      uni.setStorageSync('refreshTokenExpireTime', refreshExpire);
    };

    const isTokenExpired = computed(() => {
      if (!tokenInfo.value?.access_token) return true;
      const expireTime = uni.getStorageSync('accessTokenExpireTime');
      if (!expireTime) return true;
      return nowTime.value >= expireTime;
    });

    const isRefreshTokenExpired = computed(() => {
      const expireTime = uni.getStorageSync('refreshTokenExpireTime');
      if (!expireTime) return true;
      return nowTime.value >= expireTime;
    });

    async function _postLogin(res: IAuthLoginRes) {
      const dual: IDoubleTokenRes = {
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

    const wxLogin = async () => {
      try {
        const resCode = await getWxCode();
        const res = await wxCheckLogin({ code: resCode.code });
        if (res.isRegistered && res.access_token) {
          const dual: IDoubleTokenRes = {
            access_token: res.access_token!,
            refresh_token: res.refresh_token || '',
            expire_in: res.expire_in || 86400,
            refresh_expire_in: res.refresh_expire_in || 604800,
            token: res.token || res.access_token!,
            expiresIn: res.expiresIn || res.expire_in || 86400,
          };
          setTokenInfo(dual);
          const userStore = useUserStore();
          await userStore.fetchUserInfo();
          uni.showToast({ title: '登录成功', icon: 'success' });
        }
        return res;
      } catch (error) {
        console.error('微信登录失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };

    const mobileLogin = async (params: IRegisterMobileParams) => {
      try {
        const res = await _mobileLogin(params);
        await _postLogin(res);
        return res;
      } catch (error) {
        console.error('手机号登录失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };

    const wxRegisterAction = async (params: IWxRegisterParams) => {
      try {
        const res = await _wxRegister(params);
        await _postLogin(res);
        return res;
      } catch (error) {
        console.error('微信注册失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };

    // #ifdef H5
    const smsLogin = async (params: ISmsLoginParams) => {
      try {
        const res = await _loginOrRegisterBySms(params);
        await _postLogin(res);
        uni.showToast({ title: '登录成功', icon: 'success' });
        return res;
      } catch (error) {
        console.error('短信登录失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };

    const pwdLogin = async (params: IPasswordLoginParams) => {
      try {
        const res = await _passwordLogin(params);
        await _postLogin(res);
        uni.showToast({ title: '登录成功', icon: 'success' });
        return res;
      } catch (error) {
        console.error('密码登录失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };
    // #endif

    const logout = async () => {
      try {
        await _logout();
      } catch {
        // ignore
      } finally {
        updateNowTime();
        uni.removeStorageSync('accessTokenExpireTime');
        uni.removeStorageSync('refreshTokenExpireTime');
        tokenInfo.value = emptyToken();
        uni.removeStorageSync('token');
        const userStore = useUserStore();
        userStore.clearUserInfo();
      }
    };

    const doRefreshToken = async () => {
      try {
        if (!tokenInfo.value.refresh_token) {
          throw new Error('无效的 refreshToken');
        }
        const res = await _refreshToken(tokenInfo.value.refresh_token);
        setTokenInfo(res);
        return res;
      } catch (error) {
        console.error('刷新 token 失败:', error);
        throw error;
      } finally {
        updateNowTime();
      }
    };

    const validToken = computed(() => {
      if (isTokenExpired.value) return '';
      return tokenInfo.value?.access_token || '';
    });

    const hasLoginInfo = computed(() => !!tokenInfo.value?.access_token);

    const hasValidLogin = computed(() => hasLoginInfo.value && !isTokenExpired.value);

    const tryGetValidToken = async (): Promise<string> => {
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
    };

    return {
      wxLogin,
      mobileLogin,
      wxRegister: wxRegisterAction,
      // #ifdef H5
      smsLogin,
      pwdLogin,
      // #endif
      logout,

      hasLogin: hasValidLogin,
      refreshToken: doRefreshToken,
      tryGetValidToken,
      validToken,

      tokenInfo,
      setTokenInfo,
      updateNowTime,
    };
  },
  { persist: true },
);
