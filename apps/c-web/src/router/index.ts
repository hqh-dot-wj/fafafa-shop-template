import type { App } from 'vue';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import { routes } from './routes';
import { setupRouterGuards } from './guards';

export let router: Router;

export function setupRouter(app: App): Router {
  router = createRouter({
    history: createWebHistory(import.meta.env.VITE_BASE_URL || '/shop/'),
    routes,
    scrollBehavior: () => ({ top: 0 }),
  });

  setupRouterGuards(router);
  app.use(router);
  return router;
}
