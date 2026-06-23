<script setup lang="ts">
const route = useRoute();
const router = useRouter();
const tokenStore = useTokenStore();
const userStore = useUserStore();
const shopBranding = useShopBrandingStore();

const title = computed(() => {
  const metaTitle = route.meta.headerTitle;
  if (typeof metaTitle === 'string') return metaTitle;
  return shopBranding.companyName;
});

const showBack = computed(() => route.path !== '/' && route.path !== '/category');

function goBack() {
  if (typeof window !== 'undefined' && window.history.length > 1) {
    router.back();
    return;
  }
  router.push('/');
}
</script>

<template>
  <header class="app-header">
    <button v-if="showBack" type="button" class="app-header__back" aria-label="返回" @click="goBack">‹</button>
    <div class="app-header__brand">
      <img v-if="shopBranding.logoUrl" :src="shopBranding.logoUrl" alt="" class="app-header__logo" />
      <h1 class="app-header__title">{{ title }}</h1>
    </div>
    <div class="app-header__slot">
      <span v-if="tokenStore.hasLogin" class="app-header__user">{{ userStore.displayName }}</span>
      <RouterLink v-else class="app-header__login" to="/login">登录</RouterLink>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: grid;
  gap: 8px;
  grid-template-columns: 40px 1fr auto;
  height: 52px;
  padding: 0 12px;
  position: sticky;
  top: 0;
  z-index: 20;
}

.app-header__back {
  background: transparent;
  border: none;
  color: #0f172a;
  cursor: pointer;
  font-size: 1.5rem;
  line-height: 1;
  padding: 0;
}

.app-header__brand {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: center;
  min-width: 0;
}

.app-header__logo {
  border-radius: 6px;
  flex-shrink: 0;
  height: 28px;
  object-fit: contain;
  width: 28px;
}

.app-header__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__slot {
  justify-self: end;
  min-width: 40px;
  text-align: right;
}

.app-header__user {
  color: #475569;
  font-size: 0.8125rem;
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-header__login {
  color: var(--shop-theme, #0d9488);
  font-size: 0.875rem;
  text-decoration: none;
}
</style>
