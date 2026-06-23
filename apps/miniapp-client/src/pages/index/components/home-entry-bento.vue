<script lang="ts" setup>
defineOptions({
  name: 'HomeEntryBento',
});

type EntryKey = 'interest' | 'mall' | 'coop' | 'review';

/** 与 `src/static/home` 资源一一对应 */
const entryImageSrc: Record<EntryKey, string> = {
  interest: '/static/home/entry-interest.png',
  review: '/static/home/entry-review.png',
  coop: '/static/home/entry-coop.png',
  mall: '/static/home/entry-mall.png',
};

function onEntryTap(key: EntryKey) {
  // 后续可接分包路由或 H5 链接
  void key;
}
</script>

<template>
  <view class="entry-bento">
    <!-- 大：兴趣上门 -->
    <view
      class="entry-card entry-card--large entry-card--interest"
      hover-class="entry-card--pressed"
      role="button"
      aria-label="兴趣上门"
      @tap="onEntryTap('interest')"
    >
      <image
        class="entry-card__art entry-card__art--interest"
        :src="entryImageSrc.interest"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view class="entry-card__copy">
        <text class="entry-card__title">兴趣上门</text>
        <text class="entry-card__sub">预约到家 · 丰富生活</text>
      </view>
    </view>

    <!-- 小：精彩回顾 -->
    <view
      class="entry-card entry-card--small entry-card--mall"
      hover-class="entry-card--pressed"
      role="button"
      aria-label="精彩回顾"
      @tap="onEntryTap('review')"
    >
      <image
        class="entry-card__art entry-card__art--sm"
        :src="entryImageSrc.review"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view class="entry-card__copy">
        <text class="entry-card__title entry-card__title--sm">精彩回顾</text>
        <text class="entry-card__sub entry-card__sub--sm">活动瞬间 · 值得收藏</text>
      </view>
    </view>

    <!-- 小：合作申请（相对上移形成错落） -->
    <view
      class="entry-card entry-card--small entry-card--coop"
      hover-class="entry-card--pressed"
      role="button"
      aria-label="合作申请"
      @tap="onEntryTap('coop')"
    >
      <image
        class="entry-card__art entry-card__art--sm"
        :src="entryImageSrc.coop"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view class="entry-card__copy">
        <text class="entry-card__title entry-card__title--sm">合作申请</text>
        <text class="entry-card__sub entry-card__sub--sm">共赢伙伴</text>
      </view>
    </view>

    <!-- 大：银发商城 -->
    <view
      class="entry-card entry-card--large entry-card--review"
      hover-class="entry-card--pressed"
      role="button"
      aria-label="银发商城"
      @tap="onEntryTap('mall')"
    >
      <image
        class="entry-card__art entry-card__art--mall"
        :src="entryImageSrc.mall"
        mode="aspectFit"
        aria-hidden="true"
      />
      <view class="entry-card__copy">
        <text class="entry-card__title">银发商城</text>
        <text class="entry-card__sub">好物精选 · 一站购齐</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.entry-bento {
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 1fr 240rpx;
  grid-template-rows: auto auto auto;
  gap: var(--space-sm);
}

.entry-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-end;
  padding: var(--space-md);
  overflow: hidden;
  border-radius: var(--radius-popup);
  background-color: var(--color-bg-surface);
  box-shadow: var(--shadow-card);
}

.entry-card__art {
  position: absolute;
  z-index: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.entry-card__art--interest {
  width: 220rpx;
  height: 220rpx;
}

.entry-card__art--sm {
  width: 112rpx;
  height: 112rpx;
}

.entry-card__art--mall {
  width: 200rpx;
  height: 200rpx;
}

/** 文案整卡宽，插图绝对定位叠在下层，不挤占排版宽度 */
.entry-card__copy {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
}

.entry-card--pressed {
  opacity: 0.88;
}

/** 左列大卡片：跨两行 */
.entry-card--interest {
  grid-column: 1;
  grid-row: 1 / span 2;
  min-height: 300rpx;
}

/** 右上小卡（精彩回顾） */
.entry-card--mall {
  grid-column: 2;
  grid-row: 1;
  min-height: 132rpx;
  align-self: start;
}

/** 右下小卡：上移与上卡错落 */
.entry-card--coop {
  grid-column: 2;
  grid-row: 2;
  min-height: 132rpx;
  align-self: end;
  margin-top: calc(-1 * var(--space-md));
}

/** 底部通栏大卡（银发商城） */
.entry-card--review {
  grid-column: 1 / -1;
  grid-row: 3;
  min-height: 168rpx;
}

.entry-card__title {
  font-size: var(--font-title-medium);
  font-weight: 600;
  line-height: var(--lh-snug);
  color: var(--color-text-primary);
}

.entry-card__title--sm {
  font-size: var(--font-body-large);
}

.entry-card__sub {
  margin-top: var(--space-xs);
  font-size: var(--font-caption);
  line-height: var(--lh-normal);
  color: var(--color-text-secondary);
}

.entry-card__sub--sm {
  font-size: var(--font-body-medium);
}
</style>
