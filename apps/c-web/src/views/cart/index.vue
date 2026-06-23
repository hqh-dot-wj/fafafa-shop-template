<script setup lang="ts">
import type { CartItem } from '@/stores/cart';
import { formatSpecLabel, formatYuan } from '@/utils/product-display';
import { toastMessage } from '@/utils/toast';

function readActivityKey(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

const tokenStore = useTokenStore();
const cartStore = useCartStore();
const router = useRouter();

const quantityDraft = ref<Record<string, number>>({});

onMounted(() => {
  if (tokenStore.hasLogin) {
    void cartStore.fetchCartList();
  }
});

watch(
  () => cartStore.items,
  (rows) => {
    const next: Record<string, number> = {};
    rows.forEach((item) => {
      next[item.id] = item.quantity;
    });
    quantityDraft.value = next;
  },
  { immediate: true },
);

function specText(item: CartItem): string {
  return formatSpecLabel(item.specData as Record<string, unknown> | undefined);
}

function activityKey(item: CartItem): string | null {
  return readActivityKey(item.activityContextKey);
}

async function onQuantityBlur(item: CartItem) {
  const next = quantityDraft.value[item.id] ?? item.quantity;
  if (!Number.isFinite(next) || next < 1) {
    quantityDraft.value[item.id] = item.quantity;
    return;
  }
  if (next === item.quantity) return;
  await cartStore.updateQuantity(item.skuId, next, activityKey(item));
}

async function removeLine(item: CartItem) {
  if (!window.confirm('确定删除该商品吗？')) return;
  await cartStore.removeItem(item.id);
}

function goCheckout() {
  if (cartStore.selectedItems.length === 0) {
    toastMessage('请先选择商品');
    return;
  }
  void router.push('/order/create');
}

function goLogin() {
  void router.push({ path: '/login', query: { redirect: '/cart' } });
}
</script>

<template>
  <main class="cart-page">
    <template v-if="!tokenStore.hasLogin">
      <p class="cart-page__state">登录后可查看购物车</p>
      <button type="button" class="cart-page__primary" @click="goLogin">去登录</button>
    </template>

    <template v-else-if="cartStore.loading && cartStore.items.length === 0">
      <p class="cart-page__state">加载中…</p>
    </template>

    <template v-else-if="cartStore.listLoadError && cartStore.items.length === 0">
      <p class="cart-page__state cart-page__state--error">购物车加载失败</p>
      <button type="button" class="cart-page__ghost" @click="cartStore.fetchCartList()">重试</button>
    </template>

    <template v-else-if="cartStore.items.length === 0 && cartStore.invalidItems.length === 0">
      <p class="cart-page__state">购物车是空的</p>
      <RouterLink class="cart-page__ghost" to="/">去逛逛</RouterLink>
    </template>

    <template v-else>
      <ul class="cart-page__list">
        <li v-for="item in cartStore.items" :key="item.id" class="cart-line">
          <label class="cart-line__check">
            <input
              type="checkbox"
              :checked="item.checked"
              :disabled="item.stockStatus !== 'normal'"
              @change="cartStore.toggleCheck(item.id)"
            />
          </label>
          <img class="cart-line__img" :src="item.productImg" :alt="item.productName" />
          <div class="cart-line__body">
            <RouterLink class="cart-line__title" :to="`/product/${item.productId}`">{{ item.productName }}</RouterLink>
            <p v-if="specText(item)" class="cart-line__spec">{{ specText(item) }}</p>
            <p v-if="item.priceChanged" class="cart-line__warn">价格已变动</p>
            <div class="cart-line__bottom">
              <span class="cart-line__price">¥{{ formatYuan(Number(item.currentPrice)) }}</span>
              <input
                v-model.number="quantityDraft[item.id]"
                class="cart-line__qty"
                type="number"
                min="1"
                :disabled="item.stockStatus !== 'normal'"
                @blur="onQuantityBlur(item)"
              />
            </div>
            <p v-if="item.stockStatus !== 'normal'" class="cart-line__soldout">库存不足或已售罄</p>
          </div>
          <button type="button" class="cart-line__remove" aria-label="删除" @click="removeLine(item)">×</button>
        </li>
      </ul>

      <section v-if="cartStore.invalidItems.length > 0" class="cart-page__invalid">
        <div class="cart-page__invalid-head">
          <h2>失效商品</h2>
          <button type="button" class="cart-page__ghost" @click="cartStore.clearInvalidItems()">清空失效</button>
        </div>
        <ul>
          <li v-for="item in cartStore.invalidItems" :key="item.id" class="cart-line cart-line--invalid">
            <img class="cart-line__img" :src="item.productImg" :alt="item.productName" />
            <div class="cart-line__body">
              <p class="cart-line__title">{{ item.productName }}</p>
              <p class="cart-line__soldout">已失效</p>
            </div>
          </li>
        </ul>
      </section>

      <footer class="cart-page__bar">
        <label class="cart-page__all">
          <input
            type="checkbox"
            :checked="cartStore.isAllChecked"
            @change="cartStore.toggleAll(($event.target as HTMLInputElement).checked)"
          />
          全选
        </label>
        <div class="cart-page__summary">
          <span>合计 <strong>¥{{ formatYuan(cartStore.selectedTotal) }}</strong></span>
          <button type="button" class="cart-page__primary" @click="goCheckout">
            去结算 ({{ cartStore.selectedCount }})
          </button>
        </div>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.cart-page {
  margin: 0 auto;
  max-width: 960px;
  padding: 12px 12px 96px;
}

.cart-page__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.cart-page__state--error {
  color: #b45309;
}

.cart-page__list {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.cart-line {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  display: grid;
  gap: 10px;
  grid-template-columns: auto 72px 1fr auto;
  padding: 12px;
}

.cart-line--invalid {
  grid-template-columns: 72px 1fr;
  opacity: 0.7;
}

.cart-line__check {
  align-self: center;
}

.cart-line__img {
  border-radius: 8px;
  height: 72px;
  object-fit: cover;
  width: 72px;
}

.cart-line__body {
  min-width: 0;
}

.cart-line__title {
  color: inherit;
  font-weight: 600;
  text-decoration: none;
}

.cart-line__spec,
.cart-line__warn,
.cart-line__soldout {
  color: #64748b;
  font-size: 0.75rem;
  margin: 4px 0 0;
}

.cart-line__warn,
.cart-line__soldout {
  color: #b45309;
}

.cart-line__bottom {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.cart-line__price {
  color: #dc2626;
  font-weight: 700;
}

.cart-line__qty {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  max-width: 72px;
  padding: 4px 8px;
}

.cart-line__remove {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1.25rem;
}

.cart-page__invalid {
  margin-top: 16px;
}

.cart-page__invalid-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cart-page__invalid h2 {
  font-size: 0.9375rem;
  margin: 0;
}

.cart-page__bar {
  align-items: center;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  display: flex;
  gap: 12px;
  justify-content: space-between;
  left: 0;
  padding: 10px 16px;
  position: fixed;
  right: 0;
  z-index: 15;
}

.cart-page__all {
  align-items: center;
  display: flex;
  font-size: 0.875rem;
  gap: 6px;
}

.cart-page__summary {
  align-items: center;
  display: flex;
  gap: 12px;
}

.cart-page__summary strong {
  color: #dc2626;
}

.cart-page__primary,
.cart-page__ghost {
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 10px 14px;
  text-decoration: none;
}

.cart-page__primary {
  background: #0d9488;
  border: none;
  color: #fff;
  font-weight: 600;
}

.cart-page__ghost {
  background: #fff;
  border: 1px solid #e2e8f0;
  color: #334155;
  display: inline-block;
  text-align: center;
}
</style>
