<script lang="ts" setup>
import type { ClientCategory, ClientProduct } from '@libs/common-types';
import type { ClientModuleView, ClientSceneView } from '@/api/marketing';
import type { MarketingCardModel } from '@/components/marketing-card/marketing-card.types';
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { buildMarketingRoutePath } from '@libs/common-constants';
import { computed, onMounted, ref } from 'vue';
import { getSceneModules } from '@/api/marketing';
import { getCategoryTree, getProductList } from '@/api/product';
import { mapClientProductToMarketingCard } from '@/components/marketing-card/marketing-card.mapper';
import TenantSelector from '@/components/tenant-selector/tenant-selector.vue';
import { useCustomNavBar } from '@/hooks/useCustomNavBar';
import CategoryProductCard from '@/pages/category/components/category-product-card.vue';
import { useLocationStore } from '@/store/location';
import { navigateByMarketingRoute } from '@/utils/marketing-route';

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '商品分类',
    /** 与购物车一致：禁止页面容器滚动，仅内部 scroll-view 滚动，避免 MP/H5 双滚动条 */
    disableScroll: true,
  },
});

const locationStore = useLocationStore();
const { layout } = useCustomNavBar();

/** 自定义导航第一行（与微信胶囊下沿对齐）内容区高度 */
const customNavRowHeightPx = computed(() =>
  Math.max(44, layout.value.firstRowBottomPx - layout.value.statusBarHeightPx),
);

const mpCapsulePaddingStyle = computed(() => {
  let paddingRightPx = 0;
  // #ifdef MP-WEIXIN
  paddingRightPx = layout.value.capsuleSafeWidthPx;
  // #endif
  return paddingRightPx > 0 ? { paddingRight: `${paddingRightPx}px` } : {};
});

const keyword = ref('');

/** 开发环境用于撑满横向滚动预览的一级 ID 起点（与真实数据隔离，不请求商品列表） */
const DEV_LEVEL1_PREVIEW_ID_MIN = 920_000;

const DEV_LEVEL1_PREVIEW_NAMES = [
  '生鲜',
  '乳品',
  '休闲',
  '粮油',
  '酒饮',
  '冻品',
  '烘焙',
  '个护',
  '家居',
  '母婴',
  '宠物',
  '礼品',
  '进口',
  '特产',
] as const;

function withDevLevel1ScrollPreview(tree: ClientCategory[]): ClientCategory[] {
  if (!import.meta.env.DEV) return tree;
  const minCount = 12;
  if (tree.length >= minCount) return tree;
  const need = minCount - tree.length;
  const extra: ClientCategory[] = [];
  for (let i = 0; i < need; i++) {
    const name = DEV_LEVEL1_PREVIEW_NAMES[i % DEV_LEVEL1_PREVIEW_NAMES.length] ?? '其他';
    extra.push({
      catId: DEV_LEVEL1_PREVIEW_ID_MIN + i,
      name,
      icon: '',
      parentId: 0,
      sort: 900 + i,
      children: [],
    });
  }
  return [...tree, ...extra];
}

const categories = ref<ClientCategory[]>([]);
const activeLevel1Id = ref<number | null>(null);
const activeLevel2Id = ref<number | null>(null);
const products = ref<ClientProduct[]>([]);
const loading = ref(false);
const categoryBannerSrc = ref('');
const categoryBannerTargetPath = ref('');
const categoryBannerLoading = ref(false);
const CATEGORY_BANNER_SCENE_CODE = 'HOME_FEATURED';
const CATEGORY_BANNER_MODULE_TYPE_PRIORITY = ['CATEGORY_BANNER', 'BANNER'];
const productCards = computed(() =>
  products.value
    .map((product) =>
      mapClientProductToMarketingCard(product, {
        entrySource: 'category',
        listDensity: 'category',
      }),
    )
    .filter((item): item is MarketingCardModel => item !== null),
);

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickCategoryBannerModule(sceneView: ClientSceneView): ClientModuleView | null {
  const modules = Array.isArray(sceneView.modules) ? sceneView.modules : [];
  if (modules.length === 0) return null;

  for (const type of CATEGORY_BANNER_MODULE_TYPE_PRIORITY) {
    const matched = modules.find((item) => readString(item.moduleType)?.toUpperCase() === type);
    if (matched) return matched;
  }

  return (
    modules.find((item) => {
      const uiConfig = toRecord(item.uiConfig);
      return Boolean(readString(uiConfig.imageUrl) || readString(uiConfig.bannerImage) || readString(uiConfig.image));
    }) || null
  );
}

function resolveCategoryBannerImage(module: ClientModuleView): string {
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
  const fromProduct = readString(productRecord.productImg) || readString(productRecord.coverImage);
  if (fromProduct) return fromProduct;
  return readStringArray(productRecord.productImages)[0] || '';
}

function resolveCategoryBannerTargetPath(module: ClientModuleView): string {
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
    entrySource: 'category_banner',
  });
}

async function loadCategoryBanner() {
  if (categoryBannerLoading.value) return;
  categoryBannerLoading.value = true;
  try {
    const sceneView = await getSceneModules(
      CATEGORY_BANNER_SCENE_CODE,
      { channel: 'MINIAPP', moduleLimit: 20, productLimit: 5 },
      { hideErrorToast: true, timeout: 2500 },
    );
    const bannerModule = pickCategoryBannerModule(sceneView);
    if (!bannerModule) {
      categoryBannerSrc.value = '';
      categoryBannerTargetPath.value = '';
      return;
    }
    categoryBannerSrc.value = resolveCategoryBannerImage(bannerModule);
    categoryBannerTargetPath.value = resolveCategoryBannerTargetPath(bannerModule);
  } catch {
    categoryBannerSrc.value = '';
    categoryBannerTargetPath.value = '';
  } finally {
    categoryBannerLoading.value = false;
  }
}

function onCategoryBannerClick() {
  if (!categoryBannerTargetPath.value) return;
  navigateByMarketingRoute(categoryBannerTargetPath.value);
}

type CategoryNodeType = 'CATEGORY' | 'SCENE' | 'LINK';

function readSceneCode(category: ClientCategory): string | undefined {
  const ext = category as ClientCategory & { sceneCode?: string; nodeType?: string; type?: string };
  const sceneCode = readString(ext.sceneCode);
  if (!sceneCode) return undefined;
  const nodeType = readCategoryNodeType(category);
  if (nodeType !== undefined && nodeType !== 'SCENE') return undefined;
  return sceneCode;
}

function readCategoryNodeType(category: ClientCategory): CategoryNodeType | undefined {
  const ext = category as ClientCategory & { sceneCode?: string; nodeType?: string; type?: string };
  const normalized = readString(ext.nodeType ?? ext.type)?.toUpperCase();
  if (normalized === 'CATEGORY' || normalized === 'SCENE' || normalized === 'LINK') {
    return normalized;
  }
  if (readString(ext.sceneCode)) {
    return 'SCENE';
  }
  return undefined;
}

function readLinkPagePath(category: ClientCategory): string | undefined {
  const ext = category as ClientCategory & { pagePath?: string; pageRoute?: string; linkPath?: string; url?: string };
  return readString(ext.pagePath) ?? readString(ext.pageRoute) ?? readString(ext.linkPath) ?? readString(ext.url);
}

function openLinkPage(category: ClientCategory): boolean {
  const pagePath = readLinkPagePath(category);
  if (!pagePath) return false;
  return navigateByMarketingRoute(pagePath);
}

function canLoadProductsForCategoryNode(category: ClientCategory | undefined): boolean {
  if (!category) return false;
  const nodeType = readCategoryNodeType(category);
  if (nodeType === 'SCENE' || nodeType === 'LINK') return false;
  if (readSceneCode(category)) return false;
  return true;
}

function openSceneProductList(category: ClientCategory) {
  const sceneCode = readSceneCode(category);
  if (!sceneCode) return;
  const params: Record<string, string> = {
    sourceType: 'SCENE',
    sceneCode,
    title: category.name || '场景商品',
  };
  if (sceneCode.toUpperCase().includes('COURSE_GROUP') || category.name.includes('拼课')) {
    params.activityType = 'COURSE_GROUP';
  }
  const routePath = buildMarketingRoutePath('product_list', params);
  navigateByMarketingRoute(routePath);
}

const level2List = computed(() => {
  const current = categories.value.find((c) => c.catId === activeLevel1Id.value);
  return current?.children ?? [];
});

function findCurrentCategoryNode(): ClientCategory | undefined {
  if (activeLevel2Id.value !== null) {
    return level2List.value.find((item) => item.catId === activeLevel2Id.value);
  }
  return categories.value.find((item) => item.catId === activeLevel1Id.value);
}

function pickFirstListableChild(children: ClientCategory[]): ClientCategory | undefined {
  return children.find((item) => canLoadProductsForCategoryNode(item));
}

const listCategoryId = computed(() => {
  const currentNode = findCurrentCategoryNode();
  if (!canLoadProductsForCategoryNode(currentNode)) return null;
  return currentNode?.catId ?? null;
});

onLoad(async () => {
  const hasCoords = locationStore.latitude != null && locationStore.longitude != null;
  if (!locationStore.locationGranted || !hasCoords) {
    const located = await locationStore.requestLocation();
    if (!located && !locationStore.currentTenantId) {
      await locationStore.openTenantSelector();
    }
  } else {
    await locationStore.hydrateReverseGeocodeWhenMissing();
  }
  await loadCategories();
  await loadCategoryBanner();
});

onShow(() => {
  void locationStore.hydrateReverseGeocodeWhenMissing();
  void syncProductsWithSelection();
});

onMounted(() => {
  uni.$on('tenant-changed', handleTenantChanged);
});

onUnload(() => {
  uni.$off('tenant-changed', handleTenantChanged);
});

function handleTenantChanged() {
  void loadCategories();
  void loadCategoryBanner();
}

function syncSelectionAfterTreeLoaded(tree: ClientCategory[]) {
  const l1Valid = activeLevel1Id.value !== null && tree.some((c) => c.catId === activeLevel1Id.value);
  if (!l1Valid) {
    activeLevel1Id.value = tree[0]?.catId ?? null;
  }
  const l1 = tree.find((c) => c.catId === activeLevel1Id.value);
  const children: ClientCategory[] = l1?.children ?? [];
  if (children.length > 0) {
    const selected = activeLevel2Id.value !== null ? children.find((c) => c.catId === activeLevel2Id.value) : undefined;
    if (selected && canLoadProductsForCategoryNode(selected)) return;
    activeLevel2Id.value = pickFirstListableChild(children)?.catId ?? null;
  } else {
    activeLevel2Id.value = null;
  }
}

async function loadCategories() {
  try {
    const result = await getCategoryTree();
    const raw = result && result.length > 0 ? result : [];
    const merged = withDevLevel1ScrollPreview(raw);
    if (merged.length > 0) {
      categories.value = merged;
      syncSelectionAfterTreeLoaded(merged);
      await syncProductsWithSelection();
    }
  } catch (err) {
    console.error('加载分类失败:', err);
  }
}

async function syncProductsWithSelection() {
  if (!listCategoryId.value) {
    products.value = [];
    return;
  }
  await loadProducts();
}

async function loadProducts() {
  const catId = listCategoryId.value;
  if (!catId) return;
  if (catId >= DEV_LEVEL1_PREVIEW_ID_MIN) {
    products.value = [];
    return;
  }

  loading.value = true;
  try {
    const params: {
      pageNum: number;
      pageSize: number;
      categoryId: number;
      name?: string;
    } = {
      pageNum: 1,
      pageSize: 20,
      categoryId: catId,
    };
    if (keyword.value) params.name = keyword.value;

    const result = await getProductList(params);
    products.value = result?.rows ?? [];
  } catch (err) {
    console.error('加载商品失败:', err);
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  void syncProductsWithSelection();
}

function onClear() {
  keyword.value = '';
  void syncProductsWithSelection();
}

function onLevel1Change(catId: number) {
  if (activeLevel1Id.value === catId) return;
  activeLevel1Id.value = catId;
  const l1 = categories.value.find((c) => c.catId === catId);
  if (l1) {
    const nodeType = readCategoryNodeType(l1);
    if (nodeType === 'LINK') {
      activeLevel2Id.value = null;
      products.value = [];
      openLinkPage(l1);
      return;
    }
    const sceneCode = readSceneCode(l1);
    if (sceneCode) {
      activeLevel2Id.value = null;
      products.value = [];
      openSceneProductList(l1);
      return;
    }
  }
  const children = l1?.children ?? [];
  activeLevel2Id.value = pickFirstListableChild(children)?.catId ?? null;
  void syncProductsWithSelection();
}

function onLevel2Change(catId: number) {
  if (activeLevel2Id.value === catId) return;
  const category = level2List.value.find((item) => item.catId === catId);
  if (category) {
    const nodeType = readCategoryNodeType(category);
    if (nodeType === 'LINK') {
      activeLevel2Id.value = catId;
      products.value = [];
      openLinkPage(category);
      return;
    }
    const sceneCode = readSceneCode(category);
    if (sceneCode) {
      activeLevel2Id.value = catId;
      products.value = [];
      openSceneProductList(category);
      return;
    }
  }
  activeLevel2Id.value = catId;
  void syncProductsWithSelection();
}

function onExpandLevel1() {
  const names = categories.value.map((c) => c.name);
  if (names.length === 0) return;
  uni.showActionSheet({
    itemList: names,
    success(res) {
      const picked = categories.value[res.tapIndex];
      if (picked) onLevel1Change(picked.catId);
    },
  });
}

async function openTenantPopup() {
  // #ifdef H5
  uni.navigateTo({ url: '/pages/address/select' });
  // #endif
  // #ifndef H5
  await locationStore.openTenantSelector();
  // #endif
}

function goCategoryProductDetail(item: MarketingCardModel) {
  const params: Record<string, string> = {
    id: item.productId,
    entrySource: item.entrySource || 'category',
  };
  if (activeLevel1Id.value !== null) {
    params.level1CategoryId = String(activeLevel1Id.value);
  }
  if (activeLevel2Id.value !== null) {
    params.categoryId = String(activeLevel2Id.value);
  }
  if (item.activityContextKey) params.activityContextKey = item.activityContextKey;
  navigateByMarketingRoute(buildMarketingRoutePath('product_detail', params));
}

/** 排序、筛选条仅占位，列表接口暂不支持对应参数 */
type SortKey = 'default' | 'sales' | 'discount' | 'price';
const activeSort = ref<SortKey>('default');
const priceOrder = ref<'asc' | 'desc'>('asc');

function onSortTap(key: Exclude<SortKey, 'default'>) {
  if (key === 'price') {
    if (activeSort.value === 'price') {
      priceOrder.value = priceOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
      activeSort.value = 'price';
      priceOrder.value = 'asc';
    }
    return;
  }
  activeSort.value = activeSort.value === key ? 'default' : key;
}
</script>

<template>
  <!-- 整页固定布局下外层应始终不可滚；租户弹层由组件自身 lock-scroll，无需在关闭时改为 visible -->
  <page-meta page-style="overflow: hidden;" />

  <view class="category-page">
    <!-- 顶区渐变：搜索行 + 一级分类（浅绿横向三色过渡） -->
    <view class="category-header-gradient">
      <!-- 自定义顶栏：微信左搜索 + 右胶囊安全区；H5 左搜索 + 右当前地址 -->
      <view class="category-custom-nav">
        <view class="status-bar-spacer" :style="{ height: `${layout.statusBarHeightPx}px` }" />
        <view
          class="top-search-row flex items-center gap-space-sm pl-space-sm pr-space-sm"
          :style="{ height: `${customNavRowHeightPx}px`, ...mpCapsulePaddingStyle }"
        >
          <view class="top-search-inner flex flex-1 items-center gap-space-xs">
            <wd-icon name="search" size="28rpx" class="shrink-0 text-ink-lighter" />
            <input
              v-model="keyword"
              class="top-search-input min-w-0 flex-1 text-body-lg text-ink"
              type="text"
              placeholder="搜索当前区域商品"
              placeholder-class="top-search-placeholder"
              confirm-type="search"
              @confirm="onSearch"
            />
            <text
              v-if="keyword.length > 0"
              class="shrink-0 text-caption text-primary"
              hover-class="opacity-80"
              @click="onClear"
            >
              清空
            </text>
          </view>
          <!-- #ifndef MP-WEIXIN -->
          <view
            class="h5-addr-trigger max-w-[45%] flex shrink-0 items-center gap-space-xs"
            hover-class="opacity-80"
            @click="openTenantPopup"
          >
            <wd-icon name="location" size="28rpx" class="shrink-0 text-primary" />
            <text class="h5-addr-text text-body-lg text-ink">{{
              locationStore.locationDisplayName || '定位中...'
            }}</text>
            <wd-icon name="arrow-down" size="22rpx" class="shrink-0 text-ink-lighter" />
          </view>
          <!-- #endif -->
        </view>
      </view>

      <!-- 一级分类：单行横向 scroll，图标+名称同轨联动；「展开」在滚动区外右侧，不挡内容 -->
      <view class="level1-wrap border-b border-line">
        <view class="level1-bar-row">
          <scroll-view class="level1-unified-scroll" scroll-x :show-scrollbar="false" enable-flex>
            <view class="level1-scroll-strip">
              <view class="level1-icons-row">
                <view
                  v-for="cat in categories"
                  :key="`ic-${cat.catId}`"
                  class="level1-icon-cell"
                  hover-class="opacity-80"
                  :class="{ 'level1-icon-cell--active': cat.catId === activeLevel1Id }"
                  @click="onLevel1Change(cat.catId)"
                >
                  <view class="level1-icon-outer">
                    <image v-if="cat.icon" class="level1-icon-img" :src="cat.icon" mode="aspectFill" />
                    <view v-else class="level1-icon-placeholder" />
                  </view>
                </view>
              </view>
              <view class="level1-names-row">
                <view
                  v-for="cat in categories"
                  :key="`tx-${cat.catId}`"
                  class="level1-label-cell"
                  hover-class="opacity-80"
                  :class="{ 'level1-label-cell--active': cat.catId === activeLevel1Id }"
                  @click="onLevel1Change(cat.catId)"
                >
                  <text class="level1-label-inline text-micro text-ink">{{ cat.name }}</text>
                </view>
              </view>
            </view>
          </scroll-view>
          <view class="level1-expand-column" hover-class="opacity-80" @click.stop="onExpandLevel1">
            <view class="level1-expand-column__inner">
              <view class="level1-expand-text-vertical">
                <text class="level1-expand-char text-micro text-primary">展</text>
                <text class="level1-expand-char text-micro text-primary">开</text>
              </view>
              <wd-icon name="view-list" size="16px" class="level1-expand-icon shrink-0 text-primary" />
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="main-content">
      <view class="main-body-shell">
        <scroll-view v-if="level2List.length > 0" class="side-nav" scroll-y :show-scrollbar="false">
          <view
            v-for="sub in level2List"
            :key="sub.catId"
            class="side-item text-caption"
            hover-class="opacity-80"
            :class="{ 'side-item--active': sub.catId === activeLevel2Id }"
            @click="onLevel2Change(sub.catId)"
          >
            <text class="side-item-text">{{ sub.name }}</text>
          </view>
          <!-- 为最后一项选中时 ::after 反圆角预留滚动内容高度，避免被 scroll-view 裁切 -->
          <view class="side-nav-tail-spacer" aria-hidden="true" />
        </scroll-view>
        <view v-else class="side-nav side-nav--empty">
          <text class="px-space-sm text-caption text-ink-lighter">暂无子分类</text>
        </view>

        <view class="product-pane">
          <!-- 运营 Banner 占位 -->
          <view
            class="banner-slot mx-space-sm mt-space-sm rounded-card"
            hover-class="opacity-90"
            @click="onCategoryBannerClick"
          >
            <image v-if="categoryBannerSrc" class="banner-slot-image" :src="categoryBannerSrc" mode="aspectFill" />
            <text v-else class="banner-slot-text text-caption text-ink-lighter">活动运营位</text>
          </view>

          <!-- 排序占位（接口未接） -->
          <view class="sort-bar border-b border-line bg-surface">
            <view
              class="sort-item text-micro"
              :class="activeSort === 'sales' ? 'text-primary' : 'text-ink-light'"
              hover-class="opacity-80"
              @click="onSortTap('sales')"
            >
              销量
            </view>
            <view
              class="sort-item text-micro"
              :class="activeSort === 'discount' ? 'text-primary' : 'text-ink-light'"
              hover-class="opacity-80"
              @click="onSortTap('discount')"
            >
              折扣
            </view>
            <view
              class="sort-item flex items-center gap-space-xs text-micro"
              :class="activeSort === 'price' ? 'text-primary' : 'text-ink-light'"
              hover-class="opacity-80"
              @click="onSortTap('price')"
            >
              <text>价格</text>
              <text v-if="activeSort === 'price'" class="text-micro">{{ priceOrder === 'asc' ? '↑' : '↓' }}</text>
              <text v-else class="text-micro text-ink-lighter">⇅</text>
            </view>
          </view>

          <!-- 筛选占位 -->
          <scroll-view class="filter-scroll" scroll-x :show-scrollbar="false" enable-flex>
            <view class="filter-row">
              <view class="filter-chip filter-chip--active text-micro">全部</view>
            </view>
          </scroll-view>

          <scroll-view class="product-list" scroll-y :show-scrollbar="false">
            <view v-if="loading" class="skeleton-stack">
              <view v-for="n in 6" :key="n" class="skeleton-row skeleton-row--vertical">
                <view class="skeleton-img-square skeleton-pulse" />
                <view class="skeleton-footer">
                  <view class="skeleton-line skeleton-pulse w-80%" />
                  <view class="skeleton-line skeleton-pulse w-50%" />
                  <view class="skeleton-btn skeleton-pulse" />
                </view>
              </view>
            </view>
            <view v-else-if="productCards.length === 0" class="empty-tip text-body-lg text-ink-lighter">暂无商品</view>
            <view v-else class="product-rows">
              <CategoryProductCard
                v-for="item in productCards"
                :key="item.productId"
                :item="item"
                @detail="goCategoryProductDetail"
              />
            </view>
          </scroll-view>
        </view>
      </view>
    </view>

    <TenantSelector />
  </view>
</template>

<style lang="scss" scoped>
.category-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--color-bg-category-page);
}

/* #ifdef H5 */
/**
 * H5 上 `page-meta` / `disableScroll` 往往无法禁止 `uni-page-body` 整页滚动，顶栏会跟着滚走。
 * 根容器脱离文档流 + bottom 预留自定义 tabbar，与 `src/style/index.scss` 中 `--tabbar-total-height` 一致。
 */
.category-page {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: var(--tabbar-total-height);
  width: 100%;
  box-sizing: border-box;
  height: auto;
  max-height: none;
  min-height: 0;
}

/** H5 上 scroll-y 的 scroll-view 未获得确定高度时会撑开父级，间接触发整页滚动 */
.side-nav {
  min-height: 0;
  max-height: 100%;
}

/* #endif */

.category-header-gradient {
  flex-shrink: 0;
  background: linear-gradient(
    90deg,
    var(--color-category-header-gradient-start) 0%,
    var(--color-category-header-gradient-mid) 52%,
    var(--color-category-header-gradient-end) 100%
  );
}

.category-custom-nav {
  flex-shrink: 0;
  background-color: transparent;
}

.status-bar-spacer {
  width: 100%;
}

.top-search-row {
  box-sizing: border-box;
}

.top-search-inner {
  min-width: 0;
  height: 64rpx;
  padding: 0 var(--space-sm);
  border-radius: var(--radius-pill);
  /** 渐变顶栏上搜索条用白底，与参考图一致 */
  background-color: var(--color-bg-surface);
}

.top-search-input {
  height: 64rpx;
  line-height: 64rpx;
}

.h5-addr-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280rpx;
}

.level1-wrap {
  flex-shrink: 0;
  padding: 6rpx var(--space-xs) 8rpx var(--space-xs);
  background-color: transparent;
}

.level1-bar-row {
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: row;
  align-items: stretch;
}

.level1-unified-scroll {
  flex: 1;
  min-width: 0;
  width: 0;
  height: auto;
}

.level1-scroll-strip {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4rpx;
  padding-right: 4rpx;
}

.level1-icons-row {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
}

.level1-icon-cell {
  display: flex;
  width: 88rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.level1-icon-cell--active .level1-icon-outer {
  box-shadow: 0 0 0 2rpx var(--color-brand-primary);
}

.level1-names-row {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-sm);
}

.level1-label-cell {
  display: flex;
  width: 88rpx;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.level1-label-cell--active .level1-label-inline {
  color: var(--color-brand-primary);
  font-weight: 600;
}

.level1-label-inline {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  white-space: nowrap;
}

/**
 * 与横滑区分离；左侧投影与列表区分（不占滚动宽度）。
 * 文案竖排 + 下方列表图标，与设计稿一致。
 */
.level1-expand-column {
  position: relative;
  z-index: 1;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  align-self: stretch;
  justify-content: center;
  padding-left: 6rpx;
  padding-right: 2rpx;
  /** 朝左的柔和阴影，模拟「竖条」分隔 */
  box-shadow: -10rpx 0 24rpx -6rpx rgba(17, 17, 17, 0.08);
}

.level1-expand-column__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 4rpx 0;
}

.level1-expand-text-vertical {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.15;
}

.level1-expand-char {
  font-weight: 600;
}

.level1-expand-icon {
  opacity: 0.92;
}

.level1-icon-outer {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  overflow: hidden;
  background-color: var(--color-bg-category-page);
}

.level1-icon-img {
  width: 100%;
  height: 100%;
}

.level1-icon-placeholder {
  width: 100%;
  height: 100%;
  background-color: var(--color-border-default);
}

.main-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
}

/** 左侧导航 + 右侧内容一体卡片：仅上圆角，与页面灰底分离 */
.main-body-shell {
  $category-notch-r: 24rpx;

  --category-side-notch-r: #{$category-notch-r};
  --category-side-notch-r-neg: #{0rpx - $category-notch-r};

  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: stretch;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-top-left-radius: var(--radius-card);
  border-top-right-radius: var(--radius-card);
  background-color: var(--color-bg-surface);
  box-shadow: var(--shadow-card);
}

.side-nav {
  position: relative;
  z-index: 2;
  width: 176rpx;
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  /** 顶侧给首项 ::before 留高；底侧由 .side-nav-tail-spacer 撑开滚动高度 */
  background-color: var(--color-bg-category-page);
  /**
   * 不可 overflow:hidden：选中项白色 box-shadow 需向右盖住与主内容接缝（文档 Tab 是向下补白）。
   * scroll-view 默认仍会裁切，若真机阴影缺角再考虑改侧栏为非 scroll-view 或主区左侧垫色。
   */
}

.side-nav-tail-spacer {
  width: 100%;
  height: var(--category-side-notch-r);
}

.side-nav--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md) 0;
}

.side-item {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88rpx;
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text-secondary);
  border-left: 6rpx solid transparent;
  box-sizing: border-box;
  background-color: transparent;
}

/**
 * 侧栏选中态：对齐「tabs 圆角 + 反圆角」写法（伪元素 + border-radius + box-shadow）
 * 横向 Tab 文档：上圆角 + 底部左右灰条伪元素 + 白色 box-shadow 补角。
 * 竖向侧栏映射：右侧外凸圆角（朝主内容）+ 上下灰条伪元素（反圆角）+ 白色阴影向右补缝。
 * 参考：仓库外文档《实现tabs圆角及反圆角效果…》/ 掘金 juejin.cn/post/7224311569777934392
 */
.side-item--active {
  --side-notch-r: var(--category-side-notch-r);
  --side-notch-r-neg: var(--category-side-notch-r-neg);

  position: relative;
  z-index: 2;
  border-top-right-radius: var(--side-notch-r);
  border-bottom-right-radius: var(--side-notch-r);
  background-color: var(--color-bg-surface);
  color: var(--color-brand-primary);
  font-weight: 600;
  border-left-color: var(--color-brand-primary);
  /** 等价于 Tab 选中项的「双白块」阴影，映射为朝主内容方向（+x）一上一下两角补白 */
  box-shadow:
    var(--side-notch-r) var(--side-notch-r) 0 0 var(--color-bg-surface),
    var(--side-notch-r) var(--side-notch-r-neg) 0 0 var(--color-bg-surface);
}

/**
 * 对应 Tab 里 ::before：底侧单圆角灰条。
 * 竖向：贴在选中行**上方**，与**右侧**主内容齐平的反圆角 = 灰条 **右下角**内凹（border-bottom-right）
 */
.side-item--active::before {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: var(--side-notch-r);
  pointer-events: none;
  content: '';
  background-color: var(--color-bg-category-page);
  border-bottom-right-radius: var(--side-notch-r);
  transform: translateY(-100%);
}

/**
 * 对应 Tab 里 ::after：竖条底左侧圆角。
 * 竖向：贴在选中行**下方**，**右侧**反圆角 = 灰条 **右上角**内凹（border-top-right）
 */
.side-item--active::after {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--side-notch-r);
  pointer-events: none;
  content: '';
  background-color: var(--color-bg-category-page);
  border-top-right-radius: var(--side-notch-r);
  transform: translateY(100%);
}

.side-item-text {
  text-align: center;
  line-height: var(--lh-snug);
}

.product-pane {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background-color: var(--color-bg-surface);
}

.banner-slot {
  position: relative;
  overflow: hidden;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-surface);
  border: 1px dashed var(--color-border-default);
  box-sizing: border-box;
}

.banner-slot-image {
  width: 100%;
  height: 100%;
}

.sort-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  min-height: 0;
  padding: var(--space-xs) var(--space-sm);
  flex-shrink: 0;
}

.sort-item {
  padding: var(--space-xs);
}

.filter-scroll {
  flex-shrink: 0;
  width: 100%;
  white-space: nowrap;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-default);
}

.filter-row {
  display: inline-flex;
  align-items: center;
  padding: var(--space-xs) var(--space-sm);
  gap: var(--space-xs);
}

.filter-chip {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  background-color: var(--color-bg-category-page);
  color: var(--color-text-secondary);
  line-height: var(--lh-snug);
}

.filter-chip--active {
  background-color: var(--color-brand-light);
  color: var(--color-brand-primary);
  font-weight: 600;
}

.product-list {
  flex: 1;
  height: 0;
  padding: var(--space-sm);
  box-sizing: border-box;
}

.empty-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton-row {
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-bg-surface);
}

.skeleton-row--vertical {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.skeleton-img-square {
  width: 100%;
  padding-top: 100%;
  box-sizing: border-box;
}

.skeleton-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  box-sizing: border-box;
}

.skeleton-btn {
  height: 80rpx;
  border-radius: var(--radius-pill);
}

.skeleton-line {
  height: 28rpx;
  border-radius: var(--radius-sm);
}

.skeleton-pulse {
  background-color: var(--color-border-default);
  animation: sk-pulse 1.2s ease-in-out infinite;
}

@keyframes sk-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.55;
  }
}

.product-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
</style>

<!-- 小程序 input 的 placeholder-class 不携带 scoped 选择器，单独声明 -->
<style lang="scss">
.top-search-placeholder {
  color: var(--color-text-tertiary);
  font-size: var(--font-body-large);
}
</style>
