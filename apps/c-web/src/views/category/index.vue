<script setup lang="ts">
const {
  categories,
  activeLevel1Id,
  activeLevel2Id,
  level2List,
  keyword,
  products,
  loading,
  treeLoading,
  errorMessage,
  listCategoryId,
  loadCategories,
  selectLevel1,
  selectLevel2,
  searchProducts,
  clearKeyword,
} = useCategoryCatalog();

onMounted(() => {
  void loadCategories();
});
</script>

<template>
  <div class="category-page">
    <aside class="category-page__sidebar">
      <p v-if="treeLoading" class="category-page__hint">分类加载中…</p>
      <ul v-else class="category-page__level1">
        <li v-for="item in categories" :key="item.catId">
          <button
            type="button"
            class="category-page__level1-btn"
            :class="{ 'category-page__level1-btn--active': activeLevel1Id === item.catId }"
            @click="selectLevel1(item.catId)"
          >
            {{ item.name }}
          </button>
        </li>
      </ul>
    </aside>

    <section class="category-page__main">
      <form class="category-page__search" @submit.prevent="searchProducts">
        <input v-model="keyword" type="search" placeholder="搜索当前分类商品" />
        <button type="submit">搜索</button>
        <button v-if="keyword" type="button" class="category-page__clear" @click="clearKeyword">清空</button>
      </form>

      <div v-if="level2List.length > 0" class="category-page__level2">
        <button
          v-for="item in level2List"
          :key="item.catId"
          type="button"
          class="category-page__chip"
          :class="{ 'category-page__chip--active': activeLevel2Id === item.catId }"
          @click="selectLevel2(item.catId)"
        >
          {{ item.name }}
        </button>
      </div>

      <p v-if="errorMessage" class="category-page__state category-page__state--error">{{ errorMessage }}</p>
      <p v-else-if="!listCategoryId" class="category-page__state">当前分类无可浏览商品，请选择其他分类。</p>
      <p v-else-if="loading" class="category-page__state">商品加载中…</p>
      <p v-else-if="products.length === 0" class="category-page__state">该分类下暂无商品。</p>

      <div v-else class="category-page__grid">
        <ProductCard v-for="item in products" :key="item.productId" :product="item" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.category-page {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
  min-height: calc(100dvh - 120px);
}

.category-page__sidebar {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px;
}

.category-page__level1 {
  display: flex;
  gap: 8px;
  list-style: none;
  margin: 0;
  overflow-x: auto;
  padding: 0;
  scrollbar-width: thin;
}

.category-page__level1-btn {
  background: #f8fafc;
  border: 1px solid transparent;
  border-radius: 999px;
  color: #334155;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 0.8125rem;
  padding: 8px 14px;
  white-space: nowrap;
}

.category-page__level1-btn--active {
  background: #ecfdf5;
  border-color: #99f6e4;
  color: #0f766e;
  font-weight: 600;
}

.category-page__main {
  min-width: 0;
}

.category-page__search {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr auto auto;
  margin-bottom: 12px;
}

.category-page__search input {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  padding: 10px 12px;
}

.category-page__search button {
  background: #0d9488;
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0 14px;
}

.category-page__clear {
  background: #fff !important;
  border: 1px solid #e2e8f0 !important;
  color: #475569 !important;
}

.category-page__level2 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.category-page__chip {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 6px 12px;
}

.category-page__chip--active {
  background: #0d9488;
  border-color: #0d9488;
  color: #fff;
}

.category-page__grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.category-page__state {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
  padding: 32px 0;
  text-align: center;
}

.category-page__state--error {
  color: #b45309;
}

.category-page__hint {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
  padding: 12px;
}

@media (min-width: 768px) {
  .category-page {
    grid-template-columns: 180px 1fr;
  }

  .category-page__level1 {
    flex-direction: column;
    overflow: visible;
  }

  .category-page__level1-btn {
    border-radius: 10px;
    text-align: left;
    width: 100%;
  }

  .category-page__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
