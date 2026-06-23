<script lang="ts" setup>
import type { MarketingCardModel } from './marketing-card.types';
import { computed } from 'vue';
import OverlayMarketingCard from './overlay-marketing-card.vue';
import SplitMarketingCard from './split-marketing-card.vue';

const props = defineProps<{
  cards: MarketingCardModel[];
  featuredCount?: number;
}>();

const emit = defineEmits<{
  detail: [item: MarketingCardModel];
}>();

const DEFAULT_FEATURED_COUNT = 3;

const effectiveFeaturedCount = computed(() => {
  const n = props.featuredCount;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : DEFAULT_FEATURED_COUNT;
});

/** 判断每张卡使用 overlay 还是 split：cardLayout 显式指定优先，否则按 featuredCount 位次 */
function shouldOverlay(card: MarketingCardModel, index: number): boolean {
  if (card.cardLayout === 'overlay') return true;
  if (card.cardLayout === 'split') return false;
  return index < effectiveFeaturedCount.value;
}
</script>

<template>
  <view class="mkt-zone">
    <template v-for="(card, index) in cards" :key="card.productId">
      <OverlayMarketingCard v-if="shouldOverlay(card, index)" :item="card" @detail="emit('detail', $event)" />
      <SplitMarketingCard v-else :item="card" @detail="emit('detail', $event)" />
    </template>
  </view>
</template>

<style lang="scss" scoped>
.mkt-zone {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
</style>
