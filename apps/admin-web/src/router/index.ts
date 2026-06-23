import type { App } from 'vue';
import {
  type RouterHistory,
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import { useRouteStore } from '@/store/modules/route';
import { localStg } from '@/utils/storage';
import { createBuiltinVueRoutes } from './routes/builtin';
import { createRouterGuard } from './guard';

const { VITE_ROUTER_HISTORY_MODE = 'history', VITE_BASE_URL } = import.meta.env;

const historyCreatorMap: Record<Env.RouterHistoryMode, (base?: string) => RouterHistory> = {
  hash: createWebHashHistory,
  history: createWebHistory,
  memory: createMemoryHistory,
};

export const router = createRouter({
  history: historyCreatorMap[VITE_ROUTER_HISTORY_MODE](VITE_BASE_URL),
  routes: createBuiltinVueRoutes(),
});

/**
 * Setup Vue Router
 *
 * 同步执行：常量路由（login/403/404/500 等）在此一次性装入 router，避免守卫首次跑时
 * 因 isInitConstantRoute=false 触发 redirect 回环导致 NProgress 二次重启。
 * 不再 await router.isReady() —— 首次导航在后台异步推进，期间由 NProgress 显示进度。
 */
export function setupRouter(app: App) {
  app.use(router);

  // initConstantRoute 内部为纯同步逻辑（addRoutesToVueRouter + tab init），提前到此处
  // 执行可以让 router 在进入守卫前就具备完整的常量路由集合。
  const routeStore = useRouteStore();
  routeStore.initConstantRoute();

  createRouterGuard(router);

  // 登录态预热：在 Vue mount / 首次导航开始之前就并发起 getInfo + getRouters，
  // 让网络往返与 JS 解析、组件渲染 overlap。守卫触发时通过 singleton promise 复用结果。
  if (localStg.get('token')) {
    routeStore.initAuthRoute().catch(() => {
      // 失败由 initAuthRoute 内部 resetStore 处理，此处吞错避免 unhandled rejection
    });
  }
}
