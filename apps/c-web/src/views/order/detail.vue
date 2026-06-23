<script setup lang="ts">
import type { OrderDetail } from '@libs/common-types';
import { cancelOrder, getOrderDetail } from '@/service/api/order';
import { completeWebPayment } from '@/hooks/use-checkout-pay';
import { formatOrderStatus, formatOrderTime } from '@/utils/order-status';
import { formatSpecLabel, formatYuan } from '@/utils/product-display';
import { toastError } from '@/utils/toast';

const route = useRoute();
const { apiClient } = useApi();

const orderId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const loading = ref(true);
const paying = ref(false);
const cancelling = ref(false);
const order = ref<OrderDetail | null>(null);

async function loadDetail() {
  if (!orderId.value) return;
  loading.value = true;
  try {
    order.value = await getOrderDetail(apiClient, orderId.value);
  } catch (error) {
    order.value = null;
    toastError(error, '加载订单失败');
  } finally {
    loading.value = false;
  }
}

async function onPay() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    await completeWebPayment(order.value.id);
  } catch (error) {
    toastError(error, '支付失败');
  } finally {
    paying.value = false;
  }
}

async function onCancel() {
  if (!order.value || cancelling.value) return;
  if (!window.confirm('确定取消该订单吗？')) return;
  cancelling.value = true;
  try {
    await cancelOrder(apiClient, order.value.id, '用户取消');
    await loadDetail();
  } catch (error) {
    toastError(error, '取消失败');
  } finally {
    cancelling.value = false;
  }
}

onMounted(() => {
  void loadDetail();
});
</script>

<template>
  <main class="order-detail">
    <p v-if="loading" class="order-detail__state">加载中…</p>
    <p v-else-if="!order" class="order-detail__state">订单不存在</p>

    <template v-else>
      <section class="order-detail__hero">
        <p class="order-detail__status">{{ formatOrderStatus(order.status) }}</p>
        <p class="order-detail__sn">订单号 {{ order.orderSn }}</p>
        <p class="order-detail__time">{{ formatOrderTime(order.createTime) }}</p>
      </section>

      <section v-if="order.receiverName" class="order-detail__card">
        <h2>收货信息</h2>
        <p>{{ order.receiverName }} {{ order.receiverPhone }}</p>
        <p class="order-detail__muted">{{ order.receiverAddress }}</p>
      </section>

      <section class="order-detail__card">
        <h2>商品清单</h2>
        <ul class="order-detail__goods">
          <li v-for="(item, index) in order.items" :key="`${item.skuId}-${index}`">
            <img :src="item.productImg" :alt="item.productName" />
            <div>
              <p class="order-detail__name">{{ item.productName }}</p>
              <p v-if="formatSpecLabel(item.specData)" class="order-detail__muted">
                {{ formatSpecLabel(item.specData) }}
              </p>
              <p class="order-detail__muted">¥{{ formatYuan(item.price) }} × {{ item.quantity }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="order-detail__card order-detail__amount">
        <div>
          <span>商品总额</span><span>¥{{ formatYuan(order.totalAmount) }}</span>
        </div>
        <div>
          <span>运费</span><span>¥{{ formatYuan(order.freightAmount) }}</span>
        </div>
        <div>
          <span>优惠</span><span>-¥{{ formatYuan(order.discountAmount) }}</span>
        </div>
        <div class="order-detail__pay">
          <span>实付</span><strong>¥{{ formatYuan(order.payAmount) }}</strong>
        </div>
      </section>

      <footer v-if="order.status === 'PENDING_PAY'" class="order-detail__bar">
        <button type="button" class="order-detail__ghost" :disabled="cancelling" @click="onCancel">
          {{ cancelling ? '取消中…' : '取消订单' }}
        </button>
        <button type="button" class="order-detail__primary" :disabled="paying" @click="onPay">
          {{ paying ? '支付中…' : '去支付' }}
        </button>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.order-detail {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 96px;
}

.order-detail__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.order-detail__hero {
  background: linear-gradient(135deg, #0d9488, #14b8a6);
  border-radius: 12px;
  color: #fff;
  margin-bottom: 12px;
  padding: 20px 16px;
}

.order-detail__status {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.order-detail__sn,
.order-detail__time {
  margin: 4px 0 0;
  opacity: 0.9;
}

.order-detail__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 12px;
  padding: 16px;
}

.order-detail__card h2 {
  font-size: 0.9375rem;
  margin: 0 0 12px;
}

.order-detail__muted {
  color: #64748b;
  font-size: 0.8125rem;
  margin: 4px 0 0;
}

.order-detail__goods {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.order-detail__goods li {
  display: grid;
  gap: 10px;
  grid-template-columns: 64px 1fr;
}

.order-detail__goods img {
  border-radius: 8px;
  height: 64px;
  object-fit: cover;
  width: 64px;
}

.order-detail__name {
  font-weight: 600;
  margin: 0;
}

.order-detail__amount div {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.order-detail__pay {
  border-top: 1px solid #e2e8f0;
  margin-top: 8px;
  padding-top: 12px;
}

.order-detail__pay strong {
  color: #dc2626;
}

.order-detail__bar {
  align-items: center;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  left: 0;
  padding: 10px 16px;
  position: fixed;
  right: 0;
  z-index: 15;
}

.order-detail__ghost,
.order-detail__primary {
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  padding: 12px 16px;
}

.order-detail__ghost {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #475569;
}

.order-detail__primary {
  background: #0d9488;
  border: none;
  color: #fff;
}

.order-detail__ghost:disabled,
.order-detail__primary:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
