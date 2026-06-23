import { createApp } from 'vue';
import './plugins/assets';
import {
  setupAppErrorHandle,
  setupAppVersionNotification,
  setupDayjs,
  setupIconifyOffline,
  setupLoading,
  setupNProgress,
} from './plugins';
import { setupStore } from './store';
import { setupRouter } from './router';
import { setupI18n } from './locales';
import App from './App.vue';

function setupApp() {
  setupLoading();

  setupNProgress();

  setupIconifyOffline();

  setupDayjs();

  const app = createApp(App);

  setupAppErrorHandle(app);

  setupStore(app);

  // 不 await：让 app 立即挂载，路由守卫的 getInfo/getRouters 在后台并发推进，
  // 期间由 NProgress + RouterView 自身的过渡呈现进度；保留 await 会把首屏渲染
  // 整体阻塞到 isReady() 之后，等同于把"白屏期"延长到守卫完成。
  setupRouter(app);

  setupI18n(app);

  setupAppVersionNotification();

  app.mount('#app');
}

setupApp();
