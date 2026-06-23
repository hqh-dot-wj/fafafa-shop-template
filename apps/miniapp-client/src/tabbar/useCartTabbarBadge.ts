import { storeToRefs } from 'pinia';
import { watch } from 'vue';
import { useCartStore } from '@/store/cart';
import { useTokenStore } from '@/store/token';
import { customTabbarEnable } from './config';
import { tabbarList, tabbarStore } from './store';

/** 与 customTabbarList 中购物车 path 一致（store 内已规范为 `/` 开头） */
const CART_TAB_PATH = 'pages/cart/cart';

function cartTabIndex(): number {
  return tabbarList.findIndex((item) => item.pagePath.replace(/^\//, '') === CART_TAB_PATH);
}

/**
 * 将「已勾选的有效商品件数」同步到 TabBar 角标（每行按 quantity 累加，与结算勾选一致）。
 * 微信小程序 + H5 共用；在 KuRoot 调用一次即可。
 */
export function useCartTabbarBadge(): void {
  if (!customTabbarEnable) return;

  const cartStore = useCartStore();
  const tokenStore = useTokenStore();
  const { selectedCount } = storeToRefs(cartStore);
  const { hasLogin } = storeToRefs(tokenStore);

  function sync(): void {
    const idx = cartTabIndex();
    if (idx === -1) return;
    const n = hasLogin.value ? selectedCount.value : 0;
    tabbarStore.setTabbarItemBadge(idx, n);
  }

  watch([selectedCount, hasLogin], sync, { immediate: true });
}
