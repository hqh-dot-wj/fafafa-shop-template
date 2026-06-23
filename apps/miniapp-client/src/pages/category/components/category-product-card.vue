<script lang="ts" setup>
import type { MarketingCardModel } from '@/components/marketing-card/marketing-card.types';
import MarketingCardAction from '@/components/marketing-card/marketing-card-action.vue';
import MarketingPriceLine from '@/components/marketing-card/marketing-price-line.vue';

defineProps<{
  item: MarketingCardModel;
}>();

const emit = defineEmits<{
  detail: [item: MarketingCardModel];
}>();
</script>

<template>
  <view class="category-product-card" hover-class="opacity-90" @click="emit('detail', item)">
    <view class="category-product-card__image-wrap">
      <image
        class="category-product-card__image"
        :src="item.imageUrl || '/static/images/placeholder.png'"
        mode="aspectFill"
        lazy-load
      />
      <view v-if="item.badgeText" class="category-product-card__badge">
        <text>{{ item.badgeText }}</text>
      </view>
    </view>
    <view class="category-product-card__body">
      <text class="category-product-card__title line-clamp-2">{{ item.title }}</text>
      <MarketingPriceLine
        :price-label="item.priceLabel"
        :current-price="item.currentPrice"
        :original-price="item.originalPrice"
        size="xl"
      />
      <MarketingCardAction
        :activity-kind="item.activityKind"
        :text="item.actionText"
        large
        @click="emit('detail', item)"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.category-product-card {
  overflow: hidden;
  border-radius: var(--radius-card);
  background: var(--color-bg-surface);
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.07);
}

/** 1:1 主图（padding-top 兼容小程序） */
.category-product-card__image-wrap {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 100%;
  overflow: hidden;
  background: var(--color-bg-category-page);
}

.category-product-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.category-product-card__badge {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  max-width: calc(100% - var(--space-sm));
  padding: 6rpx 14rpx;
  border-radius: var(--radius-pill);
  background: var(--color-price);
  color: var(--color-bg-surface);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.35;
}

.category-product-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-md);
  box-sizing: border-box;
}

.category-product-card__title {
  color: var(--color-text-primary);
  font-size: 34rpx;
  font-weight: 600;
  line-height: 1.4;
}
</style>
