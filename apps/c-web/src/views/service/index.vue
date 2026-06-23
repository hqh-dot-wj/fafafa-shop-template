<script setup lang="ts">
const { features } = useFeatureNav();
</script>

<template>
  <main class="feature-page">
    <section class="feature-page__hero">
      <p class="feature-page__eyebrow">O2O</p>
      <h1>上门服务</h1>
      <p class="feature-page__lead">预约到家 · 丰富生活。完整预约流程将在多模板 Phase 5 落地。</p>
    </section>

    <section class="feature-page__card">
      <h2>当前能力</h2>
      <ul>
        <li>商品详情支持服务类 SKU（与商城共用接口）</li>
        <li>结算页可扩展预约时间选择（miniapp 已对齐）</li>
      </ul>
      <p v-if="features.lbs" class="feature-page__hint">
        LBS 已开启，可前往
        <RouterLink to="/stores">附近门店</RouterLink>
      </p>
    </section>

    <RouterLink class="feature-page__link" to="/category">浏览全部商品</RouterLink>
  </main>
</template>

<style scoped>
.feature-page {
  margin: 0 auto;
  max-width: 720px;
  padding: 16px;
}

.feature-page__hero {
  background: linear-gradient(135deg, #fef3c7, #f8fafc);
  border: 1px solid #fde68a;
  border-radius: 16px;
  margin-bottom: 16px;
  padding: 20px;
}

.feature-page__eyebrow {
  color: #b45309;
  font-size: 0.8125rem;
  margin: 0 0 6px;
}

.feature-page h1 {
  margin: 0 0 8px;
}

.feature-page__lead {
  color: #475569;
  font-size: 0.875rem;
  margin: 0;
}

.feature-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
  padding: 16px;
}

.feature-page__card h2 {
  font-size: 0.9375rem;
  margin: 0 0 12px;
}

.feature-page__card ul {
  color: #475569;
  font-size: 0.875rem;
  margin: 0;
  padding-left: 1.25rem;
}

.feature-page__hint {
  color: #64748b;
  font-size: 0.8125rem;
  margin: 12px 0 0;
}

.feature-page__hint a {
  color: #0d9488;
}

.feature-page__link {
  color: #0d9488;
  display: inline-block;
  font-size: 0.875rem;
  text-decoration: none;
}
</style>
