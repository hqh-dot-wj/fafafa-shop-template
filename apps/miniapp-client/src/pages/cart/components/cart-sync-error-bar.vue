<script lang="ts" setup>
defineEmits<{
  retry: [];
}>();
</script>

<template>
  <view
    class="sync-error-bar flex items-center justify-between border-b border-line bg-surface px-space-md py-space-xs"
    hover-class="opacity-90"
  >
    <text class="flex-1 text-body-md text-ink">购物车同步失败，请检查网络后重试</text>
    <text class="min-h-88rpx min-w-88rpx flex items-center justify-center text-body-md text-primary" @click="$emit('retry')">
      重新加载
    </text>
  </view>
</template>

<style lang="scss" scoped>
.sync-error-bar {
  border-left: 6rpx solid var(--color-func-warning, #ff9c00);
  background-color: var(--color-bg-body, #f5f5f5);
}
</style>
