<script lang="ts" setup>
withDefaults(
  defineProps<{
    description: string;
    buttonText: string;
    /** solid：填充主按钮；ghost：细边框透明底 */
    buttonVariant?: 'solid' | 'ghost';
  }>(),
  { buttonVariant: 'solid' },
);

const emit = defineEmits<{
  primary: [];
}>();
</script>

<template>
  <view class="flex flex-1 flex-col items-center justify-center px-space-xl py-space-xl">
    <!-- 原 /static/images/empty-cart.png 未纳入仓库，用图标占位避免中间大块空白 -->
    <view
      class="mb-space-lg h-300rpx w-300rpx flex items-center justify-center rounded-card bg-fill shadow-card"
      aria-hidden="true"
    >
      <view class="i-carbon-shopping-cart text-200rpx text-ink-lighter opacity-60" />
    </view>
    <text class="mb-space-lg text-center text-body-lg text-ink-light">{{ description }}</text>
    <wd-button
      v-if="buttonVariant === 'ghost'"
      type="primary"
      plain
      hairline
      size="medium"
      hover-class="opacity-80"
      @click="emit('primary')"
    >
      {{ buttonText }}
    </wd-button>
    <wd-button v-else type="primary" size="medium" hover-class="opacity-80" @click="emit('primary')">
      {{ buttonText }}
    </wd-button>
  </view>
</template>
