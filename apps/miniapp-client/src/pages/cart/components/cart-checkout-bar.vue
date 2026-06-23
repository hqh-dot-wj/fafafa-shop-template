<script lang="ts" setup>
import { computed } from 'vue';
import { splitMoneyParts } from '@/utils/money';

const props = defineProps<{
  isEditing: boolean;
  isAllChecked: boolean;
  selectedCount: number;
  selectedTotal: number;
  /** 无有效商品时禁用全选，避免空车误点 */
  selectAllDisabled?: boolean;
}>();

const emit = defineEmits<{
  'toggle-all': [];
  checkout: [];
  'delete-selected': [];
}>();

const totalParts = computed(() => splitMoneyParts(props.selectedTotal));
</script>

<template>
  <view
    class="cart-checkout-bar z-[var(--z-cart-bar)] w-full flex items-center border-t border-line bg-surface px-space-md py-space-xs"
  >
    <view
      class="min-h-72rpx flex shrink-0 items-center text-body-md text-ink"
      hover-class="opacity-80"
      @click="!selectAllDisabled && emit('toggle-all')"
    >
      <view class="cart-checkout-all-check flex shrink-0">
        <wd-checkbox
          shape="square"
          :model-value="isAllChecked"
          :disabled="Boolean(selectAllDisabled)"
          checked-color="var(--color-brand-primary)"
        />
      </view>
      <text class="ml-space-xs" :class="selectAllDisabled ? 'opacity-50' : ''">全选</text>
    </view>

    <view class="ml-space-sm min-w-0 flex flex-1 items-center justify-end gap-space-sm">
      <view v-if="!isEditing" class="min-w-0 flex items-baseline justify-end text-price">
        <text class="shrink-0 text-caption text-ink-light">合计</text>
        <text class="ml-4rpx shrink-0 text-micro font-medium">¥</text>
        <text class="ml-2rpx truncate text-body-md font-bold">{{ totalParts.int }}</text>
        <text class="shrink-0 text-caption font-bold">.{{ totalParts.dec }}</text>
      </view>

      <wd-button
        v-if="isEditing"
        type="error"
        size="small"
        class="shrink-0"
        :disabled="selectedCount === 0"
        hover-class="opacity-80"
        @click="emit('delete-selected')"
      >
        删除({{ selectedCount }})
      </wd-button>

      <wd-button
        v-else
        type="primary"
        size="large"
        custom-class="cart-checkout-settle-btn"
        class="shrink-0"
        :disabled="selectedCount === 0"
        hover-class="opacity-80"
        @click="emit('checkout')"
      >
        结算({{ selectedCount }})
      </wd-button>
    </view>
  </view>
</template>

<style lang="scss" scoped>
/** 脱离文档流，贴在自定义 tabbar 上方；靠列表一侧为顶边，顶角圆角 */
.cart-checkout-bar {
  position: fixed;
  right: 0;
  bottom: var(--tabbar-total-height);
  left: 0;
  box-sizing: border-box;
  border-top-left-radius: var(--radius-card);
  border-top-right-radius: var(--radius-card);
}

/** 未选：白底+边框；选中：主题色填充，勾为白色 */
.cart-checkout-all-check {
  :deep(.wd-checkbox:not(.is-checked) .wd-checkbox__shape) {
    background-color: var(--color-bg-surface);
    border-color: var(--color-border-default);
  }

  :deep(.wd-checkbox.is-disabled:not(.is-checked) .wd-checkbox__shape) {
    background-color: var(--color-bg-surface);
    border-color: var(--color-border-default);
  }

  :deep(.wd-checkbox.is-checked .wd-checkbox__check) {
    color: var(--color-bg-surface);
  }
}

/** 结算：略大于默认 small，品牌橙渐变底 + 白字 */
.cart-checkout-bar :deep(.wd-button.cart-checkout-settle-btn.is-primary:not(.is-plain)) {
  background: var(--gradient-cart-checkout) !important;
  border-color: transparent !important;
}

.cart-checkout-bar :deep(.wd-button.cart-checkout-settle-btn.is-primary:not(.is-plain) .wd-button__text) {
  color: var(--color-bg-surface);
}
</style>
