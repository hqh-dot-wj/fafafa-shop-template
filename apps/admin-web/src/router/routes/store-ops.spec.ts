import { describe, expect, it } from 'vitest';
import { normalizeStoreOperationsRoutes } from './store-ops';

type TestStoreRoute = {
  name: string;
  path: string;
  component?: string;
  meta?: Record<string, unknown>;
  children?: TestStoreRoute[];
};

function buildStoreRoute(): TestStoreRoute {
  return {
    name: 'store',
    path: '/store',
    component: 'layout.base',
    meta: { title: 'store', i18nKey: 'route.store' },
    children: [
      {
        name: 'store_order',
        path: '/store/order',
        component: 'view.store_order',
        meta: { title: 'store_order', i18nKey: 'route.store_order' },
        children: [
          {
            name: 'store_order_dispatch',
            path: '/store/order/dispatch',
            component: 'view.store_order_dispatch',
            meta: { title: 'store_order_dispatch', i18nKey: 'route.store_order_dispatch' },
          },
          {
            name: 'store_order_activity-audit',
            path: '/store/order/activity-audit',
            component: 'view.store_order_activity-audit',
            meta: { title: 'store_order_activity-audit', i18nKey: 'route.store_order_activity-audit' },
          },
          {
            name: 'store_order_list',
            path: '/store/order/list',
            component: 'view.store_order_list',
            meta: { title: 'store_order_list', i18nKey: 'route.store_order_list' },
          },
        ],
      },
      {
        name: 'store_product',
        path: '/store/product',
        meta: { title: 'store_product', i18nKey: 'route.store_product' },
        children: [
          {
            name: 'store_product_market',
            path: '/store/product/market',
            component: 'view.store_product_market',
            meta: { title: 'store_product_market', i18nKey: 'route.store_product_market' },
          },
          {
            name: 'store_product_list',
            path: '/store/product/list',
            component: 'view.store_product_list',
            meta: { title: 'store_product_list', i18nKey: 'route.store_product_list' },
          },
        ],
      },
      {
        name: 'store_stock',
        path: '/store/stock',
        component: 'view.store_stock',
        meta: { title: 'store_stock', i18nKey: 'route.store_stock' },
      },
      {
        name: 'store_finance',
        path: '/store/finance',
        component: 'view.store_finance',
        meta: { title: 'store_finance', i18nKey: 'route.store_finance' },
        children: [
          {
            name: 'store_finance_commission-audit',
            path: '/store/finance/commission-audit',
            component: 'view.store_finance_commission-audit',
            meta: { title: 'store_finance_commission-audit', i18nKey: 'route.store_finance_commission-audit' },
          },
          {
            name: 'store_finance_commission',
            path: '/store/finance/commission',
            component: 'view.store_finance_commission',
            meta: { title: 'store_finance_commission', i18nKey: 'route.store_finance_commission' },
          },
        ],
      },
    ],
  };
}

function normalizeStoreRouteUnderTest() {
  return normalizeStoreOperationsRoutes([buildStoreRoute() as never]) as TestStoreRoute[];
}

describe('store operation routes', () => {
  it('groups stock under product operations without changing the stock route path', () => {
    const [store] = normalizeStoreRouteUnderTest();
    const rootChildNames = store.children?.map((child) => child.name);
    const product = store.children?.find((child) => child.name === 'store_product');
    const stock = product?.children?.find((child) => child.name === 'store_stock');

    expect(rootChildNames).not.toContain('store_stock');
    expect(product?.meta?.order).toBe(10);
    expect(stock?.path).toBe('/store/stock');
    expect(stock?.meta?.order).toBe(50);
  });

  it('keeps legacy dispatch and audit routes compatible but hidden from main menus', () => {
    const [store] = normalizeStoreRouteUnderTest();
    const order = store.children?.find((child) => child.name === 'store_order');
    const dispatch = order?.children?.find((child) => child.name === 'store_order_dispatch');
    const activityAudit = order?.children?.find((child) => child.name === 'store_order_activity-audit');

    expect(dispatch?.meta?.hideInMenu).toBe(true);
    expect(dispatch?.meta?.activeMenu).toBe('store_fulfillment_service-dispatch');
    expect(activityAudit?.meta?.hideInMenu).toBe(true);
    expect(activityAudit?.meta?.activeMenu).toBe('store_order_list');
  });

  it('keeps finance audit as an internal drill-down under commission records', () => {
    const [store] = normalizeStoreRouteUnderTest();
    const finance = store.children?.find((child) => child.name === 'store_finance');
    const commissionAudit = finance?.children?.find((child) => child.name === 'store_finance_commission-audit');

    expect(finance?.meta?.order).toBe(50);
    expect(commissionAudit?.meta?.hideInMenu).toBe(true);
    expect(commissionAudit?.meta?.activeMenu).toBe('store_finance_commission');
  });
});
