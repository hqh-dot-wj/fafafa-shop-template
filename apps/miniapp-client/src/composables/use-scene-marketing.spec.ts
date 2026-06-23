import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSceneModules } from '@/api/marketing';
import { clearTestStorage } from '@/test/setup';
import { useSceneMarketing } from './use-scene-marketing';

vi.mock('@/api/marketing', () => ({
  getSceneModules: vi.fn(),
}));

const mockedGetSceneModules = vi.mocked(getSceneModules);

describe('useSceneMarketing', () => {
  beforeEach(() => {
    clearTestStorage();
    mockedGetSceneModules.mockReset();
  });

  it('scene 成功时写入 trace 缓存元数据', async () => {
    mockedGetSceneModules.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      releaseNo: 7,
      traceId: 'trace-scene-7',
      source: 'scene',
      modules: [],
    });

    const hook = useSceneMarketing<string[]>('HOME_FEATURED', {
      sceneQuery: { channel: 'MINIAPP' },
      transformScene: () => ['p1'],
      cacheKey: 'home:cards',
      sourceCacheKey: 'home:source',
      cacheMetaKey: 'home:meta',
    });

    await expect(hook.load({ force: true })).resolves.toEqual(['p1']);

    expect(hook.source.value).toBe('scene');
    expect(uni.getStorageSync('home:source')).toBe('scene');
    expect(uni.getStorageSync('home:meta')).toMatchObject({
      sceneCode: 'HOME_FEATURED',
      channel: 'MINIAPP',
      releaseNo: 7,
      traceId: 'trace-scene-7',
      source: 'scene',
    });
  });

  it('scene 与 fallback 均失败时使用 stale-cache 来源', async () => {
    uni.setStorageSync('home:cards', ['cached']);
    mockedGetSceneModules.mockRejectedValue(new Error('scene failed'));

    const hook = useSceneMarketing<string[]>('HOME_FEATURED', {
      cacheKey: 'home:cards',
      fallbackLoader: vi.fn().mockRejectedValue(new Error('fallback failed')),
      shouldUseCacheOnError: () => true,
    });

    await expect(hook.load({ force: true })).resolves.toEqual(['cached']);

    expect(hook.source.value).toBe('stale-cache');
    expect(hook.error.value?.message).toBe('fallback failed');
  });

  it('restoreCache 每次按动态 key 读取当前账号缓存', () => {
    let memberScope = 'guest';
    const hook = useSceneMarketing<string[]>('HOME_FEATURED', {
      cacheKey: () => `home:${memberScope}:cards`,
    });

    uni.setStorageSync('home:guest:cards', ['guest-card']);
    expect(hook.restoreCache()).toEqual(['guest-card']);
    expect(hook.source.value).toBe('cache');

    memberScope = 'member-1';
    uni.setStorageSync('home:member-1:cards', ['member-card']);
    expect(hook.restoreCache()).toEqual(['member-card']);
    expect(hook.data.value).toEqual(['member-card']);
  });
});
