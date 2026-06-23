<script setup lang="ts"></script>

<template>
  <main class="feature-page">
    <section class="feature-page__hero">
      <p class="feature-page__eyebrow">钱包</p>
      <h1>我的钱包</h1>
      <p class="feature-page__lead">余额、提现与流水将对接会员钱包接口（Phase 5）。</p>
    </section>

    <section class="feature-page__card">
      <p class="feature-page__balance">¥ --</p>
      <p class="feature-page__hint">占位页：需租户开启钱包能力后联调。</p>
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
  background: linear-gradient(135deg, #ecfdf5, #f8fafc);
  border: 1px solid #a7f3d0;
  border-radius: 16px;
  margin-bottom: 16px;
  padding: 20px;
}

.feature-page__eyebrow {
  color: #0d9488;
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
  padding: 24px 16px;
  text-align: center;
}

.feature-page__balance {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.feature-page__hint {
  color: #64748b;
  font-size: 0.8125rem;
  margin: 0;
}
</style>
