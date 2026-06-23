import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTestStorage } from '@/test/setup';
import { toLoginPage } from '@/utils/toLoginPage';
import { useAuthStore } from './auth';
import { useRuntimePopupOrchestrator } from './popup-orchestrator';
import { useTokenStore } from './token';

const mockIsMp = vi.hoisted(() => ({ value: true }));

vi.mock('@uni-helper/uni-env', () => ({
  get isMp() {
    return mockIsMp.value;
  },
}));

vi.mock('@/utils/toLoginPage', () => ({
  buildLoginRedirectQueryString: vi.fn(() => '?redirect=%2Fpages%2Fcart%2Fcart'),
  toLoginPage: vi.fn(),
}));

describe('auth requireAgreement', () => {
  beforeEach(() => {
    clearTestStorage();
    setActivePinia(createPinia());
    mockIsMp.value = true;
    vi.mocked(toLoginPage).mockClear();
  });

  it('rejected 状态仍返回 requireAgreement=true', () => {
    uni.setStorageSync('privacyDecision', 'rejected');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    expect(auth.requireAgreement).toBe(true);
  });

  it('agreed 且版本匹配时 requireAgreement=false', () => {
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    expect(auth.requireAgreement).toBe(false);
  });

  it('空决策且版本已匹配时仍需协议', () => {
    uni.removeStorageSync('privacyDecision');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    expect(auth.requireAgreement).toBe(true);
  });

  it('协议未通过时 requireAuth 不打开登录弹层', () => {
    uni.setStorageSync('privacyDecision', 'rejected');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    const popup = useRuntimePopupOrchestrator();
    const ok = auth.requireAuth(() => {});
    expect(ok).toBe(false);
    expect(auth.showAuthModal).toBe(true);
    expect(popup.activeKind.value).toBe('agreement');
  });

  it('协议通过时 requireAuth 进入登录弹层队列', () => {
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    const popup = useRuntimePopupOrchestrator();
    const ok = auth.requireAuth(() => {});
    expect(ok).toBe(false);
    expect(auth.showAuthModal).toBe(true);
    expect(popup.activeKind.value).toBe('login');
  });

  it('h5 环境 requireAuth 跳转登录页而不是打开小程序授权弹窗', () => {
    mockIsMp.value = false;
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const auth = useAuthStore();
    const callback = vi.fn();
    const ok = auth.requireAuth(callback);
    expect(ok).toBe(false);
    expect(auth.showAuthModal).toBe(false);
    expect(auth.consumeAuthCallback()).toBe(callback);
    expect(toLoginPage).toHaveBeenCalledWith({ queryString: '?redirect=%2Fpages%2Fcart%2Fcart' });
  });

  it('access token 过期但 refresh token 存在时先尝试续期并执行回调', async () => {
    uni.setStorageSync('privacyDecision', 'agreed');
    uni.setStorageSync('policyVersion', '2026-03-31');
    const tokenStore = useTokenStore();
    tokenStore.setTokenInfo({
      access_token: 'expired-access',
      refresh_token: 'valid-refresh',
      expire_in: -1,
      refresh_expire_in: 60,
      token: 'expired-access',
      expiresIn: -1,
    });
    vi.spyOn(tokenStore, 'tryGetValidToken').mockResolvedValue('fresh-access');
    const auth = useAuthStore();
    const callback = vi.fn();

    const ok = auth.requireAuth(callback);
    await Promise.resolve();

    expect(ok).toBe(false);
    expect(callback).toHaveBeenCalledOnce();
    expect(auth.showAuthModal).toBe(false);
    expect(toLoginPage).not.toHaveBeenCalled();
  });
});
