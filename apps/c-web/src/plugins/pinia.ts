import type { App } from 'vue';
import { createPinia } from 'pinia';
import { createPersistedState } from 'pinia-plugin-persistedstate';

export function setupStore(app: App) {
  const pinia = createPinia();
  pinia.use(createPersistedState());
  app.use(pinia);
}
