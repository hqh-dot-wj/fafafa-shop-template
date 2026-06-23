<script lang="ts" setup>
import type { SeniorProductCardModel } from '@/components/product-card/product-card.types';
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app';
import { computed, ref } from 'vue';
import { getSceneModules } from '@/api/marketing';
import { getProductList } from '@/api/product';
import { mapClientProductToSeniorCard, mapSceneProductToSeniorCard } from '@/components/product-card/product-card.mapper';
import SeniorProductCard from '@/components/product-card/senior-product-card.vue';

definePage({
  style: {
    navigationBarTitleText: '商品列表',
  },
});

const sourceType = ref<'CATEGORY' | 'SCENE'>('CATEGORY');
const categoryId = ref<number | null>(null);
const sceneCode = ref<string>('');
const pageTitle = ref<string>('商品列表');
const activityTypeFilter = ref<string>('');

const loading = ref(false);
const loadingMore = ref(false);
const loadError = ref('');
const rows = ref<SeniorProductCardModel[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = 20;

const isEmpty = computed(() => !loading.value && rows.value.length === 0);
const hasMore = computed(() => rows.value.length < total.value);

onLoad(options => {
  sourceType.value = parseSourceType(options?.sourceType);
  categoryId.value = parseNumber(options?.categoryId);
  sceneCode.value = typeof options?.sceneCode === 'string' ? options.sceneCode : '';
  pageTitle.value = typeof options?.title === 'string' && options.title.trim() ? options.title.trim() : '商品列表';
  activityTypeFilter.value = typeof options?.activityType === 'string' ? options.activityType : '';
  uni.setNavigationBarTitle({ title: pageTitle.value });
  void loadRows(true);
});

onPullDownRefresh(() => {
  void loadRows(true).finally(() => uni.stopPullDownRefresh());
});

onReachBottom(() => {
  if (!hasMore.value || loadingMore.value || sourceType.value === 'SCENE') return;
  void loadRows(false);
});

async function loadRows(reset: boolean) {
  if (sourceType.value === 'CATEGORY' && !categoryId.value) {
    loadError.value = '缺少分类参数';
    return;
  }
  if (sourceType.value === 'SCENE' && !sceneCode.value) {
    loadError.value = '缺少场景参数';
    return;
  }

  if (reset) {
    loading.value = true;
    loadError.value = '';
    pageNum.value = 1;
  } else {
    loadingMore.value = true;
  }

  try {
    if (sourceType.value === 'CATEGORY') {
      const result = await getProductList({
        categoryId: categoryId.value!,
        pageNum: pageNum.value,
        pageSize,
      });
      const mapped = (result?.rows || []).map(product =>
        mapClientProductToSeniorCard(product, {
          variant: 'list',
          entrySource: 'category_list',
        }),
      );
      rows.value = reset ? mapped : [...rows.value, ...mapped];
      total.value = Number(result?.total || mapped.length);
      if (mapped.length > 0) pageNum.value += 1;
      return;
    }

    const scene = await getSceneModules(sceneCode.value, {
      channel: 'MINIAPP',
      moduleLimit: 10,
      productLimit: 50,
    });
    const mapped = (scene?.modules || [])
      .flatMap(module =>
        (module.products || []).map(product =>
          mapSceneProductToSeniorCard(product, {
            variant: 'list',
            moduleName: module.moduleName,
            sceneCode: sceneCode.value,
            moduleCode: module.moduleCode,
            entrySource: 'scene',
          }),
        ),
      )
      .filter((item): item is SeniorProductCardModel => Boolean(item))
      .filter(item => {
        if (!activityTypeFilter.value) return true;
        return String(item.activityType || '').toUpperCase() === activityTypeFilter.value.toUpperCase();
      });
    rows.value = mapped;
    total.value = mapped.length;
  } catch (error) {
    loadError.value = '商品列表加载失败，请稍后重试';
    if (reset) rows.value = [];
    console.error('load product list failed', error);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function goDetail(item: SeniorProductCardModel) {
  const query: Record<string, string> = { id: item.productId };
  if (item.activityContextKey) query.activityContextKey = item.activityContextKey;
  if (item.entrySceneCode) query.entrySceneCode = item.entrySceneCode;
  if (item.entryModuleCode) query.entryModuleCode = item.entryModuleCode;
  if (item.entrySource) query.entrySource = item.entrySource;
  const qs = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  uni.navigateTo({ url: `/pages/product/detail?${qs}` });
}

function parseSourceType(value: unknown): 'CATEGORY' | 'SCENE' {
  return typeof value === 'string' && value.toUpperCase() === 'SCENE' ? 'SCENE' : 'CATEGORY';
}

function parseNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
</script>

<template>
  <view class="product-list-page">
    <view v-if="loadError" class="product-list-page__error">{{ loadError }}</view>
    <view v-if="loading" class="product-list-page__loading">
      <wd-loading />
    </view>

    <view v-else-if="isEmpty" class="product-list-page__empty">暂无商品</view>

    <scroll-view v-else class="product-list-page__scroll" scroll-y>
      <view class="product-list-page__list">
        <SeniorProductCard v-for="item in rows" :key="item.productId" :item="item" variant="list" @detail="goDetail" />
        <view v-if="loadingMore" class="product-list-page__more">加载中...</view>
        <view v-else-if="!hasMore" class="product-list-page__more product-list-page__more--end">没有更多了</view>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
.product-list-page {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

.product-list-page__error {
  text-align: center;
  padding: 20rpx;
  color: #cf1322;
  font-size: 24rpx;
}

.product-list-page__loading,
.product-list-page__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 28rpx;
}

.product-list-page__scroll {
  flex: 1;
  min-height: 0;
}

.product-list-page__list {
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.product-list-page__more {
  text-align: center;
  color: #999;
  font-size: 22rpx;
  padding: 10rpx 0 20rpx;
}

.product-list-page__more--end {
  color: #bbb;
}
</style>
