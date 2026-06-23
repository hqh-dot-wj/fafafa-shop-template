import type { IDoubleTokenRes } from '@/api/types/login';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTokenStore } from '@/store/token';
import { clearTestStorage } from '@/test/setup';
import { http } from './http';

describe('http 401 refresh queue', () => {
  beforeEach(() => {
    clearTestStorage();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    (uni as unknown as { request: ReturnType<typeof vi.fn> }).request = vi.fn();
    (uni as unknown as { hideToast: ReturnType<typeof vi.fn> }).hideToast = vi.fn();
  });

  it('并发 401 只刷新一次，刷新成功后重放队列请求', async () => {
    const tokenStore = useTokenStore();
    tokenStore.setTokenInfo({
      access_token: 'expired-access',
      refresh_token: 'valid-refresh',
      expire_in: 60,
      refresh_expire_in: 60,
      token: 'expired-access',
      expiresIn: 60,
    });

    let resolveRefresh!: () => void;
    const refreshedToken: IDoubleTokenRes = {
      access_token: 'fresh-access',
      refresh_token: 'valid-refresh',
      expire_in: 60,
      refresh_expire_in: 60,
      token: 'fresh-access',
      expiresIn: 60,
    };
    const refreshPromise = new Promise<IDoubleTokenRes>((resolve) => {
      resolveRefresh = () => resolve(refreshedToken);
    });
    vi.spyOn(tokenStore, 'refreshToken').mockReturnValue(refreshPromise);

    let requestCount = 0;
    vi.mocked(uni.request).mockImplementation((options) => {
      requestCount += 1;
      const currentCount = requestCount;
      setTimeout(() => {
        if (currentCount <= 2) {
          options.success?.({
            statusCode: 401,
            data: { code: 401, msg: '登录已过期' },
            header: {},
            cookies: [],
          } as UniApp.RequestSuccessCallbackResult);
          return;
        }

        options.success?.({
          statusCode: 200,
          data: { code: 0, data: `ok-${currentCount}`, msg: 'ok' },
          header: {},
          cookies: [],
        } as UniApp.RequestSuccessCallbackResult);
      }, 0);
      return {} as UniApp.RequestTask;
    });

    const first = http<string>({ url: '/first', method: 'GET' });
    const second = http<string>({ url: '/second', method: 'GET' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(tokenStore.refreshToken).toHaveBeenCalledOnce();

    resolveRefresh();

    await expect(Promise.all([first, second])).resolves.toEqual(['ok-3', 'ok-4']);
    expect(uni.request).toHaveBeenCalledTimes(4);
  });
});
