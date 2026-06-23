<script setup lang="ts"></script>

<template>
  <main class="feature-page">
    <section class="feature-page__hero">
      <p class="feature-page__eyebrow">LBS</p>
      <h1>附近门店</h1>
      <p class="feature-page__lead">基于定位的门店列表与地图选点将在 Phase 5 接入 <code>/lbs/*</code> 接口。</p>
    </section>

    <section class="feature-page__card">
      <p class="feature-page__empty">暂无门店数据（占位页，需 L3 联调地图与租户门店配置）。</p>
    </section>
  </main>
</template>

<style scoped>
.feature-page {
  margin: 0 auto;
  max-width: 720px;
  padding: 16px;
}

.feature-page__hero {
  background: linear-gradient(135deg, #dbeafe, #f8fafc);
  border: 1px solid #bfdbfe;
  border-radius: 16px;
  margin-bottom: 16px;
  padding: 20px;
}

.feature-page__eyebrow {
  color: #1d4ed8;
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

.feature-page__lead code {
  font-size: 0.75rem;
}

.feature-page__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px 16px;
}

.feature-page__empty {
  color: #64748b;
  margin: 0;
  text-align: center;
}
</style>
