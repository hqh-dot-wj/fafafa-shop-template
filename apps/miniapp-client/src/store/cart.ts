import type { CheckoutOrderItemInput } from '@/api/order';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { reportActionError, toUserErrorMessage } from '@/http/error-monitoring';
import { httpDelete, httpGet, httpPost, httpPut } from '@/http/http';
import { getShareSid } from '@/utils/dist-share-context';
import { sumMoneyByQuantity } from '@/utils/money';
import { useLocationStore } from './location';

/**
 * 购物车商品项类型
 */
export interface CartItem {
  id: string;
  skuId: string;
  productId: string;
  productName: string;
  productImg: string;
  specData: Record<string, string> | null;
  addPrice: number;
  currentPrice: number;
  priceChanged: boolean;
  quantity: number;
  stockStatus: 'normal' | 'insufficient' | 'soldOut';
  checked: boolean;
  shareUserId?: string;
  sid?: string;
  activityContextKey?: string | null;
  activityType?: string | null;
  activityNameSnapshot?: string | null;
  displayPriceSnapshot?: number | null;
}

/**
 * 购物车列表响应类型
 */
interface CartListResponse {
  items: Omit<CartItem, 'checked'>[];
  invalidItems: Omit<CartItem, 'checked'>[];
}

/**
 * 购物车状态管理
 * 提供购物车的增删改查功能，与后端 API 同步
 */
export const useCartStore = defineStore('cart', () => {
  const locationStore = useLocationStore();

  // 状态
  const items = ref<CartItem[]>([]);
  const invalidItems = ref<CartItem[]>([]);
  const loading = ref(false);
  /** 最近一次列表拉取失败（用于空列表错误态与顶部重试条） */
  const listLoadError = ref(false);

  // 计算属性：已选中的有效商品
  const selectedItems = computed(() => {
    return items.value.filter((i) => i.checked && i.stockStatus === 'normal');
  });

  // 计算属性：已选商品总价
  const selectedTotal = computed(() => {
    return sumMoneyByQuantity(
      selectedItems.value,
      (item) => item.currentPrice,
      (item) => item.quantity,
    ).toNumber();
  });

  // 计算属性：已选商品件数（每行 quantity 之和；TabBar 角标与此对齐）
  const selectedCount = computed(() => {
    return selectedItems.value.reduce((sum, i) => sum + i.quantity, 0);
  });

  // 计算属性：购物车内全部有效行件数（含未勾选；与角标无关）
  const totalCount = computed(() => {
    return items.value.reduce((sum, i) => sum + i.quantity, 0);
  });

  // 计算属性：是否全选
  const isAllChecked = computed(() => {
    const validItems = items.value.filter((i) => i.stockStatus === 'normal');
    return validItems.length > 0 && validItems.every((i) => i.checked);
  });

  /**
   * 获取购物车列表
   */
  async function fetchCartList(): Promise<void> {
    if (!locationStore.currentTenantId) {
      items.value = [];
      invalidItems.value = [];
      listLoadError.value = false;
      return;
    }

    loading.value = true;
    listLoadError.value = false;
    try {
      const result = await httpGet<CartListResponse>(
        '/client/cart/list',
        {
          tenantId: locationStore.currentTenantId,
        },
        undefined,
        {
          operationCode: 'cart.list',
          stepCode: 'cart.list.load',
          stepName: '加载购物车列表',
          metadata: { module: 'cart' },
        },
      );

      if (result) {
        // 默认全部选中有效商品
        items.value = (result.items || []).map((i) => ({
          ...i,
          checked: true,
        }));
        invalidItems.value = (result.invalidItems || []).map((i) => ({
          ...i,
          checked: false,
        }));
      }
    } catch (err) {
      reportActionError(err, {
        module: 'cart',
        operationCode: 'cart.list',
        stepCode: 'cart.list.load',
        stepName: '加载购物车列表',
      });
      console.error('获取购物车列表失败:', err);
      listLoadError.value = true;
      uni.showToast({ title: toUserErrorMessage(err, '购物车加载失败'), icon: 'none' });
    } finally {
      loading.value = false;
    }
  }

  /**
   * 添加商品到购物车
   * @param skuId SKU ID
   * @param quantity 数量
   */
  async function addToCart(
    skuId: string,
    quantity: number = 1,
    activityContext?: {
      activityContextKey: string;
      entrySource?: string;
    },
  ): Promise<boolean> {
    if (!locationStore.currentTenantId) {
      uni.showToast({ title: '请先选择门店', icon: 'none' });
      return false;
    }

    try {
      const sid = getShareSid();
      await httpPost(
        '/client/cart/add',
        {
          tenantId: locationStore.currentTenantId,
          skuId,
          quantity,
          sid: sid ?? undefined,
          ...activityContext,
        },
        undefined,
        undefined,
        {
          operationCode: 'cart.add',
          stepCode: 'cart.add.submit',
          stepName: '加入购物车',
          metadata: { module: 'cart', skuId, quantity, activityContextKey: activityContext?.activityContextKey },
        },
      );
      uni.showToast({ title: '已加入购物车', icon: 'success' });
      await fetchCartList();
      return true;
    } catch (err) {
      reportActionError(err, {
        module: 'cart',
        operationCode: 'cart.add',
        stepCode: 'cart.add.submit',
        stepName: '加入购物车',
        metadata: { skuId, quantity },
      });
      console.error('添加购物车失败:', err);
      return false;
    }
  }

  /**
   * 更新购物车商品数量
   */
  async function updateQuantity(skuId: string, quantity: number, activityContextKey?: string | null): Promise<void> {
    if (!locationStore.currentTenantId) return;

    try {
      await httpPut(
        '/client/cart/quantity',
        {
          skuId,
          quantity,
          activityContextKey: activityContextKey ?? undefined,
        },
        {
          tenantId: locationStore.currentTenantId,
        },
        undefined,
        {
          operationCode: 'cart.quantity',
          stepCode: 'cart.quantity.update',
          stepName: '更新购物车数量',
          metadata: { module: 'cart', skuId, quantity, activityContextKey },
        },
      );
      // 本地更新
      const item = items.value.find(
        (i) => i.skuId === skuId && (i.activityContextKey ?? null) === (activityContextKey ?? null),
      );
      if (item) item.quantity = quantity;
    } catch (err) {
      reportActionError(err, {
        module: 'cart',
        operationCode: 'cart.quantity',
        stepCode: 'cart.quantity.update',
        stepName: '更新购物车数量',
        metadata: { skuId, quantity, activityContextKey },
      });
      console.error('更新购物车数量失败:', err);
      // 失败时刷新列表
      await fetchCartList();
    }
  }

  /**
   * 删除购物车商品
   */
  async function removeItem(cartItemId: string): Promise<void> {
    if (!locationStore.currentTenantId) return;

    try {
      await httpDelete(
        `/client/cart/item/${cartItemId}`,
        {
          tenantId: locationStore.currentTenantId,
        },
        undefined,
        {
          operationCode: 'cart.remove',
          stepCode: 'cart.remove.submit',
          stepName: '删除购物车商品',
          metadata: { module: 'cart', cartItemId },
        },
      );
      items.value = items.value.filter((i) => i.id !== cartItemId);
      invalidItems.value = invalidItems.value.filter((i) => i.id !== cartItemId);
    } catch (err) {
      reportActionError(err, {
        module: 'cart',
        operationCode: 'cart.remove',
        stepCode: 'cart.remove.submit',
        stepName: '删除购物车商品',
        metadata: { cartItemId },
      });
      console.error('删除购物车商品失败:', err);
    }
  }

  /**
   * 清空购物车
   */
  async function clearCart(): Promise<void> {
    if (!locationStore.currentTenantId) return;

    try {
      await httpDelete(
        '/client/cart/clear',
        {
          tenantId: locationStore.currentTenantId,
        },
        undefined,
        {
          operationCode: 'cart.clear',
          stepCode: 'cart.clear.submit',
          stepName: '清空购物车',
          metadata: { module: 'cart' },
        },
      );
      items.value = [];
      invalidItems.value = [];
    } catch (err) {
      reportActionError(err, {
        module: 'cart',
        operationCode: 'cart.clear',
        stepCode: 'cart.clear.submit',
        stepName: '清空购物车',
      });
      console.error('清空购物车失败:', err);
    }
  }

  /**
   * 切换单个商品选中状态
   */
  function toggleCheck(cartItemId: string): void {
    const item = items.value.find((i) => i.id === cartItemId);
    if (item && item.stockStatus === 'normal') {
      item.checked = !item.checked;
    }
  }

  /**
   * 全选/取消全选
   */
  function toggleAll(checked: boolean): void {
    items.value.forEach((i) => {
      if (i.stockStatus === 'normal') {
        i.checked = checked;
      }
    });
  }

  /**
   * 清除无效商品
   */
  async function clearInvalidItems(): Promise<void> {
    for (const item of invalidItems.value) {
      await removeItem(item.id);
    }
    invalidItems.value = [];
  }

  /**
   * 开发态：用本地 fixture 覆盖购物车列表（由购物车页在 DEV 下调用；生产环境无效果）
   */
  function applyDevMockCart(nextItems: CartItem[], nextInvalid: CartItem[] = []): void {
    if (!import.meta.env.DEV) return;
    items.value = nextItems.map((i) => ({ ...i }));
    invalidItems.value = nextInvalid.map((i) => ({ ...i, checked: false }));
    loading.value = false;
    listLoadError.value = false;
  }

  /**
   * 获取结算数据 (用于跳转结算页)
   */
  function getCheckoutData() {
    const checkoutItems: CheckoutOrderItemInput[] = selectedItems.value.map((i) => {
      const item: CheckoutOrderItemInput = {
        cartItemId: i.id,
        skuId: i.skuId,
        quantity: i.quantity,
      };
      if (i.activityContextKey) item.activityContextKey = i.activityContextKey;
      return item;
    });

    return {
      items: checkoutItems,
      tenantId: locationStore.currentTenantId,
    };
  }

  return {
    // 状态
    items,
    invalidItems,
    loading,
    listLoadError,
    // 计算属性
    selectedItems,
    selectedTotal,
    selectedCount,
    totalCount,
    isAllChecked,
    // 方法
    fetchCartList,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    toggleCheck,
    toggleAll,
    clearInvalidItems,
    applyDevMockCart,
    getCheckoutData,
  };
});
