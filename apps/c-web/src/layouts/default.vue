<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue';
import AppTabBar from '@/components/layout/AppTabBar.vue';

const route = useRoute();
const showChrome = computed(() => route.meta.hideChrome !== true);
</script>

<template>
  <div class="layout" :class="{ 'layout--chrome': showChrome }">
    <AppHeader v-if="showChrome" />
    <main class="layout__main">
      <RouterView />
    </main>
    <AppTabBar v-if="showChrome" />
  </div>
</template>

<style scoped>
.layout {
  background: #f8fafc;
  color: #0f172a;
  min-height: 100dvh;
}

.layout--chrome .layout__main {
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}
</style>
