<script lang="ts" setup>
import type { ClientSceneView, ProductCardView } from '@/api/marketing';
import type { MarketingCardModel } from '@/components/marketing-card/marketing-card.types';
import { buildMarketingRoutePath } from '@libs/common-constants';
import { getAggregateProducts } from '@/api/product';
import MarketingCardZone from '@/components/marketing-card/marketing-card-zone.vue';
import {
  mapModuleToMarketingCards,
  mapSceneProductToMarketingCard,
} from '@/components/marketing-card/marketing-card.mapper';
import { useSceneMarketing } from '@/composables/use-scene-marketing';
import { useTokenStore, useUserStore } from '@/store';
import { navigateByMarketingRoute } from '@/utils/marketing-route';

defineOptions({
  name: 'HomeAggregateSection',
});

// 首页活动区优先消费 /client/marketing/scene/HOME_FEATURED/modules，
// 老聚合商品接口只作为场景失败时的 fallback，避免首页空白。
const HOME_SCENE_CODE = 'HOME_FEATURED';
const HOME_AGGREGATE_CHANNEL = 'MINIAPP' as const;
const HOME_SCENE_MODULE_LIMIT = 8;
const HOME_SCENE_PRODUCT_LIMIT = 20;
const HOME_AGGREGATE_CACHE_VERSION = 'v4';

function readCacheSegment(value: unknown): string {
  let raw = '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    raw = String(value);
  } else if (typeof value === 'string') {
    raw = value.trim();
  }
  return raw.replace(/[^\w-]/g, '_');
}

function resolveClientPlatform(): string {
  try {
    const platform = uni.getSystemInfoSync().platform;
    return typeof platform === 'string' ? platform.trim() : '';
  } catch {
    return '';
  }
}

const tokenStore = useTokenStore();
const userStore = useUserStore();
const clientPlatform = resolveClientPlatform();

function buildHomeAggregateCachePrefix(): string {
  const memberSegment = tokenStore.hasLogin ? readCacheSegment(userStore.userInfo?.userId) || 'unknown' : 'guest';
  const platformSegment = readCacheSegment(clientPlatform) || 'unknown-platform';
  return [
    'home',
    'aggregate',
    HOME_SCENE_CODE,
    HOME_AGGREGATE_CHANNEL,
    platformSegment,
    memberSegment,
    HOME_AGGREGATE_CACHE_VERSION,
  ].join(':');
}

function buildHomeAggregateCacheKey(part: 'cards' | 'source' | 'meta'): string {
  return `${buildHomeAggregateCachePrefix()}:${part}`;
}

/**
 * 场景出数 → MarketingCardModel[]：跨模块去重 + 限量。
 * 映射逻辑委托给 marketing-card.mapper，此处只做编排。
 */
function transformSceneToMarketingCards(sceneView: ClientSceneView): MarketingCardModel[] {
  const dedup = new Map<string, MarketingCardModel>();
  for (const module of sceneView.modules || []) {
    const moduleCards = mapModuleToMarketingCards(module, {
      sceneCode: HOME_SCENE_CODE,
      entrySource: 'scene',
    });
    for (const card of moduleCards) {
      if (!dedup.has(card.productId)) {
        dedup.set(card.productId, card);
        if (dedup.size >= HOME_SCENE_PRODUCT_LIMIT) break;
      }
    }
    if (dedup.size >= HOME_SCENE_PRODUCT_LIMIT) break;
  }
  return [...dedup.values()];
}

/**
 * 聚合商品 fallback：场景出数失败时退化到旧 aggregate 接口。
 * 聚合卡片复用 marketing-card mapper 的防御性读取，避免映射逻辑分裂。
 */
async function loadFallbackCards(): Promise<MarketingCardModel[]> {
  const data = await getAggregateProducts(
    { pageNum: 1, pageSize: HOME_SCENE_PRODUCT_LIMIT },
    { hideErrorToast: true, timeout: 6000 },
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((item) =>
      mapSceneProductToMarketingCard(item as unknown as ProductCardView, {
        sceneCode: HOME_SCENE_CODE,
        moduleCode: 'AGGREGATE_FALLBACK',
        entrySource: 'aggregate',
      }),
    )
    .filter((m): m is MarketingCardModel => m !== null);
}

const {
  state,
  data: marketingData,
  loading,
  error,
  load,
  refresh: refreshCards,
  restoreCache,
} = useSceneMarketing<MarketingCardModel[]>(HOME_SCENE_CODE, {
  sceneQuery: {
    channel: HOME_AGGREGATE_CHANNEL,
    moduleLimit: HOME_SCENE_MODULE_LIMIT,
    productLimit: HOME_SCENE_PRODUCT_LIMIT,
    ...(clientPlatform ? { platform: clientPlatform } : {}),
  },
  sceneRequestOptions: {
    hideErrorToast: true,
    timeout: 2500,
  },
  transformScene: transformSceneToMarketingCards,
  fallbackLoader: loadFallbackCards,
  sceneSource: 'scene',
  fallbackSource: 'fallback',
  cacheKey: () => buildHomeAggregateCacheKey('cards'),
  sourceCacheKey: () => buildHomeAggregateCacheKey('source'),
  cacheMetaKey: () => buildHomeAggregateCacheKey('meta'),
  refreshCooldownMs: 30 * 1000,
  initialLoading: true,
  shouldUseCacheOnError: (current) => !Array.isArray(current) || current.length === 0,
});

const cards = computed(() => marketingData.value || []);

/** 从场景原始数据读取首个模块的 featuredCount（fallback / 缓存场景下为 undefined，MarketingCardZone 使用默认值 3） */
const featuredCount = computed(() => {
  const modules = state.value?.modules;
  if (!modules || modules.length === 0) return undefined;
  const n = modules[0].uiConfig?.featuredCount;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
});

const showLoadError = computed(() => Boolean(error.value) && cards.value.length === 0);
const hasCourseGroupCard = computed(() => cards.value.some((card) => card.activityKind === 'group'));

onMounted(() => {
  const cachedCards = restoreCache();
  const hasCached = Array.isArray(cachedCards) && cachedCards.length > 0;
  void load({ force: true, silent: hasCached });
});

defineExpose({
  refresh: (force = false) => refreshCards(force),
});

function goDetail(item: MarketingCardModel) {
  const params: Record<string, string> = {
    id: item.productId,
  };
  if (item.activityContextKey) params.activityContextKey = item.activityContextKey;
  if (item.entrySceneCode) params.entrySceneCode = item.entrySceneCode;
  if (item.entryModuleCode) params.entryModuleCode = item.entryModuleCode;
  if (item.entrySource) params.entrySource = item.entrySource;
  navigateByMarketingRoute(buildMarketingRoutePath('product_detail', params));
}

function goCourseGroupSceneList() {
  navigateByMarketingRoute(
    buildMarketingRoutePath('product_list', {
      sourceType: 'SCENE',
      sceneCode: HOME_SCENE_CODE,
      title: '拼课推荐',
      activityType: 'COURSE_GROUP',
      entrySource: 'home_scene_link',
    }),
  );
}
</script>

<template>
  <view class="aggregate-section">
    <view class="aggregate-section__head">
      <text class="aggregate-section__title">精选活动</text>
      <text
        v-if="hasCourseGroupCard"
        class="aggregate-section__scene-link"
        hover-class="opacity-80"
        @click="goCourseGroupSceneList"
      >
        拼课推荐
      </text>
    </view>

    <view v-if="loading" class="aggregate-section__state">加载中...</view>
    <view v-else-if="showLoadError" class="aggregate-section__state">活动加载失败，请稍后重试</view>
    <view v-else-if="cards.length === 0" class="aggregate-section__state">暂无活动商品</view>
    <MarketingCardZone v-else :cards="cards" :featured-count="featuredCount" @detail="goDetail" />
  </view>
</template>

<style lang="scss" scoped>
.aggregate-section {
  margin: 0 var(--space-lg) var(--space-md);
}

.aggregate-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.aggregate-section__title {
  font-size: 30rpx;
  color: #222;
  font-weight: 600;
}

.aggregate-section__scene-link {
  font-size: 24rpx;
  color: #fa8c16;
}

.aggregate-section__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 110rpx;
  border-radius: var(--radius-card);
  background: #fff;
  color: #999;
  font-size: 24rpx;
}
</style>
