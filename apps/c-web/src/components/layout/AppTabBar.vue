<script setup lang="ts">
const route = useRoute();
const tokenStore = useTokenStore();
const cartStore = useCartStore();
const { visibleTabs } = useFeatureNav();

const tabGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${visibleTabs.value.length}, minmax(0, 1fr))`,
}));

function isActive(path: string): boolean {
  if (path === '/') return route.path === '/';
  return route.path === path || route.path.startsWith(`${path}/`);
}
</script>

<template>
  <nav class="app-tabbar" aria-label="主导航" :style="tabGridStyle">
    <RouterLink
      v-for="tab in visibleTabs"
      :key="tab.to"
      class="app-tabbar__item"
      :class="{ 'app-tabbar__item--active': isActive(tab.to) }"
      :to="tab.to"
    >
      <span class="app-tabbar__icon" aria-hidden="true">
        {{ tab.icon }}
        <span v-if="tab.to === '/cart' && tokenStore.hasLogin && cartStore.totalCount > 0" class="app-tabbar__badge">
          {{ cartStore.totalCount > 99 ? '99+' : cartStore.totalCount }}
        </span>
      </span>
      <span class="app-tabbar__label">{{ tab.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.app-tabbar {
  background: #fff;
  border-top: 1px solid #e2e8f0;
  bottom: 0;
  display: grid;
  gap: 4px;
  left: 0;
  padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
  position: fixed;
  right: 0;
  z-index: 30;
}

.app-tabbar__item {
  align-items: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  font-size: 0.6875rem;
  gap: 2px;
  justify-content: center;
  min-height: 48px;
  text-decoration: none;
}

.app-tabbar__item--active {
  color: var(--shop-theme, #0d9488);
  font-weight: 600;
}

.app-tabbar__icon {
  font-size: 1.125rem;
  line-height: 1;
  position: relative;
}

.app-tabbar__badge {
  background: #ef4444;
  border-radius: 999px;
  color: #fff;
  font-size: 0.625rem;
  line-height: 1;
  min-width: 16px;
  padding: 2px 4px;
  position: absolute;
  right: -10px;
  top: -6px;
}
</style>
