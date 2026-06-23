import type { Router } from 'vue-router';
import { createChunkLoadErrorRecoveryGuard } from './chunk-error-recovery';
import { createRouteGuard } from './route';
import { createProgressGuard } from './progress';
import { createDocumentTitleGuard } from './title';

/**
 * Router guard
 *
 * @param router - Router instance
 */
export function createRouterGuard(router: Router) {
  createChunkLoadErrorRecoveryGuard(router);
  createProgressGuard(router);
  createRouteGuard(router);
  createDocumentTitleGuard(router);
}
