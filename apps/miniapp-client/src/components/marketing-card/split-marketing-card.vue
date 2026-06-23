<script lang="ts" setup>
import type { MarketingCardModel } from './marketing-card.types';
import MarketingCardAction from './marketing-card-action.vue';
import MarketingPriceLine from './marketing-price-line.vue';

const props = withDefaults(
  defineProps<{
    item: MarketingCardModel;
    /** 分类页等窄栏：缩小内边距与主图尺寸 */
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const emit = defineEmits<{
  detail: [item: MarketingCardModel];
}>();
</script>

<template>
  <view
    class="split-card"
    :class="{ 'split-card--compact': compact }"
    hover-class="opacity-90"
    @click="emit('detail', item)"
  >
    <view class="split-card__image-frame">
      <image
        class="split-card__image"
        :src="item.imageUrl || '/static/images/placeholder.png'"
        mode="aspectFill"
        lazy-load
      />
      <view v-if="item.badgeText" class="split-card__badge">
        <text>{{ item.badgeText }}</text>
      </view>
    </view>
    <view class="split-card__body">
      <text class="split-card__title line-clamp-2">{{ item.title }}</text>
      <text v-if="item.explain && item.activityKind !== 'group'" class="split-card__explain line-clamp-1">
        {{ item.explain }}
      </text>
      <view class="split-card__bottom">
        <MarketingPriceLine
          :price-label="item.priceLabel"
          :current-price="item.currentPrice"
          :original-price="item.originalPrice"
          size="md"
        />
        <MarketingCardAction
          :activity-kind="item.activityKind"
          :text="item.actionText"
          compact
          @click="emit('detail', item)"
        />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.split-card {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: var(--radius-card, 16rpx);
  background: var(--color-bg-surface);
  box-shadow: 0 4rpx 16rpx rgba(15, 23, 42, 0.06);
}

.split-card__image-frame {
  position: relative;
  flex-shrink: 0;
  width: 160rpx;
  height: 160rpx;
  overflow: hidden;
  border-radius: var(--radius-sm, 8rpx);
  background: var(--color-bg-body);
}

.split-card__image {
  width: 100%;
  height: 100%;
}

.split-card__badge {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 12rpx;
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-price);
  color: var(--color-bg-surface);
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.4;
}

.split-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.split-card__title {
  color: var(--color-text-primary);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.45;
}

.split-card__explain {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.split-card__bottom {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: auto;
}

.split-card--compact {
  gap: 16rpx;
  padding: 16rpx;
  box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.05);
}

.split-card--compact .split-card__image-frame {
  width: 144rpx;
  height: 144rpx;
}

.split-card--compact .split-card__title {
  font-size: 28rpx;
}

.split-card--compact .split-card__explain {
  font-size: 22rpx;
}

.split-card--compact .split-card__bottom {
  gap: 8rpx;
}
</style>
