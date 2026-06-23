<script lang="ts" setup>
import type { MarketingCardModel } from '@/components/marketing-card/marketing-card.types';
import { buildMarketingRoutePath } from '@libs/common-constants';
import { getSceneModules } from '@/api/marketing';
import MarketingCardZone from '@/components/marketing-card/marketing-card-zone.vue';
import { mapModuleToMarketingCards } from '@/components/marketing-card/marketing-card.mapper';
import { navigateByMarketingRoute } from '@/utils/marketing-route';

defineOptions({ name: 'HomeSceneTabs' });

const PRODUCT_LIMIT = 20;

const TABS = [
  { key: 'best', label: '精品推荐', sceneCode: 'HOME_BEST_PICKS' },
  { key: 'guess', label: '猜你喜欢', sceneCode: 'HOME_GUESS_LIKES' },
  { key: 'member', label: '会员专区', sceneCode: 'HOME_MEMBER_ZONE' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface TabState {
  cards: MarketingCardModel[];
  featuredCount: number | undefined;
  loading: boolean;
  loaded: boolean;
  error: boolean;
}

const activeTab = ref<TabKey>('best');

function createTabState(): TabState {
  return { cards: [], featuredCount: undefined, loading: false, loaded: false, error: false };
}

const initialTabStates = {} as Record<TabKey, TabState>;
for (const tab of TABS) {
  initialTabStates[tab.key] = createTabState();
}
const tabStates = reactive(initialTabStates);

const currentState = computed(() => tabStates[activeTab.value]);

async function loadTab(tabKey: TabKey, force = false) {
  const tab = TABS.find((t) => t.key === tabKey)!;
  const state = tabStates[tabKey];
  if (state.loading || (state.loaded && !force)) return;

  state.loading = true;
  state.error = false;

  try {
    const sceneView = await getSceneModules(
      tab.sceneCode,
      { channel: 'MINIAPP', moduleLimit: 8, productLimit: PRODUCT_LIMIT },
      { hideErrorToast: true, timeout: 3000 },
    );

    const dedup = new Map<string, MarketingCardModel>();
    for (const mod of sceneView.modules || []) {
      const cards = mapModuleToMarketingCards(mod, {
        sceneCode: tab.sceneCode,
        entrySource: 'scene',
      });
      for (const card of cards) {
        if (!dedup.has(card.productId)) {
          dedup.set(card.productId, card);
          if (dedup.size >= PRODUCT_LIMIT) break;
        }
      }
      if (dedup.size >= PRODUCT_LIMIT) break;
    }

    state.cards = [...dedup.values()];
    state.loaded = true;

    const modules = sceneView.modules;
    if (Array.isArray(modules) && modules.length > 0) {
      const n = modules[0].uiConfig?.featuredCount;
      state.featuredCount = typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
    }
  } catch {
    state.error = true;
  } finally {
    state.loading = false;
  }
}

function switchTab(tabKey: TabKey) {
  activeTab.value = tabKey;
  void loadTab(tabKey);
}

function goDetail(item: MarketingCardModel) {
  const params: Record<string, string> = { id: item.productId };
  if (item.activityContextKey) params.activityContextKey = item.activityContextKey;
  if (item.entrySceneCode) params.entrySceneCode = item.entrySceneCode;
  if (item.entryModuleCode) params.entryModuleCode = item.entryModuleCode;
  if (item.entrySource) params.entrySource = item.entrySource;
  navigateByMarketingRoute(buildMarketingRoutePath('product_detail', params));
}

onMounted(() => {
  void loadTab('best');
});

defineExpose({
  refresh: (force = false) => void loadTab(activeTab.value, force),
});
</script>

<template>
  <view class="scene-tabs">
    <view class="scene-tabs__bar">
      <view
        v-for="tab in TABS"
        :key="tab.key"
        class="scene-tabs__item"
        :class="{ 'scene-tabs__item--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <text class="scene-tabs__label">{{ tab.label }}</text>
        <view v-if="activeTab === tab.key" class="scene-tabs__indicator" />
      </view>
    </view>

    <view class="scene-tabs__body">
      <view v-if="currentState.loading" class="scene-tabs__state">加载中...</view>
      <view v-else-if="currentState.error" class="scene-tabs__state">加载失败，请稍后重试</view>
      <view v-else-if="currentState.cards.length === 0 && currentState.loaded" class="scene-tabs__state">
        暂无推荐商品
      </view>
      <MarketingCardZone
        v-else-if="currentState.cards.length > 0"
        :cards="currentState.cards"
        :featured-count="currentState.featuredCount"
        @detail="goDetail"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.scene-tabs {
  margin: 0 var(--space-lg) var(--space-md);
}

.scene-tabs__bar {
  display: flex;
  align-items: center;
  justify-content: space-evenly;
  gap: 40rpx;
  margin-bottom: var(--space-sm);
}

.scene-tabs__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
  cursor: pointer;
}

.scene-tabs__label {
  font-size: 28rpx;
  color: var(--color-text-secondary);
  font-weight: 500;
  line-height: 1.4;
  transition: color 0.2s;
}

.scene-tabs__item--active .scene-tabs__label {
  color: var(--color-text-primary);
  font-weight: 700;
  font-size: 30rpx;
}

.scene-tabs__indicator {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 40rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background: var(--color-brand-primary);
  transform: translateX(-50%);
}

.scene-tabs__state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 110rpx;
  border-radius: var(--radius-card);
  background: var(--color-bg-surface);
  color: var(--color-text-tertiary);
  font-size: 24rpx;
}
</style>
