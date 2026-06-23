import type { Router } from 'vue-router';
import { isLoginRoute, isProtectedRoute, LOGIN_PATH } from '@/utils/auth-routes';
import { isFeatureRouteEnabled } from '@/utils/feature-routes';
import { getFeatures } from '@/utils/env';
import { useTokenStore } from '@/stores/token';

/** 璁よ瘉 + feature 璺敱瀹堝崼锛堝榻愬師 middleware/auth.global + feature.global锛夈€?*/
export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    if (isLoginRoute(to.path)) {
      const tokenStore = useTokenStore();
      if (tokenStore.hasLogin) {
        const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/';
        return redirect || '/';
      }
      return true;
    }

    if (!isFeatureRouteEnabled(to.path, getFeatures())) {
      return '/';
    }

    if (!isProtectedRoute(to.path)) return true;

    const tokenStore = useTokenStore();
    if (tokenStore.hasLogin) return true;

    const token = await tokenStore.tryGetValidToken();
    if (token) return true;

    return {
      path: LOGIN_PATH,
      query: { redirect: to.fullPath },
    };
  });
}
