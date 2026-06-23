<script lang="ts" setup>
import { computed } from 'vue';

defineOptions({
  name: 'HomePromoBlock',
});

interface PromoProduct {
  id: string;
  image: string;
  title: string;
  price: number;
  originalPrice: number;
  tag?: string;
}

interface PromoCoupon {
  id: string;
  amount: number;
  condition: string;
  label: string;
  /** 卡片下方说明，与卡同列对齐 */
  footLabel: string;
  unlocked: boolean;
}

const products = ref<PromoProduct[]>([
  {
    id: '1',
    image: '/static/logo.svg',
    title: '【35%榴莲果肉】榴莲千层蛋糕',
    price: 4.9,
    originalPrice: 29.9,
    tag: '新人价',
  },
  {
    id: '2',
    image: '/static/logo.svg',
    title: '云南山珍巨无霸菌菇包',
    price: 0.01,
    originalPrice: 19.9,
    tag: '新人价',
  },
  { id: '3', image: '/static/logo.svg', title: '原味发酵酸奶 180g*6', price: 9.9, originalPrice: 24.9, tag: '新人价' },
  { id: '4', image: '/static/logo.svg', title: '新鲜蓝莓 125g/盒', price: 12.9, originalPrice: 29.9, tag: '新人价' },
]);

const coupons = ref<PromoCoupon[]>([
  { id: '1', amount: 10, condition: '满59可用', label: '指定品类', footLabel: '本单可用', unlocked: true },
  { id: '2', amount: 6, condition: '满39可用', label: '全品类通用', footLabel: '下单解锁', unlocked: false },
  { id: '3', amount: 5, condition: '满29可用', label: '全品类通用', footLabel: '第2单解锁', unlocked: false },
]);

const countdown = ref('13:22:54');

/** 仅时分秒三段，避免 v-for 在小程序端异常遍历到字符串单字符；每段一个红底方块 */
const countdownParts = computed((): string[] => {
  const raw = String(countdown.value ?? '').trim();
  if (!raw) {
    return ['00', '00', '00'];
  }
  const parts = raw
    .split(':')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length >= 3) {
    return parts.slice(0, 3).map((s) => s.padStart(2, '0'));
  }
  if (parts.length === 2) {
    return [parts[0]!.padStart(2, '0'), parts[1]!.padStart(2, '0'), '00'];
  }
  if (parts.length === 1 && /^\d+$/.test(parts[0]!)) {
    return [parts[0]!.padStart(2, '0'), '00', '00'];
  }
  return [raw];
});

/** 步骤条红线：从首点到最后点之间，按「自前往后连续已解锁」的段数占满比例（3 点 2 段 → 0/50/100%） */
const couponStepFillPercent = computed((): number => {
  const list = coupons.value;
  if (list.length < 2) {
    return 0;
  }
  let filledSegments = 0;
  for (let i = 0; i < list.length - 1; i++) {
    if (list[i]!.unlocked) {
      filledSegments += 1;
    } else {
      break;
    }
  }
  return (filledSegments / (list.length - 1)) * 100;
});

function formatPrice(price: number) {
  const [intPart, decPart] = price.toFixed(2).split('.');
  return { intPart, decPart: decPart ?? '00' };
}

function onViewAll() {
  // 查看全部：由父页面或路由处理
}

function onAddProduct(item: PromoProduct) {
  // 加购
}

function onUseCoupon(coupon: PromoCoupon) {
  if (!coupon.unlocked) {
    return;
  }
  // 去使用
}

function onCouponHelpExplain() {
  // 累计优惠说明：可接弹层或跳转
}
</script>

<template>
  <view class="promo-block overflow-hidden rounded-card" style="box-shadow: var(--shadow-card)">
    <!-- 上：横向滚动商品区 -->
    <view class="promo-products p-space-md">
      <view class="mb-space-sm flex items-center justify-between gap-space-xs">
        <view class="min-w-0 flex flex-1 items-center gap-space-xs">
          <text class="shrink-0 text-body-md text-ink font-bold leading-snug">新人0.01元起</text>
          <text class="min-w-0 truncate text-micro text-ink-light leading-snug">专享优惠先到先得</text>
        </view>
        <view
          class="clickable flex shrink-0 items-center gap-2rpx text-micro text-ink-light"
          hover-class="opacity-80"
          @tap="onViewAll"
        >
          <text>查看全部</text>
          <view class="i-carbon-chevron-right text-22rpx text-ink-light" />
        </view>
      </view>
      <scroll-view scroll-x class="product-scroll" :show-scrollbar="false" enhanced>
        <view class="product-list flex gap-space-sm">
          <view
            v-for="item in products"
            :key="item.id"
            class="product-card w-200rpx flex flex-shrink-0 flex-col overflow-hidden"
            hover-class="opacity-95"
            @tap="onAddProduct(item)"
          >
            <view class="relative aspect-square w-full overflow-hidden rounded-card bg-fill">
              <image class="h-full w-full" mode="aspectFill" :src="item.image" lazy-load />
              <view v-if="item.tag" class="absolute bottom-0 left-0 rounded-sm bg-primary-light px-space-xs py-2rpx">
                <text class="text-micro text-primary">{{ item.tag }}</text>
              </view>
            </view>
            <view class="product-card-title mt-space-xs w-full">
              {{ item.title }}
            </view>
            <view class="mt-4rpx flex items-center justify-between gap-space-xs">
              <view class="min-w-0 flex flex-1 flex-wrap items-baseline gap-x-4rpx gap-y-2rpx">
                <view class="flex flex-shrink-0 items-baseline text-price">
                  <text class="text-micro">¥</text>
                  <text class="text-body-lg font-bold">{{ formatPrice(item.price).intPart }}</text>
                  <text class="text-caption">.{{ formatPrice(item.price).decPart }}</text>
                </view>
                <text class="text-micro text-ink-lighter line-through">¥{{ item.originalPrice }}</text>
              </view>
              <view
                class="clickable h-48rpx w-48rpx center shrink-0 rounded-full bg-primary"
                hover-class="opacity-80"
                @tap.stop="onAddProduct(item)"
              >
                <text class="text-body-lg text-surface">+</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 下：优惠券区 -->
    <view class="promo-coupons border-t border-line p-space-md">
      <view class="mb-space-sm flex items-center justify-between gap-space-xs">
        <view class="min-w-0 flex flex-1 items-center gap-space-xs">
          <text class="shrink-0 text-body-md text-ink font-bold leading-snug">本单最高省25元</text>
          <view class="min-w-0 flex flex-1 items-center gap-4rpx">
            <text class="min-w-0 truncate text-micro text-ink-light leading-snug">累计最多再省19元</text>
            <view
              class="clickable shrink-0 p-space-xs"
              hover-class="opacity-80"
              role="button"
              aria-label="累计优惠说明"
              @tap.stop="onCouponHelpExplain"
            >
              <view class="coupon-help-mark center">
                <text class="coupon-help-mark__glyph">?</text>
              </view>
            </view>
          </view>
        </view>
        <view class="flex shrink-0 items-center gap-4rpx">
          <!-- 小程序端勿用 template v-for，改用 block，数字用 view 插值避免 text 子节点不渲染 -->
          <view class="flex items-center gap-2rpx">
            <block v-for="(part, idx) in countdownParts" :key="`cd-${idx}`">
              <text v-if="idx > 0" class="text-micro text-ink-light leading-none">:</text>
              <view class="countdown-seg">
                {{ part }}
              </view>
            </block>
          </view>
          <view class="flex items-center gap-2rpx">
            <text class="text-micro text-ink-light leading-snug">后过期</text>
            <view class="i-carbon-chevron-right text-22rpx text-ink-light" />
          </view>
        </view>
      </view>
      <view class="coupon-stack w-full flex flex-col">
        <!-- 第一行：三张券卡，与下行圆点、末行文案同一列宽与 space-between -->
        <view class="coupon-row">
          <view v-for="coupon in coupons" :key="coupon.id" class="coupon-col flex flex-col items-center">
            <view
              class="coupon-item w-full flex flex-col items-center overflow-hidden rounded-card"
              :class="{ 'coupon-item--locked': !coupon.unlocked }"
            >
              <view class="coupon-item__inner w-full flex flex-col items-center">
                <text class="coupon-item__meta text-caption">{{ coupon.label }}</text>
                <view class="coupon-item__amount-row mt-4rpx flex items-baseline">
                  <text class="coupon-item__amount-symbol text-caption">¥</text>
                  <text class="coupon-item__amount-num text-title-lg font-bold">{{ coupon.amount }}</text>
                </view>
                <text class="coupon-item__meta coupon-item__meta--small mt-2rpx text-micro">{{
                  coupon.condition
                }}</text>
                <view
                  class="coupon-item__action clickable mt-space-sm"
                  :class="{ 'coupon-item__action--use': coupon.unlocked }"
                  hover-class="opacity-80"
                  @tap="onUseCoupon(coupon)"
                >
                  <text
                    v-if="coupon.unlocked"
                    class="coupon-item__action-text coupon-item__action-text--use font-medium"
                  >
                    去使用
                  </text>
                  <text v-else class="coupon-item__action-text font-medium">待解锁</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <!-- 第二行：整根横线（不断开）+ 三颗圆点，夹在卡片与底部说明之间 -->
        <view class="coupon-row coupon-row--track" aria-hidden="true">
          <view class="coupon-track__rails">
            <view class="coupon-track__line-bg" />
            <view class="coupon-track__line-fill" :style="{ width: `${couponStepFillPercent}%` }" />
          </view>
          <view
            v-for="coupon in coupons"
            :key="`step-${coupon.id}`"
            class="coupon-col flex items-center justify-center"
          >
            <view class="coupon-track__dot" :class="{ 'coupon-track__dot--active': coupon.unlocked }" />
          </view>
        </view>
        <!-- 第三行：本单可用 / 下单解锁 / 第2单解锁 -->
        <view class="coupon-row">
          <view v-for="coupon in coupons" :key="`foot-${coupon.id}`" class="coupon-col flex flex-col items-center">
            <text class="coupon-col__foot text-micro text-ink-light">{{ coupon.footLabel }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.promo-block {
  margin: 0 var(--space-lg);
  /* Coupon Card：上浅 #FFD8D1 → 下深 #F38F8E（用 to top + 深→浅，避免 180deg 在小程序端上下颠倒） */
  background: #f7e5e2;
}

/** 商品区：纯白底、外扩 10rpx 露淡粉底 + 圆角（与设计 token 圆角一致） */
.promo-products {
  box-sizing: border-box;
  margin: 10rpx;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-bg-surface);
}

.product-scroll {
  width: 100%;
  white-space: nowrap;
  /* 与商品区一致，避免 scroll-view 露粉/露灰 */
  background-color: var(--color-bg-surface);
}

.product-list {
  display: inline-flex;
  padding-bottom: 8rpx;
}

/**
 * 与上方商品图同宽（卡片内 100%），字号略小，单行超出省略（小程序兼容）
 */
.product-card-title {
  box-sizing: border-box;
  flex-shrink: 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-caption);
  line-height: var(--lh-normal);
  color: var(--color-text-primary);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.clickable:active {
  opacity: 0.8;
}

/** 倒计时数字块：近似正方形 + 中心浅（surface）向四周过渡到价格红 */
.countdown-seg {
  box-sizing: border-box;
  display: flex;
  width: 36rpx;
  height: 36rpx;
  min-width: 36rpx;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: var(--font-micro);
  font-weight: 600;
  line-height: 1;
  color: var(--color-bg-surface);
  /* 底：价格红；上层：左上角小高光，向四周淡出为透明，避免整体发白 */
  background-color: var(--color-price);
  background-image: radial-gradient(circle 52% at 32% 28%, var(--color-bg-surface) 0%, transparent 64%);
}

/** 圆圈内问号（帮助说明），与设计 token 一致 */
.coupon-help-mark {
  box-sizing: border-box;
  width: 28rpx;
  height: 28rpx;
  border: 1rpx solid var(--color-border-default);
  border-radius: var(--radius-pill);
}

.coupon-help-mark__glyph {
  font-size: var(--font-micro);
  line-height: 1;
  color: var(--color-text-tertiary);
  font-weight: 600;
}

/** 三行同一套列：space-between + 固定槽宽，保证卡 / 点 / 文案竖向对齐 */
.coupon-stack {
  box-sizing: border-box;
  width: 100%;
}

.coupon-row {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-lg);
}

/** 步骤条行：横线从首点圆心连到末点圆心，不断开；圆点盖住线并 z-index 在上 */
.coupon-row--track {
  position: relative;
  align-items: center;
  margin-top: var(--space-sm);
  margin-bottom: var(--space-sm);
  min-height: 32rpx;
}

.coupon-track__rails {
  position: absolute;
  top: 50%;
  right: 68rpx;
  left: 68rpx;
  height: 4rpx;
  transform: translateY(-50%);
  pointer-events: none;
}

.coupon-track__line-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-pill);
  background-color: var(--color-border-default);
}

.coupon-track__line-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  max-width: 100%;
  border-radius: var(--radius-pill);
  background-color: var(--color-price);
}

.coupon-track__dot {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  flex-shrink: 0;
  width: 16rpx;
  height: 16rpx;
  border: 2rpx solid var(--color-border-default);
  border-radius: var(--radius-pill);
  background-color: var(--color-bg-surface);
}

.coupon-track__dot--active {
  border-color: var(--color-price);
  background-color: var(--color-price);
}

.coupon-col {
  box-sizing: border-box;
  flex: 0 0 136rpx;
  width: 136rpx;
  min-width: 0;
}

.coupon-col__foot {
  box-sizing: border-box;
  width: 100%;
  line-height: var(--lh-normal);
  text-align: center;
}

.coupon-item {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  background-color: var(--color-price);
}

.coupon-item__inner {
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-xs) calc(var(--space-xs) / 2);
}

.coupon-item--locked {
  opacity: 0.92;
}

.coupon-item__meta {
  box-sizing: border-box;
  max-width: 100%;
  overflow: hidden;
  line-height: var(--lh-normal);
  color: rgba(255, 255, 255, 0.82);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.coupon-item__meta--small {
  color: rgba(255, 255, 255, 0.78);
}

.coupon-item__amount-row {
  color: rgba(255, 230, 228, 0.98);
}

.coupon-item__amount-symbol {
  opacity: 0.95;
}

/**
 * 扁胶囊。待解锁：半透明白底 + 白字；去使用：纯白底 + 价格红字。
 * 不用 width:50%：卡变窄时百分比会跟着缩太小；改为 auto + min-width 保证可点宽度。
 */
.coupon-item__action {
  box-sizing: border-box;
  display: flex;
  width: auto;
  min-width: 100rpx;
  max-width: 100%;
  margin-right: auto;
  margin-left: auto;
  align-items: center;
  justify-content: center;
  padding: calc(var(--space-xs) / 2) var(--space-sm);
  overflow: hidden;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  background-color: rgba(255, 255, 255, 0.38);
}

.coupon-item__action--use {
  background-color: var(--color-bg-surface);
}

.coupon-item__action-text {
  flex-shrink: 0;
  font-size: var(--font-micro);
  line-height: 1;
  white-space: nowrap;
  color: var(--color-bg-surface);
}

.coupon-item__action-text--use {
  color: var(--color-price);
}
</style>
