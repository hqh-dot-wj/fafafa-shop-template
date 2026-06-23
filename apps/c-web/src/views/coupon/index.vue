<script setup lang="ts">
import { getMyCoupons } from '@/service/api/coupon';
import { toastError } from '@/utils/toast';

const { apiClient } = useApi();

const COUPON_TABS = [
  { label: '未使用', value: 'UNUSED' },
  { label: '已使用', value: 'USED' },
  { label: '已过期', value: 'EXPIRED' },
] as const;

const activeTab = ref(0);
const loading = ref(false);
const coupons = ref<Record<string, unknown>[]>([]);

function couponTitle(row: Record<string, unknown>): string {
  const template = row.template as Record<string, unknown> | undefined;
  const name = template?.name ?? row.name ?? row.templateName;
  return typeof name === 'string' && name ? name : '优惠券';
}

function couponDiscount(row: Record<string, unknown>): string {
  const template = row.template as Record<string, unknown> | undefined;
  const type = template?.type ?? row.type;
  const value = template?.discountValue ?? row.discountValue ?? template?.value;
  if (type === 'PERCENT' || type === 'DISCOUNT') {
    return typeof value === 'number' ? `${value / 10}折` : '折扣券';
  }
  if (typeof value === 'number') return `¥${(value / 100).toFixed(2)}`;
  return '';
}

function couponExpire(row: Record<string, unknown>): string {
  const end = row.endTime ?? row.expireTime ?? (row.template as Record<string, unknown> | undefined)?.endTime;
  if (typeof end === 'string') {
    const date = new Date(end);
    if (!Number.isNaN(date.getTime())) {
      return `有效期至 ${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
    return end;
  }
  return '';
}

async function loadCoupons() {
  loading.value = true;
  try {
    const status = COUPON_TABS[activeTab.value]?.value ?? 'UNUSED';
    const result = await getMyCoupons(apiClient, { status, pageNum: 1, pageSize: 50 });
    coupons.value = result.rows ?? [];
  } catch (error) {
    coupons.value = [];
    toastError(error, '加载优惠券失败');
  } finally {
    loading.value = false;
  }
}

function switchTab(index: number) {
  if (activeTab.value === index) return;
  activeTab.value = index;
  void loadCoupons();
}

onMounted(() => {
  void loadCoupons();
});
</script>

<template>
  <main class="coupon-list">
    <nav class="coupon-list__tabs">
      <button
        v-for="(tab, index) in COUPON_TABS"
        :key="tab.value"
        type="button"
        class="coupon-list__tab"
        :data-active="activeTab === index"
        @click="switchTab(index)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <p v-if="loading" class="coupon-list__state">加载中…</p>
    <p v-else-if="coupons.length === 0" class="coupon-list__state">暂无优惠券</p>

    <ul v-else class="coupon-list__items">
      <li v-for="(item, index) in coupons" :key="String(item.id ?? index)" class="coupon-list__card">
        <div class="coupon-list__value">{{ couponDiscount(item) }}</div>
        <div>
          <p class="coupon-list__title">{{ couponTitle(item) }}</p>
          <p v-if="couponExpire(item)" class="coupon-list__expire">{{ couponExpire(item) }}</p>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.coupon-list {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 24px;
}

.coupon-list__tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.coupon-list__tab {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  color: #475569;
  cursor: pointer;
  flex: 1;
  font-size: 0.8125rem;
  padding: 8px 10px;
}

.coupon-list__tab[data-active='true'] {
  background: #0d9488;
  border-color: #0d9488;
  color: #fff;
}

.coupon-list__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.coupon-list__items {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.coupon-list__card {
  align-items: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: 80px 1fr;
  padding: 14px;
}

.coupon-list__value {
  color: #dc2626;
  font-size: 1.125rem;
  font-weight: 700;
  text-align: center;
}

.coupon-list__title {
  font-weight: 600;
  margin: 0;
}

.coupon-list__expire {
  color: #64748b;
  font-size: 0.75rem;
  margin: 4px 0 0;
}
</style>
