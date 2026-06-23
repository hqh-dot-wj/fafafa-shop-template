<script setup lang="ts"></script>

<template>
  <main class="feature-page">
    <section class="feature-page__hero">
      <p class="feature-page__eyebrow">分销</p>
      <h1>分销中心</h1>
      <p class="feature-page__lead">推广商品、团队与佣金明细将对接 <code>/client/distribution/*</code>（Phase 5）。</p>
    </section>

    <section class="feature-page__card">
      <h2>规划能力</h2>
      <ul>
        <li>分销商品推荐与分享海报</li>
        <li>佣金预览与待结算奖励</li>
        <li>团长资质与团队管理</li>
      </ul>
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
  background: linear-gradient(135deg, #fce7f3, #f8fafc);
  border: 1px solid #fbcfe8;
  border-radius: 16px;
  margin-bottom: 16px;
  padding: 20px;
}

.feature-page__eyebrow {
  color: #be185d;
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
</style>
