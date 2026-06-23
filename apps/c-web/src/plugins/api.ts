import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { API_SUCCESS_CODES, readApiMessage, type ApiEnvelope } from '@/utils/api-envelope';
import { LOGIN_PATH } from '@/utils/auth-routes';
import { getApiBase, getTenantId } from '@/utils/env';
import { toastFail } from '@/utils/toast';
import { useTokenStore } from '@/stores/token';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    hideErrorToast?: boolean;
    _retried?: boolean;
  }
}

let apiClient: AxiosInstance | null = null;
let refreshing = false;
const taskQueue: Array<{ resolve: () => void; reject: (reason?: unknown) => void }> = [];

function flushQueue(error?: unknown) {
  const tasks = [...taskQueue];
  taskQueue.length = 0;
  tasks.forEach((task) => {
    if (error) task.reject(error);
    else task.resolve();
  });
}

function createRequestId(): string {
  return `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function redirectToLogin() {
  const { router } = await import('@/router');
  if (router.currentRoute.value.path === LOGIN_PATH) return;
  await router.push({
    path: LOGIN_PATH,
    query: { redirect: router.currentRoute.value.fullPath },
  });
}

/** 同源 /api axios 单例：租户头、Bearer、401 刷新队列。须在 Pinia 就绪后调用 setupApiClient。 */
export function setupApiClient(): AxiosInstance {
  if (apiClient) return apiClient;

  const client = axios.create({
    baseURL: getApiBase(),
    timeout: 30_000,
    headers: {
      'Content-Type': 'application/json',
      'tenant-id': getTenantId(),
    },
  });

  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    config.headers.set('X-Request-Id', createRequestId());

    if (!config.skipAuth) {
      const tokenStore = useTokenStore();
      const token = tokenStore.validToken || (await tokenStore.tryGetValidToken());
      if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }

    return config;
  });

  client.interceptors.response.use(
    (response) => {
      const payload = response.data as ApiEnvelope | undefined;
      if (!payload || typeof payload !== 'object' || !('code' in payload)) {
        return response;
      }

      if (!API_SUCCESS_CODES.has(payload.code)) {
        const error = new Error(readApiMessage(payload)) as Error & { code?: number };
        error.code = payload.code;
        if (!response.config.hideErrorToast) {
          toastFail(readApiMessage(payload));
        }
        return Promise.reject(error);
      }

      return response;
    },
    async (error: AxiosError<ApiEnvelope>) => {
      const config = error.config;
      const status = error.response?.status;
      const bodyCode = error.response?.data?.code;
      const isUnauthorized = status === 401 || bodyCode === 401;

      if (!config || !isUnauthorized || config.skipAuth) {
        if (!config?.hideErrorToast) {
          const message = readApiMessage(error.response?.data) || error.message || '网络错误';
          toastFail(message);
        }
        return Promise.reject(error);
      }

      const tokenStore = useTokenStore();
      const refreshTokenValue = tokenStore.tokenInfo.refresh_token;

      if (!refreshTokenValue || config._retried) {
        await tokenStore.logout();
        toastFail('登录已过期，请重新登录');
        await redirectToLogin();
        return Promise.reject(error);
      }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          taskQueue.push({
            resolve: () => {
              config._retried = true;
              resolve(client.request(config));
            },
            reject,
          });
        });
      }

      refreshing = true;
      try {
        await tokenStore.refreshToken();
        flushQueue();
        config._retried = true;
        return client.request(config);
      } catch (refreshError) {
        flushQueue(refreshError);
        await tokenStore.logout();
        toastFail('登录已过期，请重新登录');
        await redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        refreshing = false;
      }
    },
  );

  apiClient = client;
  return client;
}

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    return setupApiClient();
  }
  return apiClient;
}
