<script setup lang="ts">
import type { ClientProductDetail } from '@libs/common-types';
import { getProductDetail } from '@/service/api/product';
import {
  formatSpecLabel,
  formatYuan,
  resolveProductImage,
  resolveProductOriginalPrice,
  resolveProductSalePrice,
  type ProductDetailSku,
} from '@/utils/product-display';
import { toastMessage, toastSuccess } from '@/utils/toast';

const route = useRoute();
const router = useRouter();
const { apiClient } = useApi();
const tokenStore = useTokenStore();
const cartStore = useCartStore();
const tenantId = useTenantId();

const product = ref<ClientProductDetail | null>(null);
const selectedSku = ref<ProductDetailSku | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const actionLoading = ref(false);

const productId = computed(() => String(route.params.id || ''));
const activityContextKey = computed(() => {
  const raw = route.query.activityContextKey;
  return typeof raw === 'string' ? raw : undefined;
});

const salePrice = computed(() => resolveProductSalePrice(product.value));
const originalPrice = computed(() => resolveProductOriginalPrice(product.value, salePrice.value));
const heroImage = computed(() => resolveProductImage(product.value));
const galleryImages = computed(() => {
  const images = product.value?.mainImages?.filter((item) => item?.trim()) ?? [];
  if (images.length > 0) return images;
  const cover = product.value?.coverImage?.trim();
  return cover ? [cover] : [heroImage.value];
});

async function loadDetail() {
  if (!productId.value) {
    errorMessage.value = '无效的商品 ID';
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getProductDetail(apiClient, productId.value, activityContextKey.value);
    product.value = result;
    selectedSku.value = result.skus?.[0] ?? null;
  } catch (error) {
    product.value = null;
    selectedSku.value = null;
    errorMessage.value = error instanceof Error ? error.message : '商品加载失败';
  } finally {
    loading.value = false;
  }
}

function selectSku(sku: ProductDetailSku) {
  selectedSku.value = sku;
}

function ensureLogin(next: () => void): boolean {
  if (tokenStore.hasLogin) {
    next();
    return true;
  }
  void router.push({ path: '/login', query: { redirect: route.fullPath } });
  return false;
}

async function addToCart() {
  if (!selectedSku.value) {
    toastMessage('请选择规格');
    return;
  }
  ensureLogin(async () => {
    actionLoading.value = true;
    try {
      const activityKey = product.value?.mainActivity?.activityContextKey;
      const ok = await cartStore.addToCart(
        selectedSku.value!.skuId,
        1,
        activityKey
          ? {
              activityContextKey: activityKey,
              entrySource: 'product_detail',
            }
          : undefined,
      );
      if (ok) toastSuccess('已加入购物车');
    } finally {
      actionLoading.value = false;
    }
  });
}

function buyNow() {
  if (!selectedSku.value) {
    toastMessage('请选择规格');
    return;
  }
  ensureLogin(() => {
    const query: Record<string, string> = {
      mode: 'direct',
      skuId: selectedSku.value!.skuId,
      tenantId,
      quantity: '1',
    };
    const activityKey = product.value?.mainActivity?.activityContextKey;
    if (activityKey) query.activityContextKey = activityKey;
    void router.push({ path: '/order/create', query });
  });
}

watch([productId, activityContextKey], () => {
  void loadDetail();
});

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <main class="detail">
    <p v-if="loading" class="detail__state">加载中…</p>
    <p v-else-if="errorMessage" class="detail__state detail__state--error">{{ errorMessage }}</p>

    <template v-else-if="product">
      <section class="detail__gallery">
        <img class="detail__hero" :src="heroImage" :alt="product.name" />
        <div v-if="galleryImages.length > 1" class="detail__thumbs">
          <img
            v-for="(image, index) in galleryImages"
            :key="`${image}-${index}`"
            :src="image"
            :alt="`${product.name} ${index + 1}`"
          />
        </div>
      </section>

      <section class="detail__summary">
        <h1>{{ product.name }}</h1>
        <p v-if="product.subTitle" class="detail__subtitle">{{ product.subTitle }}</p>
        <div class="detail__price">
          <span class="detail__price-current">¥{{ formatYuan(salePrice) }}</span>
          <span v-if="originalPrice" class="detail__price-original">¥{{ formatYuan(originalPrice) }}</span>
          <span v-if="product.mainActivitySummary?.tagLabel" class="detail__tag">
            {{ product.mainActivitySummary.tagLabel }}
          </span>
        </div>
        <p v-if="product.categoryName" class="detail__meta">分类：{{ product.categoryName }}</p>
      </section>

      <section v-if="product.skus?.length" class="detail__skus">
        <h2>规格</h2>
        <div class="detail__sku-list">
          <button
            v-for="sku in product.skus"
            :key="sku.skuId"
            type="button"
            class="detail__sku"
            :class="{ 'detail__sku--active': selectedSku?.skuId === sku.skuId }"
            @click="selectSku(sku)"
          >
            {{ formatSpecLabel(sku.specValues) }}
          </button>
        </div>
      </section>

      <section v-if="product.detailHtml" class="detail__content">
        <h2>商品详情</h2>
        <!-- 详情 HTML 由后台富文本产出，与 miniapp 一致直接渲染 -->
        <div class="detail__html" v-html="product.detailHtml" />
      </section>

      <footer class="detail__actions">
        <button type="button" class="detail__action detail__action--ghost" :disabled="actionLoading" @click="addToCart">
          加入购物车
        </button>
        <button type="button" class="detail__action" :disabled="actionLoading" @click="buyNow">立即购买</button>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.detail {
  margin: 0 auto;
  max-width: 960px;
  padding: 0 0 88px;
}

.detail__state {
  color: #64748b;
  padding: 48px 16px;
  text-align: center;
}

.detail__state--error {
  color: #b45309;
}

.detail__gallery {
  background: #fff;
}

.detail__hero {
  aspect-ratio: 1;
  background: #f8fafc;
  object-fit: cover;
  width: 100%;
}

.detail__thumbs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 12px 16px;
}

.detail__thumbs img {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  height: 56px;
  object-fit: cover;
  width: 56px;
}

.detail__summary,
.detail__skus,
.detail__content {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  margin-top: 8px;
  padding: 16px;
}

.detail__summary h1 {
  font-size: 1.25rem;
  margin: 0 0 8px;
}

.detail__subtitle {
  color: #64748b;
  margin: 0 0 12px;
}

.detail__price {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail__price-current {
  color: #dc2626;
  font-size: 1.5rem;
  font-weight: 700;
}

.detail__price-original {
  color: #94a3b8;
  text-decoration: line-through;
}

.detail__tag {
  background: #fef2f2;
  border-radius: 999px;
  color: #dc2626;
  font-size: 0.75rem;
  padding: 2px 8px;
}

.detail__meta {
  color: #64748b;
  font-size: 0.8125rem;
  margin: 12px 0 0;
}

.detail__skus h2,
.detail__content h2 {
  font-size: 0.9375rem;
  margin: 0 0 12px;
}

.detail__sku-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail__sku {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #334155;
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 8px 12px;
}

.detail__sku--active {
  background: #ecfdf5;
  border-color: #0d9488;
  color: #0f766e;
}

.detail__html :deep(img) {
  height: auto;
  max-width: 100%;
}

.detail__actions {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr;
  left: 0;
  padding: 10px 16px;
  position: fixed;
  right: 0;
  z-index: 15;
}

.detail__action {
  background: #0d9488;
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  padding: 12px;
}

.detail__action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.detail__action--ghost {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

@media (min-width: 768px) {
  .detail {
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(280px, 420px) 1fr;
    padding: 16px 16px 24px;
  }

  .detail__gallery,
  .detail__summary,
  .detail__skus,
  .detail__content {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-top: 0;
  }

  .detail__gallery {
    grid-row: span 3;
  }

  .detail__actions {
    border-radius: 12px;
    margin-top: 0;
    position: static;
  }
}
</style>
