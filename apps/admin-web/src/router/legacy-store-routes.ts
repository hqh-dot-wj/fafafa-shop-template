import type { LocationQueryRaw, RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

const legacyStorePathMap = {
  '/store/order/dispatch': '/store/fulfillment/service-dispatch',
  '/store/product-market': '/store/product/market',
  '/store/finance/distribution-config': '/store/distribution/distribution',
} as const;

function cloneQuery(query: RouteLocationNormalized['query']): LocationQueryRaw {
  return { ...query };
}

export function resolveLegacyStoreRouteLocation(to: Pick<RouteLocationNormalized, 'path' | 'query' | 'hash'>): RouteLocationRaw | null {
  const targetPath = legacyStorePathMap[to.path as keyof typeof legacyStorePathMap];
  if (!targetPath) return null;

  return {
    path: targetPath,
    query: cloneQuery(to.query),
    hash: to.hash,
    replace: true,
  };
}
