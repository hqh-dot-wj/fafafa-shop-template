<script setup lang="ts">
import Simplebar from 'simplebar-vue';
import 'simplebar-vue/dist/simplebar.min.css';

defineOptions({
  name: 'SimpleScrollbar',
});
</script>

<template>
  <!-- min-h-0：flex 子项可收缩，避免侧栏展开后白底/滚动区域高度计算错误 -->
  <div class="min-h-0 h-full flex-1-hidden">
    <Simplebar class="h-full max-h-full">
      <slot />
    </Simplebar>
  </div>
</template>

<style scoped></style>
