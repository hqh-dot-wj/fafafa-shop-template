<script lang="ts" setup>
defineProps<{
  addressText: string;
  couponCount: number;
  isEditing: boolean;
  /** 有有效或失效商品时展示「管理/完成」，空车不展示 */
  showManage: boolean;
}>();

const emit = defineEmits<{
  'open-address': [];
  'frequent-buy': [];
  'open-coupons': [];
  'toggle-manage': [];
}>();
</script>

<template>
  <view class="border-b border-line bg-fill px-space-md py-space-xs">
    <view class="flex items-center gap-space-sm">
      <view
        class="min-h-72rpx min-w-0 flex flex-1 items-center gap-space-xs"
        hover-class="opacity-80"
        @click="emit('open-address')"
      >
        <wd-icon name="location" size="28rpx" class="flex-shrink-0 text-ink" />
        <text class="line-clamp-2 flex-1 text-body-md text-ink">{{ addressText }}</text>
      </view>

      <view class="flex flex-shrink-0 flex-nowrap items-center justify-end gap-x-space-sm">
        <text class="whitespace-nowrap text-caption text-ink" hover-class="opacity-80" @click="emit('frequent-buy')">
          常买
        </text>
        <text class="whitespace-nowrap text-caption text-ink" hover-class="opacity-80" @click="emit('open-coupons')">
          优惠券({{ couponCount }})
        </text>
        <text
          v-if="showManage"
          class="whitespace-nowrap text-caption text-ink"
          hover-class="opacity-80"
          @click="emit('toggle-manage')"
        >
          {{ isEditing ? '完成' : '管理' }}
        </text>
      </view>
    </view>
  </view>
</template>
