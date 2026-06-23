import { isMp } from '@uni-helper/uni-env';
import { LOGIN_PAGE_ENABLE_IN_MP } from '@/router/config';
import { useAuthStore } from '@/store/auth';
import { buildLoginRedirectQueryString, toLoginPage } from '@/utils/toLoginPage';

/**
 * 会话失效（401 / 刷新失败）后的统一引导。
 * 与 `router/interceptor` 一致：小程序默认不进入 H5 登录页，改为全局授权弹窗。
 */
export function navigateAfterSessionExpired(options?: { mode?: 'navigateTo' | 'reLaunch' }): void {
  if (isMp && !LOGIN_PAGE_ENABLE_IN_MP) {
    useAuthStore().requireAuth();
    return;
  }
  toLoginPage({
    mode: options?.mode ?? 'navigateTo',
    queryString: buildLoginRedirectQueryString(),
  });
}
