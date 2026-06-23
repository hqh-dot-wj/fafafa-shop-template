<script setup lang="ts">
const route = useRoute();
const router = useRouter();

const orderId = computed(() => (typeof route.query.orderId === 'string' ? route.query.orderId : ''));
const status = computed(() => (route.query.status === 'fail' ? 'fail' : 'success'));

function goHome() {
  void router.push('/');
}

function viewOrders() {
  void router.push('/order');
}
</script>

<template>
  <main class="pay-result">
    <div class="pay-result__icon" :data-status="status">
      {{ status === 'success' ? '✓' : '!' }}
    </div>
    <h1>{{ status === 'success' ? '支付成功' : '支付失败' }}</h1>
    <p v-if="orderId" class="pay-result__order">订单号：{{ orderId }}</p>
    <p class="pay-result__desc">
      {{ status === 'success' ? '订单已支付成功，我们将尽快为您处理。' : '支付遇到问题，请稍后重试。' }}
    </p>
    <div class="pay-result__actions">
      <button type="button" class="pay-result__primary" @click="viewOrders">查看我的</button>
      <button type="button" class="pay-result__ghost" @click="goHome">返回首页</button>
    </div>
  </main>
</template>

<style scoped>
.pay-result {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 70dvh;
  padding: 24px 16px;
  text-align: center;
}

.pay-result__icon {
  align-items: center;
  border-radius: 999px;
  display: flex;
  font-size: 2rem;
  font-weight: 700;
  height: 72px;
  justify-content: center;
  margin-bottom: 16px;
  width: 72px;
}

.pay-result__icon[data-status='success'] {
  background: #dcfce7;
  color: #15803d;
}

.pay-result__icon[data-status='fail'] {
  background: #fee2e2;
  color: #b91c1c;
}

.pay-result h1 {
  margin: 0 0 8px;
}

.pay-result__order {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0 0 8px;
}

.pay-result__desc {
  color: #64748b;
  margin: 0 0 24px;
}

.pay-result__actions {
  display: flex;
  gap: 12px;
}

.pay-result__primary,
.pay-result__ghost {
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 10px 16px;
}

.pay-result__primary {
  background: #0d9488;
  border: none;
  color: #fff;
}

.pay-result__ghost {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #334155;
}
</style>
