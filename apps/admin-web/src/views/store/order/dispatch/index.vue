<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getRoutePath } from '@/router/elegant/transform';

defineOptions({
  name: 'OrderDispatchRedirect',
});

const route = useRoute();
const router = useRouter();

onMounted(() => {
  router.replace({
    path: getRoutePath('store_fulfillment_service-dispatch'),
    query: route.query,
  });
});
</script>

<template>
  <div class="min-h-200px" />
</template>
