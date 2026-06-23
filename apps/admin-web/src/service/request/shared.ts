import { useAuthStore } from '@/store/modules/auth';
import { localStg } from '@/utils/storage';
import type { RequestInstanceState } from './type';

export function getAuthorization() {
  const token = localStg.get('token');
  const Authorization = token ? `Bearer ${token}` : null;

  return Authorization;
}

/** refresh token（动态 import 避免 request ↔ auth 循环依赖） */
async function handleRefreshToken() {
  const authStore = useAuthStore();
  const rToken = localStg.get('refreshToken') || '';
  if (!rToken) {
    await authStore.resetStore();
    return false;
  }

  try {
    const { fetchRefreshToken } = await import('@/service/api/auth');
    const { data } = await fetchRefreshToken({ refreshToken: rToken });
    if (!data?.access_token || !data?.refresh_token) {
      await authStore.resetStore();
      return false;
    }
    localStg.set('token', data.access_token);
    localStg.set('refreshToken', data.refresh_token);
    return true;
  } catch {
    await authStore.resetStore();
    return false;
  }
}

export async function handleExpiredRequest(state: RequestInstanceState) {
  if (!state.refreshTokenFn) {
    state.refreshTokenFn = handleRefreshToken();
  }

  const success = await state.refreshTokenFn;

  setTimeout(() => {
    state.refreshTokenFn = null;
  }, 1000);

  return success;
}

export function showErrorMsg(state: RequestInstanceState, message: string) {
  if (!state.errMsgStack?.length) {
    state.errMsgStack = [];
  }

  const isExist = state.errMsgStack.includes(message);

  if (!isExist) {
    state.errMsgStack.push(message);

    window.$message?.error(message, {
      onLeave: () => {
        state.errMsgStack = state.errMsgStack.filter((msg) => msg !== message);

        setTimeout(() => {
          state.errMsgStack = [];
        }, 5000);
      },
    });
  }
}
