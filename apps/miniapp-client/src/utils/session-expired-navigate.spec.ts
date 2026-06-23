import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { clearTestStorage } from '@/test/setup';
import { toLoginPage } from '@/utils/toLoginPage';
import { navigateAfterSessionExpired } from './session-expired-navigate';

const mockIsMp = vi.hoisted(() => ({ value: false }));

vi.mock('@uni-helper/uni-env', () => ({
  get isMp() {
    return mockIsMp.value;
  },
}));

vi.mock('@/utils/toLoginPage', () => ({
  buildLoginRedirectQueryString: vi.fn(() => '?redirect=%2Fpages%2Findex%2Findex'),
  toLoginPage: vi.fn(),
}));

describe('navigateAfterSessionExpired', () => {
  beforeEach(() => {
    clearTestStorage();
    setActivePinia(createPinia());
    vi.mocked(toLoginPage).mockClear();
    mockIsMp.value = false;
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
  });

  it('非小程序环境跳转登录页', () => {
    mockIsMp.value = false;
    navigateAfterSessionExpired();
    expect(toLoginPage).toHaveBeenCalledWith({
      mode: 'navigateTo',
      queryString: '?redirect=%2Fpages%2Findex%2Findex',
    });
  });

  it('小程序且配置为不使用内置登录页时走全局 requireAuth', () => {
    mockIsMp.value = true;
    const auth = useAuthStore();
    const spy = vi.spyOn(auth, 'requireAuth');
    navigateAfterSessionExpired();
    expect(spy).toHaveBeenCalledOnce();
    expect(toLoginPage).not.toHaveBeenCalled();
  });

  it('支持传入 reLaunch 模式（走登录页分支时）', () => {
    mockIsMp.value = false;
    navigateAfterSessionExpired({ mode: 'reLaunch' });
    expect(toLoginPage).toHaveBeenCalledWith({
      mode: 'reLaunch',
      queryString: '?redirect=%2Fpages%2Findex%2Findex',
    });
  });
});
