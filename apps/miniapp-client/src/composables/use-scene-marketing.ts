import type { ClientSceneView, SceneModulesQuery } from '@/api/marketing';
import { ref, shallowRef } from 'vue';
import { getSceneModules } from '@/api/marketing';

// 场景营销 composable 对应 backend ClientSceneController。
// 它统一封装“场景出数 -> 业务 fallback -> 本地缓存”的顺序，页面只消费最终数据和 source 标记。
type SceneMarketingSource = 'scene' | 'fallback' | 'cache' | 'stale-cache' | string;
type StorageKeyOption = string | (() => string | null | undefined);

interface SceneRequestOptions {
  hideErrorToast?: boolean;
  timeout?: number;
}

interface SceneLoadOptions {
  force?: boolean;
  silent?: boolean;
}

interface UseSceneMarketingOptions<TData> {
  sceneQuery?: SceneModulesQuery;
  sceneRequestOptions?: SceneRequestOptions;
  transformScene?: (sceneView: ClientSceneView) => TData;
  fallbackLoader?: () => Promise<TData>;
  sceneSource?: SceneMarketingSource;
  fallbackSource?: SceneMarketingSource;
  cacheKey?: StorageKeyOption;
  sourceCacheKey?: StorageKeyOption;
  cacheMetaKey?: StorageKeyOption;
  readCache?: (cached: unknown) => TData | null;
  shouldUseCacheOnError?: (currentData: TData | null) => boolean;
  refreshCooldownMs?: number;
  initialLoading?: boolean;
}

interface SceneCacheMeta {
  sceneCode: string;
  channel?: SceneModulesQuery['channel'];
  releaseNo?: number;
  traceId?: string;
  source: SceneMarketingSource;
  cachedAt: number;
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const message = (error as Record<string, unknown>).errMsg;
    if (typeof message === 'string' && message.trim().length > 0) {
      return new Error(message);
    }
  }
  return new Error('场景营销数据加载失败');
}

export function useSceneMarketing<TData = ClientSceneView>(
  sceneCode: string,
  options: UseSceneMarketingOptions<TData> = {},
) {
  const state = ref<ClientSceneView | null>(null);
  const data = shallowRef<TData | null>(null);
  const source = ref<SceneMarketingSource | null>(null);
  const cacheMeta = ref<SceneCacheMeta | null>(null);
  const loading = ref(Boolean(options.initialLoading));
  const error = ref<Error | null>(null);
  let lastLoadedAt = 0;

  const sceneSource = options.sceneSource ?? 'scene';
  const fallbackSource = options.fallbackSource ?? 'fallback';
  const readCache = options.readCache ?? ((cached: unknown) => (cached == null ? null : (cached as TData)));
  const shouldUseCacheOnError = options.shouldUseCacheOnError ?? ((currentData: TData | null) => currentData === null);

  function resolveStorageKey(keyOption?: StorageKeyOption): string | null {
    try {
      const raw = typeof keyOption === 'function' ? keyOption() : keyOption;
      if (typeof raw !== 'string') return null;
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }

  function isSceneCacheMeta(value: unknown): value is SceneCacheMeta {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return typeof record.sceneCode === 'string' && typeof record.cachedAt === 'number';
  }

  function restoreCache(cacheSource: SceneMarketingSource = 'cache'): TData | null {
    const cacheKey = resolveStorageKey(options.cacheKey);
    if (!cacheKey) return null;
    try {
      const cached = uni.getStorageSync(cacheKey);
      const parsed = readCache(cached);
      if (parsed === null) {
        return null;
      }

      data.value = parsed;
      source.value = cacheSource;

      const metaKey = resolveStorageKey(options.cacheMetaKey);
      if (metaKey) {
        const cachedMeta = uni.getStorageSync(metaKey);
        cacheMeta.value = isSceneCacheMeta(cachedMeta) ? cachedMeta : null;
      }
      if (loading.value) {
        loading.value = false;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function persistCache(nextData: TData, nextSource: SceneMarketingSource, sceneView?: ClientSceneView): void {
    const cacheKey = resolveStorageKey(options.cacheKey);
    if (!cacheKey) return;
    try {
      uni.setStorageSync(cacheKey, nextData);
      const sourceCacheKey = resolveStorageKey(options.sourceCacheKey);
      if (sourceCacheKey) {
        uni.setStorageSync(sourceCacheKey, nextSource);
      }

      const nextMeta: SceneCacheMeta = {
        sceneCode,
        source: nextSource,
        cachedAt: Date.now(),
      };
      if (options.sceneQuery?.channel) nextMeta.channel = options.sceneQuery.channel;
      if (typeof sceneView?.releaseNo === 'number') nextMeta.releaseNo = sceneView.releaseNo;
      if (sceneView?.traceId) nextMeta.traceId = sceneView.traceId;
      cacheMeta.value = nextMeta;
      const metaKey = resolveStorageKey(options.cacheMetaKey);
      if (metaKey) {
        uni.setStorageSync(metaKey, nextMeta);
      }
    } catch {
      // ignore storage failures
    }
  }

  async function load(loadOptions: SceneLoadOptions = {}) {
    const now = Date.now();
    if (
      !loadOptions.force &&
      typeof options.refreshCooldownMs === 'number' &&
      options.refreshCooldownMs > 0 &&
      now - lastLoadedAt < options.refreshCooldownMs
    ) {
      return data.value;
    }

    const hasData = data.value !== null;
    if (!loadOptions.silent || !hasData) {
      loading.value = true;
    }

    error.value = null;
    let nextData: TData | null = null;
    let nextSource = sceneSource;
    let sceneViewForCache: ClientSceneView | undefined;
    let latestError: unknown = null;

    try {
      const sceneView = await getSceneModules(sceneCode, options.sceneQuery, options.sceneRequestOptions);
      state.value = sceneView;
      nextData = options.transformScene ? options.transformScene(sceneView) : (sceneView as TData);
      nextSource = sceneView.source ?? sceneSource;
      sceneViewForCache = sceneView;
    } catch (sceneError) {
      latestError = sceneError;
      if (options.fallbackLoader) {
        try {
          nextData = await options.fallbackLoader();
          nextSource = fallbackSource;
        } catch (fallbackError) {
          latestError = fallbackError;
        }
      }
    }

    try {
      if (nextData !== null && nextData !== undefined) {
        data.value = nextData;
        source.value = nextSource;
        lastLoadedAt = Date.now();
        persistCache(nextData, nextSource, sceneViewForCache);
        return nextData;
      }

      if (latestError !== null) {
        error.value = toError(latestError);
      }

      // 场景出数失败时只回退到 stale-cache，不覆盖后端错误；页面可通过 source 区分是否展示降级提示。
      if (shouldUseCacheOnError(data.value)) {
        const cached = restoreCache('stale-cache');
        if (cached !== null) {
          return cached;
        }
      }

      return data.value;
    } finally {
      loading.value = false;
    }
  }

  return {
    state,
    data,
    source,
    cacheMeta,
    loading,
    error,
    load,
    refresh: (force = false) => load({ force, silent: true }),
    restoreCache,
  };
}
