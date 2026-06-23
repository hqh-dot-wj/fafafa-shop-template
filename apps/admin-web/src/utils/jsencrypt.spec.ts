import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEncryptionPublicKey, resetEncryptionPublicKeyCacheForTest } from './jsencrypt';

describe('RSA public key resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    resetEncryptionPublicKeyCacheForTest();
  });

  it('prefers the runtime backend public key over the static env key', async () => {
    const runtimePublicKey = 'runtime-public-key';
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ code: 200, data: { publicKey: runtimePublicKey } }), { status: 200 });
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(getEncryptionPublicKey()).resolves.toBe(runtimePublicKey);
    await expect(getEncryptionPublicKey()).resolves.toBe(runtimePublicKey);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/publicKey'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('falls back to the configured env key when the runtime key request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ code: 500, msg: 'failed' }), { status: 500 })),
    );

    await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
  });

  // 规格（#bug_008）：fallback 命中后短 TTL 复用 env key，不在故障窗口内反复重试 /auth/publicKey。
  describe('fallback TTL 行为', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('TTL 内复用 env key 不再重新 fetch /auth/publicKey', async () => {
      const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: 500 }), { status: 500 }));
      vi.stubGlobal('fetch', fetchMock);

      // 第一次：命中 fallback，发起一次 fetch
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // TTL 内（10s 后）：直接返回缓存的 fallback，不再 fetch
      vi.advanceTimersByTime(10_000);
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // TTL 内连续多次：依然不 fetch
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('TTL 过期后重新尝试运行时公钥；后端恢复则切回 runtime key', async () => {
      const runtimePublicKey = 'runtime-public-key';
      let backendUp = false;
      const fetchMock = vi.fn(async () => {
        if (!backendUp) {
          return new Response(JSON.stringify({ code: 500 }), { status: 500 });
        }
        return new Response(JSON.stringify({ code: 200, data: { publicKey: runtimePublicKey } }), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      // 第一次：后端故障 → fallback
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 后端恢复，但 TTL 还在 → 仍用 fallback，不 fetch
      backendUp = true;
      vi.advanceTimersByTime(10_000);
      await expect(getEncryptionPublicKey()).resolves.toBe(import.meta.env.VITE_APP_RSA_PUBLIC_KEY);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // 超过 TTL → 重新 fetch，拿到 runtime key
      vi.advanceTimersByTime(31_000);
      await expect(getEncryptionPublicKey()).resolves.toBe(runtimePublicKey);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      // runtime key 一旦成功获取，后续永不过期
      vi.advanceTimersByTime(60_000);
      await expect(getEncryptionPublicKey()).resolves.toBe(runtimePublicKey);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
