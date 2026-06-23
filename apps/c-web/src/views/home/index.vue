<script setup lang="ts">
import type { ClientProduct } from '@libs/common-types';
import { getProductList } from '@/service/api/product';

const { apiClient } = useApi();
const { features } = useFeatureNav();
const shopBranding = useShopBrandingStore();

const products = ref<ClientProduct[]>([]);
const loading = ref(true);
const errorMessage = ref('');

async function loadHomeProducts() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await getProductList(apiClient, { pageNum: 1, pageSize: 12 });
    products.value = result?.rows ?? [];
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '商品加载失败';
    products.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadHomeProducts();
});
</script>

<template>
  <main class="home">
    <section class="home__banner">
      <p class="home__eyebrow">{{ shopBranding.companyName }}</p>
      <h1>精选好物</h1>
      <p class="home__lead">数据来自 <code>/client/product/list</code>，与后端同源接口。</p>
    </section>

    <section v-if="features.o2o" class="home__o2o">
      <RouterLink class="home__o2o-card" to="/service">
        <div>
          <p class="home__o2o-eyebrow">上门服务</p>
          <h2>预约到家 · 丰富生活</h2>
          <p class="home__o2o-desc">浏览服务类商品，支持预约下单</p>
        </div>
        <span class="home__o2o-arrow" aria-hidden="true">›</span>
      </RouterLink>
    </section>

    <section class="home__section">
      <div class="home__section-head">
        <h2>推荐商品</h2>
        <RouterLink class="home__more" to="/category">全部分类</RouterLink>
      </div>

      <p v-if="loading" class="home__state">加载中…</p>
      <p v-else-if="errorMessage" class="home__state home__state--error">{{ errorMessage }}</p>
      <p v-else-if="products.length === 0" class="home__state">暂无商品，请确认后端已上架数据。</p>

      <div v-else class="home__grid">
        <ProductCard v-for="item in products" :key="item.productId" :product="item" />
      </div>
    </section>
  </main>
</template>

<style scoped>
.home {
  margin: 0 auto;
  max-width: 1080px;
  padding: 16px;
}

.home__banner {
  background: linear-gradient(135deg, #ecfdf5, #f8fafc);
  border: 1px solid #d1fae5;
  border-radius: 16px;
  margin-bottom: 20px;
  padding: 20px;
}

.home__eyebrow {
  color: #0d9488;
  font-size: 0.8125rem;
  margin: 0 0 6px;
}

.home h1 {
  font-size: clamp(1.375rem, 3vw, 1.75rem);
  margin: 0 0 8px;
}

.home__lead {
  color: #475569;
  font-size: 0.875rem;
  margin: 0;
}

.home__lead code {
  font-size: 0.75rem;
}

.home__o2o {
  margin-bottom: 20px;
}

.home__o2o-card {
  align-items: center;
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
  border: 1px solid #fde68a;
  border-radius: 16px;
  color: inherit;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 16px 20px;
  text-decoration: none;
}

.home__o2o-eyebrow {
  color: #b45309;
  font-size: 0.75rem;
  margin: 0 0 4px;
}

.home__o2o-card h2 {
  font-size: 1.0625rem;
  margin: 0 0 4px;
}

.home__o2o-desc {
  color: #78716c;
  font-size: 0.8125rem;
  margin: 0;
}

.home__o2o-arrow {
  color: #b45309;
  font-size: 1.5rem;
}

.home__section-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.home__section h2 {
  font-size: 1.0625rem;
  margin: 0;
}

.home__more {
  color: #0d9488;
  font-size: 0.875rem;
  text-decoration: none;
}

.home__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.home__state {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
  padding: 24px 0;
  text-align: center;
}

.home__state--error {
  color: #b45309;
}

@media (min-width: 768px) {
  .home__grid {
    gap: 16px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .home__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
