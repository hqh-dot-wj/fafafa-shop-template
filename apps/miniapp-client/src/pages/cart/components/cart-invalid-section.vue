<script lang="ts" setup>
import type { CartItem } from '@/store/cart';

defineProps<{
  items: CartItem[];
}>();

const emit = defineEmits<{
  clear: [];
}>();
</script>

<template>
  <view v-if="items.length > 0" class="mt-space-lg">
    <view class="flex items-center justify-between px-space-md py-space-xs text-body-md text-ink-light">
      <text>失效商品 ({{ items.length }})</text>
      <text class="min-h-88rpx flex items-center text-primary" hover-class="opacity-80" @click="emit('clear')"
        >清空</text
      >
    </view>

    <view
      v-for="row in items"
      :key="row.id"
      class="mx-space-md mt-space-sm box-border overflow-hidden border border-line rounded-card bg-surface opacity-60 shadow-card"
    >
      <view class="flex items-center p-space-md">
        <view class="flex shrink-0 items-center self-stretch pr-space-xs">
          <view
            class="h-36rpx w-60rpx flex items-center justify-center rounded-sm bg-fill text-center text-micro text-ink-lighter leading-none"
          >
            失效
          </view>
        </view>
        <image
          class="mr-space-sm h-160rpx w-160rpx flex-shrink-0 rounded-card"
          :src="row.productImg || '/static/images/placeholder.png'"
          mode="aspectFill"
          lazy-load
        />
        <view class="min-h-160rpx min-w-0 flex flex-1 flex-col">
          <text class="line-clamp-2 text-body-lg text-ink leading-snug">{{ row.productName }}</text>
          <text class="mt-space-xs text-caption text-error">商品已下架或不可售</text>
        </view>
      </view>
    </view>
  </view>
</template>
