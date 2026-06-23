<script setup lang="ts">
import type { OrderListItem } from '@libs/common-types';
import { getOrderList } from '@/service/api/order';
import { completeWebPayment } from '@/hooks/use-checkout-pay';
import { ORDER_STATUS_TABS, formatOrderStatus, formatOrderTime } from '@/utils/order-status';
import { formatYuan } from '@/utils/product-display';
import { toastError } from '@/utils/toast';

const route = useRoute();
const router = useRouter();
const { apiClient } = useApi();

const activeTab = ref(0);
const loading = ref(false);
const payingId = ref('');
const orders = ref<OrderListItem[]>([]);
const pageNum = ref(1);
const pageSize = 10;
const hasMore = ref(true);

function resolveInitialTab() {
  const raw = route.query.tab;
  if (typeof raw === 'string' && raw !== '') {
    const index = Number.parseInt(raw, 10);
    if (!Number.isNaN(index) && index >= 0 && index < ORDER_STATUS_TABS.length) {
      activeTab.value = index;
    }
  }
}

async function loadOrders(refresh = true) {
  if (loading.value) return;
  if (refresh) {
    pageNum.value = 1;
    hasMore.value = true;
  }
  if (!hasMore.value) return;

  loading.value = true;
  try {
    const status = ORDER_STATUS_TABS[activeTab.value]?.value ?? '';
    const result = await getOrderList(apiClient, {
      pageNum: pageNum.value,
      pageSize,
      ...(status ? { status } : {}),
    });
    const rows = result.rows ?? [];
    if (refresh) {
      orders.value = rows;
    } else {
      orders.value.push(...rows);
    }
    hasMore.value = rows.length >= pageSize;
    if (hasMore.value) pageNum.value += 1;
  } catch (error) {
    toastError(error, '加载订单失败');
  } finally {
    loading.value = false;
  }
}

function switchTab(index: number) {
  if (activeTab.value === index) return;
  activeTab.value = index;
  void loadOrders(true);
}

async function onPay(orderId: string) {
  if (payingId.value) return;
  payingId.value = orderId;
  try {
    await completeWebPayment(orderId);
  } catch (error) {
    toastError(error, '支付失败');
  } finally {
    payingId.value = '';
  }
}

function goDetail(orderId: string) {
  void router.push(`/order/${orderId}`);
}

onMounted(() => {
  resolveInitialTab();
  void loadOrders(true);
});
</script>

<template>
  <main class="order-list">
    <nav class="order-list__tabs">
      <button
        v-for="(tab, index) in ORDER_STATUS_TABS"
        :key="tab.label"
        type="button"
        class="order-list__tab"
        :data-active="activeTab === index"
        @click="switchTab(index)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <p v-if="loading && orders.length === 0" class="order-list__state">加载中…</p>
    <p v-else-if="!loading && orders.length === 0" class="order-list__state">暂无订单</p>

    <ul v-else class="order-list__items">
      <li v-for="order in orders" :key="order.id" class="order-list__card" @click="goDetail(order.id)">
        <header>
          <span class="order-list__sn">{{ order.orderSn }}</span>
          <span class="order-list__status">{{ formatOrderStatus(order.status) }}</span>
        </header>
        <div class="order-list__body">
          <img v-if="order.coverImage" :src="order.coverImage" :alt="order.productName" />
          <div>
            <p class="order-list__name">{{ order.productName || '商品' }}</p>
            <p class="order-list__meta">{{ formatOrderTime(order.createTime) }} · 共 {{ order.itemCount }} 件</p>
          </div>
        </div>
        <footer>
          <span>实付 <strong>¥{{ formatYuan(order.payAmount) }}</strong></span>
          <button
            v-if="order.status === 'PENDING_PAY'"
            type="button"
            class="order-list__pay"
            :disabled="payingId === order.id"
            @click.stop="onPay(order.id)"
          >
            {{ payingId === order.id ? '支付中…' : '去支付' }}
          </button>
        </footer>
      </li>
    </ul>

    <button
      v-if="hasMore && orders.length > 0"
      type="button"
      class="order-list__more"
      :disabled="loading"
      @click="loadOrders(false)"
    >
      {{ loading ? '加载中…' : '加载更多' }}
    </button>
  </main>
</template>

<style scoped>
.order-list {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 24px;
}

.order-list__tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  overflow-x: auto;
}

.order-list__tab {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  cursor: pointer;
  flex-shrink: 0;
  font-size: 0.8125rem;
  padding: 8px 14px;
}

.order-list__tab[data-active='true'] {
  background: #0d9488;
  border-color: #0d9488;
  color: #fff;
}

.order-list__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.order-list__items {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.order-list__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  padding: 14px;
}

.order-list__card header,
.order-list__card footer {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.order-list__sn {
  color: #64748b;
  font-size: 0.75rem;
}

.order-list__status {
  color: #0d9488;
  font-size: 0.8125rem;
}

.order-list__body {
  display: grid;
  gap: 10px;
  grid-template-columns: 64px 1fr;
  margin: 12px 0;
}

.order-list__body img {
  border-radius: 8px;
  height: 64px;
  object-fit: cover;
  width: 64px;
}

.order-list__name {
  font-weight: 600;
  margin: 0;
}

.order-list__meta {
  color: #64748b;
  font-size: 0.75rem;
  margin: 4px 0 0;
}

.order-list__card footer strong {
  color: #dc2626;
}

.order-list__pay {
  background: #0d9488;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 0.8125rem;
  padding: 6px 12px;
}

.order-list__pay:disabled {
  opacity: 0.6;
}

.order-list__more {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #475569;
  cursor: pointer;
  display: block;
  margin: 16px auto 0;
  padding: 10px 20px;
}
</style>
