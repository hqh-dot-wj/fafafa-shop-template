type StoreRouteMeta = Record<string, unknown>;

type StoreRouteNode = {
  name: string;
  path: string;
  component?: string;
  meta?: StoreRouteMeta;
  children?: StoreRouteNode[];
  [key: string]: unknown;
};

const STORE_ROOT_NAME = 'store';
const PRODUCT_ROUTE_NAME = 'store_product';
const STOCK_ROUTE_NAME = 'store_stock';

const storeChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  store_product: { icon: 'mdi:package-variant-closed', order: 10 },
  store_order: { icon: 'mdi:cart-outline', order: 20 },
  store_fulfillment: { icon: 'mdi:truck-delivery-outline', order: 30 },
  store_worker: { icon: 'material-symbols:engineering-outline', order: 35 },
  store_distribution: { icon: 'mdi:share-variant-outline', order: 40 },
  store_finance: { icon: 'mdi:wallet-outline', order: 50 },
};

const productChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  store_product_market: { icon: 'mdi:store-search-outline', order: 10 },
  store_product_list: { icon: 'mdi:format-list-bulleted-square', order: 20 },
  store_product_draft: { icon: 'mdi:file-document-edit-outline', order: 30 },
  store_product_review: { icon: 'mdi:clipboard-check-outline', order: 40 },
  store_stock: { icon: 'mdi:warehouse', order: 50 },
};

const orderChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  store_order_list: { order: 10 },
  'store_order_activity-audit': { hideInMenu: true, activeMenu: 'store_order_list' },
  store_order_detail: { hideInMenu: true, activeMenu: 'store_order_list' },
  store_order_dispatch: { hideInMenu: true, activeMenu: 'store_fulfillment_service-dispatch' },
};

const fulfillmentChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  'store_fulfillment_service-dispatch': { order: 10 },
};

const workerChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  store_worker_profile: { icon: 'material-symbols:badge-outline', order: 10 },
  store_worker_application: { icon: 'material-symbols:fact-check-outline', order: 20 },
};

const financeChildMeta: Record<string, Partial<StoreRouteMeta>> = {
  store_finance_dashboard: { order: 10 },
  store_finance_ledger: { order: 20 },
  store_finance_commission: { order: 30 },
  store_finance_withdrawal: { order: 40 },
  'store_finance_commission-audit': { hideInMenu: true, activeMenu: 'store_finance_commission' },
};

function withMeta<T extends StoreRouteNode>(route: T, meta: Partial<StoreRouteMeta>): T {
  return {
    ...route,
    meta: {
      ...route.meta,
      ...meta,
    },
  };
}

function sortByRouteOrder(routes: StoreRouteNode[]): StoreRouteNode[] {
  return [...routes].sort((a, b) => Number(a.meta?.order ?? 999) - Number(b.meta?.order ?? 999));
}

function normalizeProductRoute(route: StoreRouteNode, stockRoute?: StoreRouteNode): StoreRouteNode {
  const normalizedChildren =
    route.children?.filter((child) => child.name !== STOCK_ROUTE_NAME).map(normalizeStoreChild) ?? [];
  const hasStockChild = normalizedChildren.some((child) => child.name === STOCK_ROUTE_NAME);
  const children = stockRoute && !hasStockChild ? [...normalizedChildren, stockRoute] : normalizedChildren;

  return withMeta(
    {
      ...route,
      children: sortByRouteOrder(children.map((child) => withMeta(child, productChildMeta[String(child.name)] ?? {}))),
    },
    storeChildMeta[PRODUCT_ROUTE_NAME],
  );
}

function normalizeStoreChild(route: StoreRouteNode): StoreRouteNode {
  const routeName = String(route.name);
  const children = route.children?.map(normalizeStoreChild);
  const baseRoute: StoreRouteNode = children ? { ...route, children } : { ...route };

  if (routeName === STOCK_ROUTE_NAME) {
    return withMeta(baseRoute, productChildMeta[STOCK_ROUTE_NAME]);
  }

  if (routeName === 'store_order') {
    return withMeta(
      {
        ...baseRoute,
        children: sortByRouteOrder(
          baseRoute.children?.map((child) => withMeta(child, orderChildMeta[String(child.name)] ?? {})) ?? [],
        ),
      },
      storeChildMeta[routeName],
    );
  }

  if (routeName === 'store_fulfillment') {
    return withMeta(
      {
        ...baseRoute,
        children: sortByRouteOrder(
          baseRoute.children?.map((child) => withMeta(child, fulfillmentChildMeta[String(child.name)] ?? {})) ?? [],
        ),
      },
      storeChildMeta[routeName],
    );
  }

  if (routeName === 'store_finance') {
    return withMeta(
      {
        ...baseRoute,
        children: sortByRouteOrder(
          baseRoute.children?.map((child) => withMeta(child, financeChildMeta[String(child.name)] ?? {})) ?? [],
        ),
      },
      storeChildMeta[routeName],
    );
  }

  if (routeName === 'store_worker') {
    return withMeta(
      {
        ...baseRoute,
        children: sortByRouteOrder(
          baseRoute.children?.map((child) => withMeta(child, workerChildMeta[String(child.name)] ?? {})) ?? [],
        ),
      },
      storeChildMeta[routeName],
    );
  }

  return withMeta(baseRoute, storeChildMeta[routeName] ?? {});
}

function normalizeStoreRoute<T extends StoreRouteNode>(route: T): T {
  if (route.name !== STORE_ROOT_NAME || !route.children) return route;

  const stockRoute = route.children.find((child) => child.name === STOCK_ROUTE_NAME);
  const children = route.children
    .filter((child) => child.name !== STOCK_ROUTE_NAME)
    .map((child) =>
      child.name === PRODUCT_ROUTE_NAME ? normalizeProductRoute(child, stockRoute) : normalizeStoreChild(child),
    );

  return {
    ...route,
    children: sortByRouteOrder(children),
  } as T;
}

/**
 * 门店菜单按运营场景组织：商品下聚合选品、门店商品、库存；订单只保留交易视角；
 * 派单与履约动作挂到履约管理，同时旧路径继续兼容。
 */
export function normalizeStoreOperationsRoutes<T extends StoreRouteNode>(routes: T[]): T[] {
  return routes.map((route) => normalizeStoreRoute(route));
}
