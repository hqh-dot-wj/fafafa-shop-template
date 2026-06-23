<script setup lang="ts">
import type { AddressVo } from '@/service/api/address';
import type { CreateOrderParams } from '@libs/common-types';
import type { CheckoutPreviewParams, CheckoutPreviewVo, OrderItemInput } from '@/service/api/order';
import { getCheckoutPreview, createOrder } from '@/service/api/order';
import { getDefaultAddress } from '@/service/api/address';
import { completeWebPayment } from '@/hooks/use-checkout-pay';
import { formatYuan } from '@/utils/product-display';
import { toastError, toastMessage } from '@/utils/toast';

const route = useRoute();
const router = useRouter();
const { apiClient } = useApi();
const cartStore = useCartStore();
const tenantId = useTenantId();

type CheckoutMode = 'cart' | 'direct';

const checkoutMode = ref<CheckoutMode>('cart');
const directBuyItems = ref<OrderItemInput[]>([]);
const directTenantId = ref('');

const loading = ref(true);
const submitting = ref(false);
const preview = ref<CheckoutPreviewVo | null>(null);
const selectedAddress = ref<AddressVo | null>(null);

const manualReceiver = ref({
  name: '',
  phone: '',
  address: '',
});
const remark = ref('');

const checkoutData = computed<CheckoutPreviewParams>(() => {
  if (checkoutMode.value === 'direct') {
    return {
      items: directBuyItems.value,
      tenantId: directTenantId.value,
    };
  }
  const data = cartStore.getCheckoutData();
  return {
    items: data.items,
    tenantId: data.tenantId ?? tenantId,
  };
});

function parseQuantity(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function initCheckoutMode() {
  const mode = route.query.mode;
  const skuId = route.query.skuId;
  const queryTenantId = route.query.tenantId;

  if (mode === 'direct' && typeof skuId === 'string' && typeof queryTenantId === 'string') {
    checkoutMode.value = 'direct';
    directTenantId.value = queryTenantId;
    const item: OrderItemInput = {
      skuId,
      quantity: parseQuantity(route.query.quantity),
    };
    const activityContextKey = route.query.activityContextKey;
    if (typeof activityContextKey === 'string' && activityContextKey.trim()) {
      item.activityContextKey = activityContextKey;
    }
    directBuyItems.value = [item];
    return;
  }

  checkoutMode.value = 'cart';
}

function formatSpec(specData: unknown): string {
  if (!specData || typeof specData !== 'object') return '';
  return Object.values(specData as Record<string, unknown>)
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' / ');
}

async function loadCheckoutPreview() {
  const data = checkoutData.value;
  if (!data.tenantId || data.items.length === 0) {
    toastMessage('请选择商品');
    void router.replace('/cart');
    return;
  }

  loading.value = true;
  try {
    preview.value = await getCheckoutPreview(apiClient, data);
  } catch (error) {
    preview.value = null;
    toastError(error, '加载结算信息失败');
  } finally {
    loading.value = false;
  }
}

async function loadDefaultAddress() {
  try {
    selectedAddress.value = await getDefaultAddress(apiClient);
    if (selectedAddress.value) {
      manualReceiver.value = {
        name: selectedAddress.value.name,
        phone: selectedAddress.value.phone,
        address: selectedAddress.value.fullAddress,
      };
    }
  } catch {
    selectedAddress.value = null;
  }
}

function resolveReceiver() {
  if (selectedAddress.value) {
    return {
      name: selectedAddress.value.name,
      phone: selectedAddress.value.phone,
      address: selectedAddress.value.fullAddress,
      lat: selectedAddress.value.latitude,
      lng: selectedAddress.value.longitude,
    };
  }

  const name = manualReceiver.value.name.trim();
  const phone = manualReceiver.value.phone.trim();
  const address = manualReceiver.value.address.trim();
  if (!name || !phone || !address) return null;

  return { name, phone, address };
}

async function submitOrder() {
  if (!preview.value) return;

  const receiver = resolveReceiver();
  if (!receiver) {
    toastMessage('请填写收货人信息');
    return;
  }

  const data = checkoutData.value;
  submitting.value = true;
  try {
    const payload: CreateOrderParams = {
      tenantId: data.tenantId,
      items: data.items,
      receiverName: receiver.name,
      receiverPhone: receiver.phone,
      receiverAddress: receiver.address,
    };
    if (receiver.lat !== undefined) payload.receiverLat = receiver.lat;
    if (receiver.lng !== undefined) payload.receiverLng = receiver.lng;
    if (remark.value.trim()) payload.remark = remark.value.trim();

    const result = await createOrder(apiClient, payload);
    if (checkoutMode.value === 'cart') {
      await cartStore.fetchCartList();
    }

    await completeWebPayment(result.orderId);
  } catch (error) {
    toastError(error, '创建订单失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  initCheckoutMode();
  await Promise.all([loadCheckoutPreview(), loadDefaultAddress()]);
});
</script>

<template>
  <main class="checkout">
    <p v-if="loading" class="checkout__state">加载中…</p>

    <template v-else-if="preview">
      <section class="checkout__card">
        <div class="checkout__address-head">
          <h2>收货信息</h2>
          <RouterLink to="/address" class="checkout__address-link">管理地址</RouterLink>
        </div>
        <p v-if="selectedAddress" class="checkout__hint">已加载默认地址，可直接修改下方表单</p>
        <label class="checkout__field">
          <span>收货人</span>
          <input v-model="manualReceiver.name" type="text" placeholder="姓名" />
        </label>
        <label class="checkout__field">
          <span>手机号</span>
          <input v-model="manualReceiver.phone" type="tel" maxlength="11" placeholder="手机号" />
        </label>
        <label class="checkout__field">
          <span>详细地址</span>
          <textarea v-model="manualReceiver.address" rows="3" placeholder="省市区 + 详细地址" />
        </label>
      </section>

      <section class="checkout__card">
        <h2>商品清单</h2>
        <ul class="checkout__goods">
          <li v-for="item in preview.items" :key="`${item.skuId}-${item.quantity}`">
            <img :src="item.productImg" :alt="item.productName" />
            <div>
              <p class="checkout__name">{{ item.productName }}</p>
              <p v-if="formatSpec(item.specData)" class="checkout__spec">
                {{ formatSpec(item.specData) }}
              </p>
              <p class="checkout__line-price">¥{{ formatYuan(item.price) }} × {{ item.quantity }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section class="checkout__card">
        <h2>备注</h2>
        <textarea v-model="remark" rows="2" placeholder="选填" />
      </section>

      <section class="checkout__card checkout__amount">
        <div>
          <span>商品总额</span><span>¥{{ formatYuan(preview.totalAmount) }}</span>
        </div>
        <div>
          <span>运费</span><span>¥{{ formatYuan(preview.freightAmount) }}</span>
        </div>
        <div>
          <span>优惠</span><span>-¥{{ formatYuan(preview.discountAmount) }}</span>
        </div>
        <div class="checkout__pay">
          <span>应付</span><strong>¥{{ formatYuan(preview.payAmount) }}</strong>
        </div>
      </section>

      <footer class="checkout__bar">
        <span>合计 <strong>¥{{ formatYuan(preview.payAmount) }}</strong></span>
        <button type="button" class="checkout__submit" :disabled="submitting" @click="submitOrder">
          {{ submitting ? '提交中…' : '提交订单并支付' }}
        </button>
      </footer>
    </template>

    <p v-else class="checkout__state checkout__state--error">无法加载结算信息</p>
  </main>
</template>

<style scoped>
.checkout {
  margin: 0 auto;
  max-width: 720px;
  padding: 12px 12px 96px;
}

.checkout__state {
  color: #64748b;
  padding: 48px 0;
  text-align: center;
}

.checkout__state--error {
  color: #b45309;
}

.checkout__card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 12px;
  padding: 16px;
}

.checkout__card h2 {
  font-size: 0.9375rem;
  margin: 0 0 12px;
}

.checkout__address-head {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.checkout__address-head h2 {
  margin: 0;
}

.checkout__address-link {
  color: #0d9488;
  font-size: 0.8125rem;
  text-decoration: none;
}

.checkout__hint {
  color: #64748b;
  font-size: 0.75rem;
  margin: 0 0 12px;
}

.checkout__field {
  display: grid;
  gap: 6px;
  margin-bottom: 10px;
}

.checkout__field span {
  color: #64748b;
  font-size: 0.8125rem;
}

.checkout__field input,
.checkout__field textarea,
.checkout__card textarea {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font: inherit;
  padding: 10px 12px;
  width: 100%;
}

.checkout__goods {
  display: grid;
  gap: 12px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.checkout__goods li {
  display: grid;
  gap: 10px;
  grid-template-columns: 64px 1fr;
}

.checkout__goods img {
  border-radius: 8px;
  height: 64px;
  object-fit: cover;
  width: 64px;
}

.checkout__name {
  font-weight: 600;
  margin: 0;
}

.checkout__spec,
.checkout__line-price {
  color: #64748b;
  font-size: 0.75rem;
  margin: 4px 0 0;
}

.checkout__amount div {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.checkout__pay {
  border-top: 1px solid #e2e8f0;
  margin-top: 8px;
  padding-top: 12px;
}

.checkout__pay strong {
  color: #dc2626;
  font-size: 1.125rem;
}

.checkout__bar {
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

.checkout__bar strong {
  color: #dc2626;
}

.checkout__submit {
  background: #0d9488;
  border: none;
  border-radius: 10px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
  padding: 12px 16px;
}

.checkout__submit:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
