import { createSSRApp } from 'vue';
import App from './App.vue';
import { setupGlobalErrorReporting } from './http/error-monitoring';
import { requestInterceptor } from './http/interceptor';
import { routeInterceptor } from './router/interceptor';

import store from './store';
import { useLocationStore } from './store/location';
import { isDevLocationMockEnabled } from './utils/dev-location-mock';
import '@/style/index.scss';
import 'virtual:uno.css';

export function createApp() {
  const app = createSSRApp(App);
  setupGlobalErrorReporting(app);
  app.use(store);
  if (isDevLocationMockEnabled()) {
    useLocationStore().applyDevMockLocation();
  }
  app.use(routeInterceptor);
  app.use(requestInterceptor);

  return {
    app,
  };
}
