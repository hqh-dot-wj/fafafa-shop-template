<script lang="ts" setup>
import WdIcon from 'wot-design-uni/components/wd-icon/wd-icon.vue';

withDefaults(
  defineProps<{
    /** 提示文案，两页默认统一 */
    text?: string;
    /** 按钮文案 */
    buttonText?: string;
  }>(),
  {
    text: '绑定手机号，享受更好的服务体验',
    buttonText: '去绑定',
  },
);

const emit = defineEmits<{
  bind: [e: { detail: { errMsg: string; code?: string } }];
}>();
</script>

<template>
  <view class="phone-bind-tip">
    <wd-icon name="phone" size="32rpx" color="var(--color-brand-primary)" />
    <text class="phone-bind-tip__text">{{ text }}</text>
    <!-- #ifdef MP-WEIXIN -->
    <button class="phone-bind-tip__btn" open-type="getPhoneNumber" @getphonenumber="emit('bind', $event)">
      {{ buttonText }}
    </button>
    <!-- #endif -->
  </view>
</template>

<style lang="scss" scoped>
.phone-bind-tip {
  display: flex;
  align-items: center;
  padding: var(--space-xs) var(--space-md);
  background: linear-gradient(
    135deg,
    var(--color-brand-light) 0%,
    color-mix(in srgb, var(--color-brand-primary) 18%, #fff) 100%
  );
  border-radius: var(--radius-card);

  &__text {
    flex: 1;
    margin-left: var(--space-sm);
    font-size: var(--font-body-md);
    color: var(--color-brand-primary);
    line-height: 1.4;
  }

  &__btn {
    flex-shrink: 0;
    font-size: var(--font-micro);
    padding: 4rpx 18rpx;
    line-height: 1.35;
    background: var(--color-brand-primary);
    color: var(--color-bg-surface);
    border-radius: var(--radius-pill);

    &::after {
      display: none;
    }
  }
}
</style>
