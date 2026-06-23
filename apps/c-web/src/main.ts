import { createApp } from 'vue';
import App from './App.vue';
import { setupStore } from './plugins/pinia';
import { setupApiClient } from './plugins/api';
import { setupRouter } from './router';
import { useShopBrandingStore } from './stores/shop-branding';
import 'vant/es/toast/style';
import 'vant/es/dialog/style';
import './styles/global.css';

async function bootstrap() {
  const app = createApp(App);
  setupStore(app);
  setupApiClient();
  const router = setupRouter(app);

  await router.isReady();

  const shopBranding = useShopBrandingStore();
  await shopBranding.loadBranding();
  document.title = shopBranding.companyName;

  app.mount('#app');
}

void bootstrap();
