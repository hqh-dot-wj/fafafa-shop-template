<script lang="ts" setup>
import type { MarketingCardModel } from './marketing-card.types';
import { computed } from 'vue';
import MarketingCardAction from './marketing-card-action.vue';
import MarketingPriceLine from './marketing-price-line.vue';

const props = defineProps<{
  item: MarketingCardModel;
}>();

const emit = defineEmits<{
  detail: [item: MarketingCardModel];
}>();

const groupSlotsBadgeText = computed(() => {
  if (props.item.activityKind !== 'group') return '';
  const status = String(props.item.teamStatus || 'RECRUITING').toUpperCase();
  const toForm = props.item.remainToForm;
  if (status === 'RECRUITING' && toForm != null && toForm > 0) {
    return `还差${toForm}人`;
  }
  const cap = props.item.remainingSlots;
  if ((status === 'FORMED' || status === 'IN_CLASS') && cap != null && cap > 0) {
    return `剩余${cap}名额`;
  }
  return '';
});

const groupFooterLine = computed(() => {
  if (props.item.activityKind !== 'group') return '';
  const left: string[] = [];
  if (props.item.groupClassAddress) left.push(props.item.groupClassAddress);
  if (props.item.groupClassTime) left.push(props.item.groupClassTime);

  const joinPart = props.item.groupJoinHint || props.item.secondaryHint || '';

  if (left.length > 0 && joinPart) return `${left.join(' · ')} | ${joinPart}`;
  if (left.length > 0) return left.join(' · ');
  return joinPart;
});

const showGroupFooterInfo = computed(() => props.item.activityKind === 'group' && Boolean(groupFooterLine.value));
</script>

<template>
  <view class="overlay-card" hover-class="opacity-90" @click="emit('detail', item)">
    <view class="overlay-card__image-frame">
      <image
        class="overlay-card__image"
        :src="item.imageUrl || '/static/images/placeholder.png'"
        mode="aspectFill"
        lazy-load
      />
      <view v-if="item.badgeText" class="overlay-card__badge">
        <text>{{ item.badgeText }}</text>
      </view>

      <!-- 拼课：图片上叠价格 + 还差N人 -->
      <template v-if="item.activityKind === 'group'">
        <view class="overlay-card__gradient" />
        <view class="overlay-card__overlay-content">
          <text class="overlay-card__title line-clamp-1">{{ item.title }}</text>
          <view class="overlay-card__row">
            <MarketingPriceLine
              :price-label="item.priceLabel"
              :current-price="item.currentPrice"
              :original-price="item.originalPrice"
              size="lg"
            />
            <view v-if="groupSlotsBadgeText" class="overlay-card__slots-badge">
              <text>{{ groupSlotsBadgeText }}</text>
            </view>
          </view>
        </view>
      </template>

      <!-- 秒杀：图片上叠价格 + 库存/倒计时 -->
      <template v-else-if="item.activityKind === 'flash'">
        <view class="overlay-card__gradient" />
        <view class="overlay-card__overlay-content">
          <text class="overlay-card__title line-clamp-1">{{ item.title }}</text>
          <MarketingPriceLine
            :price-label="item.priceLabel"
            :current-price="item.currentPrice"
            :original-price="item.originalPrice"
            size="lg"
          />
          <text v-if="item.secondaryHint" class="overlay-card__stock-hint">{{ item.secondaryHint }}</text>
        </view>
      </template>

      <!-- 默认：原样 -->
      <template v-else>
        <view class="overlay-card__gradient" />
        <view class="overlay-card__overlay-content">
          <text class="overlay-card__title line-clamp-2">{{ item.title }}</text>
          <MarketingPriceLine
            :price-label="item.priceLabel"
            :current-price="item.currentPrice"
            :original-price="item.originalPrice"
            size="lg"
          />
        </view>
      </template>
    </view>

    <!-- 拼课大卡 footer：灰色信息条 + 参团按钮（仅大卡） -->
    <view v-if="item.activityKind === 'group'" class="overlay-card__footer">
      <view v-if="showGroupFooterInfo" class="overlay-card__info-box">
        <text class="overlay-card__info-text line-clamp-2">{{ groupFooterLine }}</text>
      </view>
      <MarketingCardAction :activity-kind="item.activityKind" :text="item.actionText" @click="emit('detail', item)" />
    </view>

    <!-- 秒杀 footer：CTA -->
    <view v-else-if="item.activityKind === 'flash'" class="overlay-card__footer overlay-card__footer--compact">
      <MarketingCardAction :activity-kind="item.activityKind" :text="item.actionText" @click="emit('detail', item)" />
    </view>

    <!-- 默认 footer -->
    <view v-else class="overlay-card__footer">
      <text v-if="item.explain" class="overlay-card__explain line-clamp-1">{{ item.explain }}</text>
      <MarketingCardAction :activity-kind="item.activityKind" :text="item.actionText" @click="emit('detail', item)" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.overlay-card {
  overflow: hidden;
  border-radius: var(--radius-card, 16rpx);
  background: var(--color-bg-surface);
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.08);
}

.overlay-card__image-frame {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 100%;
  overflow: hidden;
  background: var(--color-bg-body);
}

.overlay-card__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.overlay-card__badge {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  z-index: 2;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill, 999rpx);
  background: var(--color-price);
  color: var(--color-bg-surface);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.4;
}

.overlay-card__gradient {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  height: 55%;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
}

.overlay-card__overlay-content {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
}

.overlay-card__title {
  color: var(--color-bg-surface);
  font-size: 30rpx;
  font-weight: 600;
  line-height: 1.45;
  text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.3);
}

.overlay-card__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.overlay-card__slots-badge {
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  border-radius: var(--radius-pill, 999rpx);
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(8rpx);
  color: var(--color-bg-surface);
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.4;
}

.overlay-card__stock-hint {
  color: var(--color-bg-surface);
  font-size: 22rpx;
  line-height: 1.4;
  opacity: 0.85;
}

/* overlay 内 price-line 白色适配 */
.overlay-card__overlay-content :deep(.mkt-price-line__row) {
  color: var(--color-bg-surface);
}

.overlay-card__overlay-content :deep(.mkt-price-line__origin) {
  color: var(--color-bg-surface);
  opacity: 0.7;
}

.overlay-card__overlay-content :deep(.mkt-price-line__label) {
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-bg-surface);
}

.overlay-card__footer {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
}

.overlay-card__footer--compact {
  padding: 16rpx 24rpx;
}

.overlay-card__explain {
  color: var(--color-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
}

.overlay-card__info-box {
  padding: 20rpx 24rpx;
  border-radius: var(--radius-sm, 8rpx);
  background: var(--color-bg-body, #f5f5f5);
}

.overlay-card__info-text {
  color: var(--color-text-primary);
  font-size: 24rpx;
  line-height: 1.5;
}
</style>
