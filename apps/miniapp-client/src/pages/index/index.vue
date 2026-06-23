<script lang="ts" setup>
import type { ClientSceneView } from '@/api/marketing';
import { onPageScroll, onShow, onUnload } from '@dcloudio/uni-app';
import { buildMarketingRoutePath } from '@libs/common-constants';
import { getSceneModules } from '@/api/marketing';
import { useCustomNavBar } from '@/hooks/useCustomNavBar';
import { useAuthStore } from '@/store/auth';
import { useLocationStore } from '@/store/location';
import { navigateByMarketingRoute } from '@/utils/marketing-route';
import HomeEntryBento from './components/home-entry-bento.vue';
import HomePromoBlock from './components/home-promo-block.vue';
import HomeSceneTabs from './components/home-scene-tabs.vue';

defineOptions({
  name: 'Home',
});
definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页',
  },
});

const { layout } = useCustomNavBar();
const locationStore = useLocationStore();
const authStore = useAuthStore();

/** 导航栏白底不透明度 0～1，与页面滚动联动（H5 / 小程序均走 onPageScroll） */
const navBarBgOpacity = ref(0);

/** 滚动超过该距离（px）时白底完全不透明；与首行导航高度挂钩，各端一致 */
const navBgOpaqueThresholdPx = computed(() => Math.max(64, Math.round(layout.value.firstRowBottomPx + 16)));

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** 小程序等环境无 requestAnimationFrame，用 0ms 定时器合并同一帧内的多次 onPageScroll */
let scrollFlushTimer: ReturnType<typeof setTimeout> | 0 = 0;
let pendingScrollTop = 0;

function flushNavBgOpacity() {
  scrollFlushTimer = 0;
  navBarBgOpacity.value = clamp01(pendingScrollTop / navBgOpaqueThresholdPx.value);
}

onPageScroll((e) => {
  pendingScrollTop = e.scrollTop;
  if (scrollFlushTimer !== 0) {
    return;
  }
  scrollFlushTimer = setTimeout(flushNavBgOpacity, 0);
});

onUnload(() => {
  if (scrollFlushTimer !== 0) {
    clearTimeout(scrollFlushTimer);
    scrollFlushTimer = 0;
  }
});

const description = ref(
  'unibest 是一个集成了多种工具和技术的 uniapp 开发模板，由 uniapp + Vue3 + Ts + Vite5 + UnoCss + VSCode 构建，模板具有代码提示、自动格式化、统一配置、代码片段等功能，并内置了许多常用的基本组件和基本功能，让你编写 uniapp 拥有 best 体验。',
);

/** 胶囊横幅图地址，有值时展示 image，否则占位 */
const capsuleBannerSrc = ref<string>('');

/** 协议通过后补一轮无感漂移检测（onLoad 时若先弹协议则此处补执行） */
watch(
  () => authStore.requireAgreement,
  (needAgreement) => {
    if (!needAgreement) {
      void locationStore.evaluateDriftAndMaybeSwitch();
    }
  },
);

const sceneTabsRef = ref<InstanceType<typeof HomeSceneTabs> | null>(null);
const HOME_BANNER_SCENE_CODE = 'HOME_FEATURED';
const HOME_BANNER_REFRESH_MIN_INTERVAL_MS = 10 * 1000;
const HOME_BANNER_MODULE_TYPE_PRIORITY = ['HOME_CAPSULE_BANNER', 'BANNER'];
const capsuleBannerTargetPath = ref('');
const bannerLoading = ref(false);
let lastBannerRefreshAt = 0;

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function pickBannerModule(sceneView: ClientSceneView): ClientSceneView['modules'][number] | null {
  const modules = Array.isArray(sceneView.modules) ? sceneView.modules : [];
  if (modules.length === 0) return null;

  for (const type of HOME_BANNER_MODULE_TYPE_PRIORITY) {
    const matched = modules.find((item) => readString(item.moduleType).toUpperCase() === type);
    if (matched) return matched;
  }

  return (
    modules.find((item) => readString(toRecord(item.uiConfig).imageUrl || toRecord(item.uiConfig).bannerImage)) || null
  );
}

function resolveBannerImage(module: ClientSceneView['modules'][number]): string {
  const uiConfig = toRecord(module.uiConfig);
  const fromUi =
    readString(uiConfig.imageUrl) ||
    readString(uiConfig.bannerImage) ||
    readString(uiConfig.image) ||
    readString(uiConfig.coverImage) ||
    readString(uiConfig.imgUrl);
  if (fromUi) return fromUi;

  const firstProduct = module.products?.[0];
  if (!firstProduct) return '';
  const productRecord = toRecord(firstProduct);
  return (
    readString(productRecord.productImg) ||
    readString(productRecord.coverImage) ||
    (Array.isArray(productRecord.productImages)
      ? readString((productRecord.productImages as unknown[]).find((item) => typeof item === 'string'))
      : '')
  );
}

function resolveBannerTargetPath(module: ClientSceneView['modules'][number]): string {
  const uiConfig = toRecord(module.uiConfig);
  const fromUi =
    readString(uiConfig.pageRoute) ||
    readString(uiConfig.targetPath) ||
    readString(uiConfig.linkPath) ||
    readString(uiConfig.url);
  if (fromUi) return fromUi;

  const firstProduct = module.products?.[0];
  const productId = readString(toRecord(firstProduct).productId);
  if (!productId) return '';
  return buildMarketingRoutePath('product_detail', {
    id: productId,
    entrySource: 'home_banner',
  });
}

async function loadCapsuleBanner(force = false) {
  if (bannerLoading.value) return;
  const now = Date.now();
  if (!force && now - lastBannerRefreshAt < HOME_BANNER_REFRESH_MIN_INTERVAL_MS) return;

  bannerLoading.value = true;
  try {
    const sceneView = await getSceneModules(
      HOME_BANNER_SCENE_CODE,
      {
        channel: 'MINIAPP',
        moduleLimit: 20,
        productLimit: 5,
      },
      { hideErrorToast: true, timeout: 2500 },
    );
    const bannerModule = pickBannerModule(sceneView);
    if (!bannerModule) {
      capsuleBannerSrc.value = '';
      capsuleBannerTargetPath.value = '';
      return;
    }
    capsuleBannerSrc.value = resolveBannerImage(bannerModule);
    capsuleBannerTargetPath.value = resolveBannerTargetPath(bannerModule);
    lastBannerRefreshAt = now;
  } catch {
    capsuleBannerSrc.value = '';
    capsuleBannerTargetPath.value = '';
  } finally {
    bannerLoading.value = false;
  }
}

function handleCapsuleBannerClick() {
  if (!capsuleBannerTargetPath.value) return;
  navigateByMarketingRoute(capsuleBannerTargetPath.value);
}

/** 避免首页 onShow 与切 tab 抖动导致营销区短时间重复拉数 */
let lastAggregateRefreshAt = 0;
const AGGREGATE_ONSHOW_MIN_INTERVAL_MS = 4000;

onShow(() => {
  const now = Date.now();
  if (now - lastAggregateRefreshAt >= AGGREGATE_ONSHOW_MIN_INTERVAL_MS) {
    lastAggregateRefreshAt = now;
    sceneTabsRef.value?.refresh();
  }
  void loadCapsuleBanner();
  void locationStore.evaluateDriftAndMaybeSwitch();
});
</script>

<template>
  <view class="page-wrap">
    <!-- 渐变铺在占位区 + 固定导航背后（导航栏透明），与下方促销区同一通栏 -->
    <view class="hero-gradient">
      <fg-home-custom-nav-bar :scroll-background-opacity="navBarBgOpacity" />
      <view class="content-wrap py-space-lg">
        <HomePromoBlock />
      </view>
    </view>

    <!-- 四宫格入口：纯白底，与过渡条分离 -->
    <view class="entry-section">
      <HomeEntryBento />
    </view>

    <!-- 胶囊形横幅图：左右与 entry 同边距，有 URL 时换 image -->
    <view class="capsule-banner-section">
      <view class="capsule-banner" hover-class="opacity-90" @click="handleCapsuleBannerClick">
        <image v-if="capsuleBannerSrc" class="capsule-banner__image" :src="capsuleBannerSrc" mode="aspectFill" />
        <view v-else class="capsule-banner__placeholder">
          <text class="capsule-banner__hint">横幅图片占位</text>
        </view>
      </view>
    </view>

    <HomeSceneTabs ref="sceneTabsRef" />
  </view>
</template>

<style lang="scss" scoped>
/**
 * 首页背景分层：
 * - 半透明 rgba（--color-home-hero-gradient-fade）仅画在 .hero-gradient 内，下沿与「四宫格入口」上边框对齐。
 * - .page-wrap 仅用与渐变尾部一致的实色兜底，以下模块（entry / 胶囊 / 聚合）不再被整页渐变拉伸。
 * - 色标 % 相对于 .hero-gradient 高度（导航 + 促销通栏），与内容增高/减高联动。
 */
.page-wrap {
  min-height: 100vh;
  background-color: var(--color-home-hero-gradient-tail);
}

.hero-gradient {
  /* 英雄区较矮时，色标需明显后移：半透明 rgba 落在底部，贴近四宫格上沿 */
  --home-hero-stop-mid: 44%;
  --home-hero-stop-end: 66%;
  --home-hero-stop-fade: 92%;
  --home-hero-stop-tail-solid: 98%;

  background-color: var(--color-home-hero-gradient-tail);
  background-image: linear-gradient(
    180deg,
    var(--color-home-hero-gradient-start) 0%,
    var(--color-home-hero-gradient-mid) var(--home-hero-stop-mid),
    var(--color-home-hero-gradient-end) var(--home-hero-stop-end),
    var(--color-home-hero-gradient-fade) var(--home-hero-stop-fade),
    var(--color-home-hero-gradient-tail) var(--home-hero-stop-tail-solid),
    var(--color-home-hero-gradient-tail) 100%
  );
}

.capsule-banner-section {
  --capsule-banner-height: 160rpx;

  margin: var(--space-md) var(--space-lg) var(--space-md);
}

.capsule-banner {
  width: 100%;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background-color: var(--color-bg-surface);
  border: 1rpx solid var(--color-border-default);
  box-sizing: border-box;
}

.capsule-banner__image {
  display: block;
  width: 100%;
  height: var(--capsule-banner-height);
}

.capsule-banner__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--capsule-banner-height);
}

.capsule-banner__hint {
  font-size: var(--font-body-medium);
  color: var(--color-text-tertiary);
  line-height: var(--lh-normal);
}

.entry-section {
  background-color: var(--color-bg-surface);

  margin: 0 var(--space-lg);
  border-radius: var(--radius-card);
}
</style>
