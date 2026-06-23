<script lang="ts" setup>
import type { ActivityKind } from './marketing-card.types';

withDefaults(
  defineProps<{
    activityKind: ActivityKind;
    text: string;
    compact?: boolean;
    /** 分类页等：更高按钮、更大字号 */
    large?: boolean;
  }>(),
  {
    compact: false,
    large: false,
  },
);

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <button
    class="mkt-action"
    :class="[`mkt-action--${activityKind}`, compact ? 'mkt-action--compact' : '', large ? 'mkt-action--large' : '']"
    @click.stop="emit('click')"
  >
    {{ text }}
  </button>
</template>

<style lang="scss" scoped>
.mkt-action {
  width: 100%;
  height: 72rpx;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-card, 16rpx);
  background: var(--color-brand-primary);
  color: var(--color-bg-surface);
  font-size: 28rpx;
  font-weight: 600;
  line-height: 72rpx;
  text-align: center;
}

.mkt-action::after {
  border: none;
}

.mkt-action--compact {
  height: 56rpx;
  border-radius: var(--radius-pill, 999rpx);
  font-size: 24rpx;
  line-height: 56rpx;
}

.mkt-action--large {
  height: 80rpx;
  border-radius: var(--radius-pill, 999rpx);
  font-size: 32rpx;
  line-height: 80rpx;
}

.mkt-action--group,
.mkt-action--flash,
.mkt-action--member,
.mkt-action--normal {
  background: var(--color-brand-primary);
}
</style>
