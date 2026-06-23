import { describe, expect, it } from 'vitest';
import { resolveLegacyStoreRouteLocation } from './legacy-store-routes';

describe('legacy store route redirects', () => {
  it('redirects legacy order dispatch to fulfillment dispatch and preserves location payload', () => {
    const result = resolveLegacyStoreRouteLocation({
      path: '/store/order/dispatch',
      query: { orderSn: 'SO202605060001' },
      hash: '#list',
    });

    expect(result).toEqual({
      path: '/store/fulfillment/service-dispatch',
      query: { orderSn: 'SO202605060001' },
      hash: '#list',
      replace: true,
    });
  });

  it('redirects historical product market and finance distribution config paths', () => {
    expect(
      resolveLegacyStoreRouteLocation({
        path: '/store/product-market',
        query: {},
        hash: '',
      }),
    ).toMatchObject({ path: '/store/product/market', replace: true });

    expect(
      resolveLegacyStoreRouteLocation({
        path: '/store/finance/distribution-config',
        query: {},
        hash: '',
      }),
    ).toMatchObject({ path: '/store/distribution/distribution', replace: true });
  });

  it('does not redirect current store paths', () => {
    expect(
      resolveLegacyStoreRouteLocation({
        path: '/store/product/list',
        query: {},
        hash: '',
      }),
    ).toBeNull();
  });
});
