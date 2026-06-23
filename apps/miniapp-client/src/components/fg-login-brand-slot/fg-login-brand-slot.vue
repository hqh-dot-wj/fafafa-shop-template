<template>
  <view class="brand-slot" aria-label="品牌占位区">
    <view class="brand-slot__logo" aria-hidden="true" />
    <view class="brand-slot__text">
      <view class="brand-slot__title-bar" aria-hidden="true" />
      <view class="brand-slot__sub-bar" aria-hidden="true" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.brand-slot {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.brand-slot__logo {
  flex-shrink: 0;
  width: 96rpx;
  height: 96rpx;
  border-radius: var(--radius-card);
  background-color: var(--color-brand-light);
}

.brand-slot__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
}

.brand-slot__title-bar {
  width: 200rpx;
  height: var(--font-title-large);
  border-radius: var(--radius-sm);
  background-color: var(--color-border-default);
}

.brand-slot__sub-bar {
  width: 140rpx;
  height: var(--font-caption);
  border-radius: var(--radius-sm);
  background-color: var(--color-brand-light);
}
</style>
