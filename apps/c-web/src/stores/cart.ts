import type { CartItem as ApiCartItem } from '@libs/common-types';
import { defineStore } from 'pinia';
import type { OrderItemInput } from '@/service/api/order';
import {
  addToCart as apiAddToCart,
  clearCart as apiClearCart,
  getCartList,
  removeCartItem,
  updateCartQuantity,
} from '@/service/api/cart';
import { useApi } from '@/hooks/use-api';
import { useTenantId } from '@/hooks/use-tenant-id';

export interface CartItem extends ApiCartItem {
  checked: boolean;
}

function readActivityKey(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

/** 购物车 Pinia：与 miniapp `store/cart` API 行为对齐。 */
export const useCartStore = defineStore('c-web-cart', () => {
  const items = ref<CartItem[]>([]);
  const invalidItems = ref<CartItem[]>([]);
  const loading = ref(false);
  const listLoadError = ref(false);

  const selectedItems = computed(() => items.value.filter((item) => item.checked && item.stockStatus === 'normal'));

  const selectedTotal = computed(() =>
    selectedItems.value.reduce((sum, item) => sum + Number(item.currentPrice) * item.quantity, 0),
  );

  const selectedCount = computed(() => selectedItems.value.reduce((sum, item) => sum + item.quantity, 0));

  const totalCount = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0));

  const isAllChecked = computed(() => {
    const valid = items.value.filter((item) => item.stockStatus === 'normal');
    return valid.length > 0 && valid.every((item) => item.checked);
  });

  async function fetchCartList(): Promise<void> {
    const { apiClient } = useApi();
    const tenantId = useTenantId();
    if (!tenantId) {
      items.value = [];
      invalidItems.value = [];
      listLoadError.value = false;
      return;
    }

    loading.value = true;
    listLoadError.value = false;
    try {
      const result = await getCartList(apiClient, tenantId);
      items.value = (result.items ?? []).map((item) => ({ ...item, checked: true }));
      invalidItems.value = (result.invalidItems ?? []).map((item) => ({ ...item, checked: false }));
    } catch {
      listLoadError.value = true;
      items.value = [];
      invalidItems.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function addToCart(
    skuId: string,
    quantity = 1,
    activityContext?: { activityContextKey: string; entrySource?: string },
  ): Promise<boolean> {
    const { apiClient } = useApi();
    const tenantId = useTenantId();
    if (!tenantId) return false;

    try {
      await apiAddToCart(apiClient, {
        tenantId,
        skuId,
        quantity,
        activityContextKey: activityContext?.activityContextKey,
        entrySource: activityContext?.entrySource,
      });
      await fetchCartList();
      return true;
    } catch {
      return false;
    }
  }

  async function updateQuantity(skuId: string, quantity: number, activityContextKey?: string | null): Promise<void> {
    const { apiClient } = useApi();
    const tenantId = useTenantId();
    if (!tenantId) return;

    try {
      await updateCartQuantity(apiClient, tenantId, {
        skuId,
        quantity,
        activityContextKey: activityContextKey ?? undefined,
      });
      const item = items.value.find(
        (row) => row.skuId === skuId && readActivityKey(row.activityContextKey) === (activityContextKey ?? null),
      );
      if (item) item.quantity = quantity;
    } catch {
      await fetchCartList();
    }
  }

  async function removeItem(cartItemId: string): Promise<void> {
    const { apiClient } = useApi();
    const tenantId = useTenantId();
    if (!tenantId) return;

    try {
      await removeCartItem(apiClient, tenantId, cartItemId);
      items.value = items.value.filter((item) => item.id !== cartItemId);
      invalidItems.value = invalidItems.value.filter((item) => item.id !== cartItemId);
    } catch {
      await fetchCartList();
    }
  }

  async function clearCart(): Promise<void> {
    const { apiClient } = useApi();
    const tenantId = useTenantId();
    if (!tenantId) return;

    try {
      await apiClearCart(apiClient, tenantId);
      items.value = [];
      invalidItems.value = [];
    } catch {
      await fetchCartList();
    }
  }

  function toggleCheck(cartItemId: string): void {
    const item = items.value.find((row) => row.id === cartItemId);
    if (item && item.stockStatus === 'normal') {
      item.checked = !item.checked;
    }
  }

  function toggleAll(checked: boolean): void {
    items.value.forEach((item) => {
      if (item.stockStatus === 'normal') item.checked = checked;
    });
  }

  async function clearInvalidItems(): Promise<void> {
    for (const item of [...invalidItems.value]) {
      await removeItem(item.id);
    }
    invalidItems.value = [];
  }

  function getCheckoutData() {
    const tenantId = useTenantId();
    const checkoutItems: OrderItemInput[] = selectedItems.value.map((item) => {
      const row: OrderItemInput = {
        cartItemId: item.id,
        skuId: item.skuId,
        quantity: item.quantity,
      };
      const activityKey = readActivityKey(item.activityContextKey);
      if (activityKey) row.activityContextKey = activityKey;
      return row;
    });

    return {
      items: checkoutItems,
      tenantId,
    };
  }

  return {
    items,
    invalidItems,
    loading,
    listLoadError,
    selectedItems,
    selectedTotal,
    selectedCount,
    totalCount,
    isAllChecked,
    fetchCartList,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    toggleCheck,
    toggleAll,
    clearInvalidItems,
    getCheckoutData,
  };
});
