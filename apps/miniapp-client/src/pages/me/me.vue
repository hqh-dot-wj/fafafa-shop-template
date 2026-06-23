<script lang="ts" setup>
import { onShow, onUnload } from '@dcloudio/uni-app';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { getPointsBalance } from '@/api/points';
import PhoneBindTip from '@/components/phone-bind-tip/phone-bind-tip.vue';
import { usePhoneBindTip } from '@/composables/use-phone-bind';
import { useCustomNavBar } from '@/hooks/useCustomNavBar';
import { useUserStore } from '@/store';
import { useAuthStore } from '@/store/auth';
import { useTokenStore } from '@/store/token';
import { getMemberPhone } from '@/utils/member-phone';

definePage({
  style: {
    /** 透明自定义导航 + 滚动渐显，与首页一致 */
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
    /** 与 design-tokens --color-mine-page-tail 一致（对齐首页 page-wrap 兜底色写法） */
    backgroundColor: '#f5f6fa',
    /** 与分类/购物车一致：禁止页面容器滚动，避免 MP/H5 双滚动条（见 AGENTS.md） */
    disableScroll: true,
  },
});

const { layout } = useCustomNavBar();

/** 顶区为透明导航预留：与胶囊底对齐，渐变从屏顶起画在 user 区背后 */
const navPlaceholderPx = computed(() => layout.value.firstRowBottomPx);

/** 导航白底 0～1，由 scroll-view 滚动驱动（页面 onPageScroll 不会在 scroll-view 内触发） */
const navBarBgOpacity = ref(0);
const navBgOpaqueThresholdPx = computed(() => Math.max(64, Math.round(layout.value.firstRowBottomPx + 16)));

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

let scrollFlushTimer: ReturnType<typeof setTimeout> | 0 = 0;
let pendingScrollTop = 0;

function flushNavBgOpacity() {
  scrollFlushTimer = 0;
  navBarBgOpacity.value = clamp01(pendingScrollTop / navBgOpaqueThresholdPx.value);
}

function onMineScroll(e: { detail?: { scrollTop?: number } }) {
  pendingScrollTop = e.detail?.scrollTop ?? 0;
  if (scrollFlushTimer !== 0) {
    return;
  }
  scrollFlushTimer = setTimeout(flushNavBgOpacity, 0);
}

onUnload(() => {
  if (scrollFlushTimer !== 0) {
    clearTimeout(scrollFlushTimer);
    scrollFlushTimer = 0;
  }
});

const userStore = useUserStore();
const tokenStore = useTokenStore();
const authStore = useAuthStore();

const { userInfo } = storeToRefs(userStore);
const { showPhoneBindTip, handleBindPhone } = usePhoneBindTip();
const displayPhone = computed(() => getMemberPhone(userInfo.value));

// 统一登录入口：H5 走登录页，小程序走全局授权弹窗
async function handleLogin() {
  authStore.openAuthModal();
}

function handleLogout() {
  uni.showModal({
    title: '提示',
    content: '确定要退出登录吗？',
    success: (res) => {
      if (res.confirm) {
        tokenStore.logout();
        uni.showToast({
          title: '退出登录成功',
          icon: 'success',
        });
      }
    },
  });
}

function goTeam() {
  uni.navigateTo({ url: '/pages/upgrade/team' });
}

function goReferralCode() {
  uni.navigateTo({ url: '/pages/upgrade/referral-code' });
}

function goAiContent() {
  uni.navigateTo({ url: '/pages-ai/generate/index' });
}

function maskPhone(phone: string) {
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function onUserToolbarInfo() {
  uni.showToast({ title: '敬请期待', icon: 'none' });
}

function onUserToolbarQrcode() {
  if (!tokenStore.hasLogin) {
    void handleLogin();
    return;
  }
  uni.navigateTo({ url: '/pages/upgrade/referral-code' });
}

function onUserToolbarSetting() {
  uni.showToast({ title: '敬请期待', icon: 'none' });
}

/** 会员福利：5 项，横向滚动（可后续接接口） */
const memberWelfareTags = ['会员专属券', '免运费', '专属客服', '积分加倍', '生日礼包'] as const;

function onOpenMemberWelfare() {
  uni.showToast({ title: '敬请期待', icon: 'none' });
}

/** 资产四宫格占位，后续对接优惠券 / 积分 / 礼品卡 / 余额接口 */
const mineStats = ref({
  couponQty: 0,
  points: 0,
  giftCardQty: 0,
  amount: '0.00',
});

onShow(() => {
  void loadMinePointsBalance();
});

async function loadMinePointsBalance() {
  if (!tokenStore.hasLogin) {
    mineStats.value.points = 0;
    return;
  }
  try {
    const pointsBalance = await getPointsBalance({ hideErrorToast: true });
    mineStats.value.points = pointsBalance.availablePoints;
  } catch {
    mineStats.value.points = 0;
  }
}

function goPointsDetail() {
  if (!tokenStore.hasLogin) {
    void handleLogin();
    return;
  }
  uni.navigateTo({ url: '/pages/me/points' });
}

/** 订单入口：与订单列表 tab 对齐（0 全部 / 1 待支付 / 2 已支付 / 3 已完成） */
function goOrderEntry(kind: 'pending' | 'progress' | 'refund' | 'all') {
  if (!tokenStore.hasLogin) {
    void handleLogin();
    return;
  }
  const tab = kind === 'pending' ? '1' : kind === 'progress' ? '2' : kind === 'refund' ? '0' : '0';
  uni.navigateTo({ url: `/pages/order/list?tab=${tab}` });
}

/** 订单下方营销横滑：7:3 白底卡片，左主副文案 + 右图标（可后续接跳转） */
const minePromoTiles = [
  {
    key: 'follow-coupon',
    title: '关注领券',
    desc: '关注即送优惠券',
    icon: 'subscribe' as const,
  },
  {
    key: 'invite',
    title: '邀请有礼',
    desc: '邀请好友同享好礼',
    icon: 'share' as const,
  },
  {
    key: 'free-trial',
    title: '免费体验',
    desc: '新用户限时体验',
    icon: 'play-circle' as const,
  },
];

function onMinePromoTile(key: (typeof minePromoTiles)[number]['key']) {
  if (key === 'invite') {
    uni.navigateTo({ url: '/pages/invite/index' });
    return;
  }
  uni.showToast({ title: '敬请期待', icon: 'none' });
}

/** 营销区下方：功能入口列表（左图标+文案，右箭头） */
type MineMenuKey = 'cart' | 'address' | 'profile' | 'ai' | 'companion';

const mineMenuItems: {
  key: MineMenuKey;
  title: string;
  icon: 'shop' | 'location' | 'user' | 'edit' | 'usergroup-add';
}[] = [
  { key: 'cart', title: '购物车', icon: 'shop' },
  { key: 'address', title: '收货地址', icon: 'location' },
  { key: 'profile', title: '个人信息', icon: 'user' },
  { key: 'ai', title: 'AI创作', icon: 'edit' },
  { key: 'companion', title: '陪伴师入住', icon: 'usergroup-add' },
];

function onMineMenuItem(key: MineMenuKey) {
  switch (key) {
    case 'cart':
      uni.switchTab({ url: '/pages/cart/cart' });
      break;
    case 'address':
      uni.navigateTo({ url: '/pages/address/list' });
      break;
    case 'profile':
      uni.showToast({ title: '敬请期待', icon: 'none' });
      break;
    case 'ai':
      if (!tokenStore.hasLogin) {
        void handleLogin();
        return;
      }
      goAiContent();
      break;
    case 'companion':
      uni.showToast({ title: '敬请期待', icon: 'none' });
      break;
    default:
      break;
  }
}
</script>

<template>
  <!-- 微信要求 page-meta 为页面首节点且禁止 wx:if/v-if；与 category.vue 一致禁止整页滚动 -->
  <page-meta page-style="overflow: hidden;" />
  <!--
    布局策略对齐 category.vue + AGENTS.md：根容器固定高度 + overflow:hidden；
    仅内层 scroll-view 可滚，短内容不出现外层滚动条；H5 下 fixed 避开 uni-page-body 整页滚。
  -->
  <view class="mine-page">
    <fg-me-custom-nav-bar
      :scroll-background-opacity="navBarBgOpacity"
      :has-login="tokenStore.hasLogin"
      :avatar-url="userInfo.avatar || '/static/images/default-avatar.png'"
      :nickname="userInfo.nickname || '微信用户'"
      @login="handleLogin"
    />
    <scroll-view scroll-y :show-scrollbar="false" :enable-flex="true" class="mine-scroll" @scroll="onMineScroll">
      <view class="mine-hero" :style="{ paddingTop: `${navPlaceholderPx}px` }">
        <!-- 用户信息 -->
        <view class="user-section">
          <view class="user-section__main">
            <template v-if="tokenStore.hasLogin">
              <image class="avatar" :src="userInfo.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
              <view class="user-info">
                <text class="nickname">{{ userInfo.nickname || '微信用户' }}</text>
                <text v-if="displayPhone" class="phone">
                  {{ maskPhone(displayPhone) }}
                </text>
              </view>
            </template>
            <template v-else>
              <image class="avatar" src="/static/images/default-avatar.png" mode="aspectFill" />
              <view class="user-info">
                <text class="login-tip" @click="handleLogin">点击登录</text>
              </view>
            </template>
          </view>
          <view class="user-section__tools">
            <view class="user-section__tool" hover-class="user-section__tool--active" @click="onUserToolbarInfo">
              <wd-icon name="info-circle" size="32rpx" class="text-ink" />
            </view>
            <view class="user-section__tool" hover-class="user-section__tool--active" @click="onUserToolbarQrcode">
              <wd-icon name="qrcode" size="32rpx" class="text-ink" />
            </view>
            <view class="user-section__tool" hover-class="user-section__tool--active" @click="onUserToolbarSetting">
              <wd-icon name="setting" size="32rpx" class="text-ink" />
            </view>
          </view>
        </view>

        <!-- 会员福利：光泽黑金卡片 + 5 项白底竖条横向滚动 -->
        <view class="member-welfare-card">
          <view class="member-welfare-card__inner">
            <view class="member-welfare-card__header">
              <text class="member-welfare-card__title">会员福利</text>
              <button
                class="member-welfare-card__cta"
                hover-class="member-welfare-card__cta--active"
                @click="onOpenMemberWelfare"
              >
                开通送好礼
              </button>
            </view>
            <scroll-view scroll-x :show-scrollbar="false" :enable-flex="true" class="member-welfare-card__scroll">
              <view class="member-welfare-card__track">
                <view v-for="(tag, idx) in memberWelfareTags" :key="`${idx}-${tag}`" class="member-welfare-card__tile">
                  <text class="member-welfare-card__tile-text">{{ tag }}</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>
        <!-- 资产概览：白底圆角四格，上数字下文案 -->
        <view class="mine-stats-card">
          <view class="mine-stats-card__item">
            <text class="mine-stats-card__value">{{ mineStats.couponQty }}</text>
            <text class="mine-stats-card__label">优惠券码</text>
          </view>
          <view class="mine-stats-card__item" hover-class="mine-stats-card__item--active" @click="goPointsDetail">
            <text class="mine-stats-card__value">{{ mineStats.points }}</text>
            <text class="mine-stats-card__label">积分</text>
          </view>
          <view class="mine-stats-card__item">
            <text class="mine-stats-card__value">{{ mineStats.giftCardQty }}</text>
            <text class="mine-stats-card__label">礼品卡</text>
          </view>
          <view class="mine-stats-card__item">
            <text class="mine-stats-card__value">{{ mineStats.amount }}</text>
            <text class="mine-stats-card__label">金额</text>
          </view>
        </view>

        <!-- 手机号绑定提示：订单入口上方（仅小程序且未绑 mobile） -->
        <phone-bind-tip v-if="showPhoneBindTip" class="mine-phone-bind-tip" @bind="handleBindPhone" />

        <!-- 订单入口：左缘凹口 clip-path 在 aside；wrap 上 drop-shadow 跟轮廓 -->
        <view class="mine-order-card">
          <view class="mine-order-card__main">
            <view
              class="mine-order-card__cell"
              hover-class="mine-order-card__cell--active"
              @click="goOrderEntry('pending')"
            >
              <image class="mine-order-card__icon" src="/static/me/icon_01_wait_payment_64.png" mode="aspectFit" />
              <text class="mine-order-card__label">待支付</text>
            </view>
            <view
              class="mine-order-card__cell"
              hover-class="mine-order-card__cell--active"
              @click="goOrderEntry('progress')"
            >
              <image class="mine-order-card__icon" src="/static/me/icon_02_in_progress_64.png" mode="aspectFit" />
              <text class="mine-order-card__label">进行中</text>
            </view>
            <view
              class="mine-order-card__cell"
              hover-class="mine-order-card__cell--active"
              @click="goOrderEntry('refund')"
            >
              <image class="mine-order-card__icon" src="/static/me/icon_03_refund_after_sale_64.png" mode="aspectFit" />
              <text class="mine-order-card__label">退款/售后</text>
            </view>
          </view>
          <view
            class="mine-order-card__aside-wrap"
            hover-class="mine-order-card__aside-wrap--active"
            @click="goOrderEntry('all')"
          >
            <view class="mine-order-card__aside">
              <image class="mine-order-card__aside-icon" src="/static/me/icon_04_all_orders_64.png" mode="aspectFit" />
              <text class="mine-order-card__aside-label">全部订单</text>
            </view>
          </view>
        </view>

        <!-- 营销横滑：无外层底，白底 7:3 卡片左文右图标 -->
        <view class="mine-promo-strip">
          <scroll-view scroll-x :show-scrollbar="false" :enable-flex="true" class="mine-promo-strip__scroll">
            <view class="mine-promo-strip__track">
              <view
                v-for="item in minePromoTiles"
                :key="item.key"
                class="mine-promo-strip__tile"
                hover-class="mine-promo-strip__tile--active"
                @click="onMinePromoTile(item.key)"
              >
                <view class="mine-promo-strip__copy">
                  <text class="mine-promo-strip__title">{{ item.title }}</text>
                  <text class="mine-promo-strip__desc">{{ item.desc }}</text>
                </view>
                <wd-icon :name="item.icon" size="32rpx" class="mine-promo-strip__icon text-primary" />
              </view>
            </view>
          </scroll-view>
        </view>

        <!-- 功能入口：单列列表，左图标+文案 / 右箭头 -->
        <view class="mine-menu-card">
          <view
            v-for="row in mineMenuItems"
            :key="row.key"
            class="mine-menu-card__row"
            hover-class="mine-menu-card__row--active"
            @click="onMineMenuItem(row.key)"
          >
            <view class="mine-menu-card__left">
              <wd-icon :name="row.icon" size="36rpx" class="mine-menu-card__lead-icon text-primary" />
              <text class="mine-menu-card__title">{{ row.title }}</text>
            </view>
            <wd-icon name="arrow-right" size="28rpx" class="mine-menu-card__arrow text-ink-lighter" />
          </view>
        </view>
      </view>

      <!-- 分销中心 -->
      <view v-if="tokenStore.hasLogin && (userInfo.levelId ?? 0) > 0" class="service-section">
        <view class="section-header">
          <text class="section-title">分销中心</text>
          <text v-if="(userInfo.levelId ?? 0) > 0" class="section-tag">
            {{ userInfo.levelId === 1 ? '高级团长' : '共享股东' }}
          </text>
        </view>
        <view class="grid-container">
          <view class="grid-item" @click="goTeam">
            <view class="icon-wrapper glass-orange">
              <wd-icon name="team" size="48rpx" color="#fff" />
            </view>
            <text class="grid-label">我的团队</text>
          </view>
          <view v-if="(userInfo.levelId ?? 0) === 2" class="grid-item" @click="goReferralCode">
            <view class="icon-wrapper glass-blue">
              <wd-icon name="qrcode" size="48rpx" color="#fff" />
            </view>
            <text class="grid-label">我的邀请码</text>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-section">
        <button v-if="tokenStore.hasLogin" class="logout-btn" @click="handleLogout">退出登录</button>
        <button v-else class="login-btn" @click="handleLogin">登录 / 注册</button>
      </view>
    </scroll-view>
  </view>
</template>

<style lang="scss" scoped>
/** 页面主内容区左右边距（略收紧，避免过宽留白） */
$mine-page-inline: 0.5rem;

/**
 * Tab 页：与 category.vue 同源策略 — disableScroll + 根层 overflow:hidden；
 * 内层 scroll-view 承担滚动，避免 uni-page-body 与内部双滚动。
 */
.mine-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: calc(100vh - var(--tabbar-total-height));
  overflow: hidden;
  background-color: var(--color-mine-page-tail);
}

/* #ifdef H5 */
/**
 * H5 上 page-meta / disableScroll 往往无法完全禁止 uni-page-body 滚动；
 * 自定义导航与 category 一致顶贴视口；bottom 预留自定义 tabbar。
 */
.mine-page {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  bottom: var(--tabbar-total-height);
  width: 100%;
  height: auto;
  max-height: none;
  min-height: 0;
}

.mine-scroll {
  min-height: 0;
  max-height: 100%;
}

/* #endif */

.mine-scroll {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.mine-hero {
  background-color: var(--color-mine-page-tail);
  background-image: var(--gradient-mine-page);
  /** 顶区至少占一截视口高度，渐变随区域拉高，背景色带更靠下延伸（可调 38vh～48vh） */
  min-height: 38vh;
  padding-right: $mine-page-inline;
  padding-bottom: var(--space-xl);
  padding-left: $mine-page-inline;
  /* padding-top 由导航占位动态注入 */
}

.mine-phone-bind-tip {
  /** 与资产区 / 订单区间距一致；左右由 mine-hero 已 padding */
  margin-bottom: var(--space-sm);
}

.user-section {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  box-sizing: border-box;
  padding: 0 $mine-page-inline;
  margin: 0;
  background-color: transparent;

  &__main {
    display: flex;
    flex: 1;
    align-items: flex-end;
    min-width: 0;
  }

  &__tools {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--space-sm);
  }

  &__tool {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xs);

    &--active {
      opacity: 0.65;
    }
  }

  .avatar {
    width: 120rpx;
    height: 120rpx;
    flex-shrink: 0;
    border-radius: 50%;
  }

  .user-info {
    flex: 1;
    min-width: 0;
    margin-left: var(--space-md);
    margin-bottom: 12rpx;

    .nickname {
      display: block;
      font-size: var(--font-title-medium);
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .phone {
      display: block;
      margin-top: var(--space-xs);
      font-size: var(--font-body-medium);
      color: var(--color-text-tertiary);
    }

    .login-tip {
      font-size: var(--font-title-medium);
      color: var(--color-func-link);
    }
  }
}

/** 会员福利卡：绿金渐变底 + 右上暖光 */
$member-welfare-card-bg:
  radial-gradient(circle at 90% 8%, rgba(255, 222, 150, 0.32) 0%, rgba(255, 222, 150, 0) 36%),
  linear-gradient(135deg, #123d2a 0%, #1f5a3d 60%, #a87932 135%);

.member-welfare-card {
  position: relative;
  box-sizing: border-box;
  margin-top: var(--space-sm);
  overflow: hidden;
  border-radius: 10px;
  background: $member-welfare-card-bg;
  box-shadow: 0 8px 18px rgba(18, 61, 42, 0.18);

  &__inner {
    position: relative;
    z-index: 1;
    padding: var(--space-sm) var(--space-sm);
  }

  &__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
  }

  &__title {
    flex: 1;
    min-width: 0;
    font-size: 15px;
    font-weight: 600;
    color: #ffe8a8;
  }

  &__cta {
    flex-shrink: 0;
    margin: 0;
    padding: 10rpx 32rpx;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    color: #5a3a08;
    border: none;
    border-radius: 999px;
    background: linear-gradient(180deg, #fff0c2 0%, #f2c66d 100%);
    box-shadow: 0 3px 8px rgba(120, 78, 12, 0.22);

    &::after {
      display: none;
    }

    &--active {
      opacity: 0.9;
    }
  }

  &__scroll {
    width: 100%;
    margin-top: var(--space-sm);
    height: 168rpx;
    white-space: nowrap;
  }

  &__track {
    display: inline-flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--space-xs);
    height: 160rpx;
    padding: 2rpx 0 4rpx;
  }

  /**
   * 竖条宽度 ≈ 可视区一行 4 个（含列间距），共 5 个时第 5 个需横滑查看。
   * 列宽 = (滚动视口宽 − 3×gap) / 4；此处用 rpx 近似 750 设计稿内容区。
   */
  &__tile {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 164rpx;
    min-height: 156rpx;
    padding: var(--space-xs) 4rpx;
    border-radius: 4px;
    border: 1px solid rgba(255, 232, 168, 0.55);
    background: rgba(255, 250, 235, 0.92);
  }

  &__tile-text {
    display: block;
    max-width: 100%;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.35;
    color: #5f4a24;
    text-align: center;
    word-break: break-all;
  }
}

/**
 * 资产四宫格：与会员福利、下方区块各 10px 间距
 */
.mine-stats-card {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  box-sizing: border-box;
  margin: 10px 0;
  padding: 28rpx 16rpx;
  border-radius: var(--radius-card);
  background-color: var(--color-bg-surface);

  &__item {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0 4rpx;
    gap: 10rpx;
  }

  &__value {
    font-size: var(--font-title-medium);
    font-weight: 700;
    line-height: 1.2;
    color: var(--color-text-primary);
  }

  &__label {
    font-size: var(--font-caption);
    line-height: 1.3;
    color: var(--color-text-secondary);
    text-align: center;
  }
}

/**
 * 订单入口：整卡白底圆角 + 右侧「全部订单」浮层。
 * 左缘凹口：`clip-path` 在 aside；阴影用 aside-wrap 的 `filter: drop-shadow` 跟随裁切后的轮廓（不用 box-shadow）。
 */
.mine-order-card {
  position: relative;
  z-index: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  box-sizing: border-box;
  margin: 10px 0;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-bg-surface);

  &__main {
    display: flex;
    flex: 1;
    flex-direction: row;
    align-items: stretch;
    min-width: 0;
    padding: 28rpx 4rpx 28rpx 16rpx;
  }

  &__cell {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: 0 4rpx;
    gap: 12rpx;

    &--active {
      opacity: 0.72;
    }
  }

  &__icon {
    display: block;
    width: 56rpx;
    height: 56rpx;
  }

  &__label {
    font-size: var(--font-caption);
    line-height: 1.25;
    color: var(--color-text-secondary);
    text-align: center;
  }

  /**
   * 外层：`drop-shadow` 作用在子层裁切结果上，轮廓含左缘凹口（同元素 box-shadow 做不到）。
   */
  &__aside-wrap {
    position: relative;
    z-index: 2;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    align-self: stretch;
    min-width: 148rpx;
    max-width: 40%;
    border-radius: 0 var(--radius-card) var(--radius-card) 0;
    -webkit-filter: drop-shadow(-5rpx 0 16rpx rgba(0, 0, 0, 0.042));
    filter: drop-shadow(-5rpx 0 16rpx rgba(0, 0, 0, 0.042));

    &--active {
      opacity: 0.88;
    }
  }

  /**
   * 左缘凹口：`clip-path` 尖角约 11% 宽、竖向 38%～62%。
   * `overflow` 勿 hidden，否则易裁掉父级上的 drop-shadow 外扩。
   */
  &__aside {
    position: relative;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    overflow: visible;
    padding: 28rpx 18rpx 28rpx 36rpx;
    border-radius: 0 var(--radius-card) var(--radius-card) 0;
    background-color: var(--color-bg-surface);
    -webkit-clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 62%, 11% 50%, 0 38%);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 62%, 11% 50%, 0 38%);
  }

  &__aside-icon {
    position: relative;
    z-index: 1;
    display: block;
    width: 56rpx;
    height: 56rpx;
  }

  &__aside-label {
    position: relative;
    z-index: 1;
    margin-top: 10rpx;
    font-size: var(--font-caption);
    line-height: 1.25;
    color: var(--color-text-secondary);
    text-align: center;
  }
}

/**
 * 订单入口下方营销横滑：容器无底色，仅卡片为白底；单卡约 7:3（290×120rpx）+ 左主副文案。
 */
.mine-promo-strip {
  margin: 10px 0 0;
  background-color: transparent;

  &__scroll {
    width: 100%;
    height: 132rpx;
    white-space: nowrap;
  }

  &__track {
    display: inline-flex;
    flex-direction: row;
    align-items: stretch;
    gap: var(--space-sm);
    height: 120rpx;
    padding: 4rpx 0;
  }

  &__tile {
    display: flex;
    flex-shrink: 0;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    width: 290rpx;
    height: 120rpx;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-card);
    background-color: var(--color-bg-surface);

    &--active {
      opacity: 0.88;
    }
  }

  &__copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    min-width: 0;
    padding-right: var(--space-sm);
    gap: 6rpx;
  }

  &__title {
    display: block;
    width: 100%;
    font-size: var(--font-body-large);
    font-weight: 500;
    line-height: 1.3;
    color: var(--color-text-primary);
  }

  &__desc {
    display: block;
    width: 100%;
    font-size: var(--font-caption);
    font-weight: 400;
    line-height: 1.35;
    color: var(--color-text-tertiary);
  }

  &__icon {
    flex-shrink: 0;
    align-self: center;
  }
}

/** 营销横滑下方：白底列表，每行左图标+标题、右箭头（无行间分割线） */
.mine-menu-card {
  box-sizing: border-box;
  margin-top: 10px;
  overflow: hidden;
  border-radius: var(--radius-card);
  background-color: var(--color-bg-surface);

  &__row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    min-height: 96rpx;
    padding: 24rpx var(--space-md);

    &--active {
      opacity: 0.72;
    }
  }

  &__left {
    display: flex;
    flex: 1;
    flex-direction: row;
    align-items: center;
    min-width: 0;
    gap: var(--space-sm);
  }

  &__lead-icon {
    flex-shrink: 0;
  }

  &__title {
    flex: 1;
    min-width: 0;
    font-size: var(--font-body-large);
    line-height: 1.4;
    color: var(--color-text-primary);
  }

  &__arrow {
    flex-shrink: 0;
    margin-left: var(--space-sm);
  }
}

.service-section {
  background: var(--color-bg-surface);
  margin: 0 $mine-page-inline var(--space-lg);
  border-radius: var(--radius-popup);
  padding: var(--space-lg) $mine-page-inline;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32rpx;

    .section-title {
      font-size: 30rpx;
      font-weight: 700;
      color: #1e293b;
    }

    .section-tag {
      font-size: 20rpx;
      padding: 4rpx 16rpx;
      background: #fff7ed;
      color: #ea580c;
      border-radius: 20rpx;
      font-weight: 600;
    }
  }

  .grid-container {
    display: flex;
    flex-wrap: wrap;

    .grid-item {
      width: 25%;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 10rpx;

      .icon-wrapper {
        width: 96rpx;
        height: 96rpx;
        border-radius: 32rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16rpx;

        &.glass-orange {
          background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
        }
        &.glass-blue {
          background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%);
        }
      }

      .grid-label {
        font-size: 24rpx;
        color: #64748b;
        font-weight: 500;
      }
    }
  }
}

.action-section {
  padding: var(--space-xl) $mine-page-inline;

  /**
   * 勿用原生 type="primary"|"warn"：H5/MP 会走平台默认色（如微信绿），与 --color-brand-primary 不一致。
   * 样式对齐 pages-auth/login.vue 主按钮。
   */
  .logout-btn,
  .login-btn {
    width: 100%;
    margin: 0;
    padding: var(--space-sm) 0;
    font-size: var(--font-body-large);
    font-weight: 600;
    line-height: 1.4;
    border: none;
    border-radius: var(--radius-pill);

    &::after {
      display: none;
    }

    &:active {
      opacity: 0.85;
    }
  }

  .login-btn {
    color: var(--color-bg-surface);
    background-color: var(--color-brand-primary);
  }

  .logout-btn {
    color: var(--color-func-error);
    background-color: var(--color-bg-surface);
    border: 1px solid var(--color-func-error);
  }
}
</style>
