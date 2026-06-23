<script lang="ts" setup>
/**
 * 首页自定义导航栏：双层结构 + 胶囊安全区适配
 * 规格见 docs/design/index/custom-navbar.md
 */
import { computed } from 'vue';
import { useLocationStore } from '@/store/location';
import { useCustomNavBar } from '../../hooks/useCustomNavBar';

const props = withDefaults(
  defineProps<{
    /** 0=完全透明（露出通栏渐变），1=导航区纯白底；由页面 onPageScroll 驱动 */
    scrollBackgroundOpacity?: number;
  }>(),
  { scrollBackgroundOpacity: 0 },
);

const scrollBgOpacitySafe = computed(() => Math.min(1, Math.max(0, props.scrollBackgroundOpacity)));

const { layout } = useCustomNavBar();
const locationStore = useLocationStore();

// 公告滚动列表（后续可改为接口配置）
const announcements = ref<string[]>(['小象超市', '绝对自营']);

// 无缝纵向轮播：列表末尾复制首项，滚到复制项后无过渡复位，视觉无跳跃
const displayList = computed(() => {
  const list = announcements.value;
  if (list.length <= 1) {
    return list;
  }
  return [...list, list[0]];
});

const announceIndex = ref(0);
const announceTransition = ref(true);
const ANNOUNCE_INTERVAL = 3000;
const TRANSITION_DURATION_MS = 300;
let announceTimer: ReturnType<typeof setInterval> | null = null;
let resetTimeout: ReturnType<typeof setTimeout> | null = null;

function startAnnounceCarousel() {
  if (displayList.value.length <= 1) {
    return;
  }
  const total = displayList.value.length;
  announceTimer = setInterval(() => {
    const next = (announceIndex.value + 1) % total;
    if (next === 0) {
      // 已由 setTimeout 无过渡复位到 0，本 tick 不重复操作
      return;
    }
    if (next === total - 1) {
      // 即将展示「复制首项」，开过渡滚过去，动画结束后无过渡复位到 0
      announceTransition.value = true;
      announceIndex.value = next;
      resetTimeout = setTimeout(() => {
        announceTransition.value = false;
        announceIndex.value = 0;
        nextTick(() => {
          announceTransition.value = true;
        });
      }, TRANSITION_DURATION_MS);
      return;
    }
    announceTransition.value = true;
    announceIndex.value = next;
  }, ANNOUNCE_INTERVAL);
}

onMounted(() => {
  startAnnounceCarousel();
});

onUnmounted(() => {
  if (announceTimer) {
    clearInterval(announceTimer);
  }
  if (resetTimeout) {
    clearTimeout(resetTimeout);
  }
});

// 第二行高度 px（搜索框行 + 内边距），用于占位计算
const SEARCH_ROW_HEIGHT_PX = 40;

// 占位高度：由胶囊下边界决定第一行底，再加搜索行
const totalNavBarHeightPx = computed(() => layout.value.firstRowBottomPx + SEARCH_ROW_HEIGHT_PX);

// 第一行内容区高度：由胶囊对齐时 = 胶囊底 - 状态栏
const topRowHeightPx = computed(() => layout.value.firstRowBottomPx - layout.value.statusBarHeightPx);

// 搜索关键词
const searchKeyword = ref('');

function goAddress() {
  uni.navigateTo({ url: '/pages/address/select' });
}

function goScan() {
  // 扫码（路由或扫码 API 待配置）
  // uni.scanCode({ ... })
}

function goSearch() {
  // 跳转搜索页或触发搜索（路由待配置）
  // uni.navigateTo({ url: '/pages/search/search?keyword=' + encodeURIComponent(searchKeyword.value) })
}
</script>

<template>
  <!-- 占位：避免页面内容被固定导航栏遮挡 -->
  <view class="navbar-placeholder bg-transparent" :style="{ height: `${totalNavBarHeightPx}px` }" />
  <!-- 固定导航栏：底层白底随滚动渐显，前景内容在上层 -->
  <view
    class="custom-navbar bg-transparent"
    :style="{
      paddingTop: `${layout.statusBarHeightPx}px`,
    }"
  >
    <view class="navbar-scroll-bg" :style="{ opacity: scrollBgOpacitySafe }" aria-hidden="true" />
    <view class="navbar-foreground">
      <!-- 第一行：公告 + 地址 + 胶囊安全区 -->
      <view
        class="top-row flex items-center gap-space-sm px-space-md"
        :style="{
          height: `${topRowHeightPx}px`,
        }"
      >
        <!-- 左侧：公告纵向轮播 -->
        <view class="announce-wrap max-w-[200rpx] flex-shrink-0 overflow-hidden">
          <view
            class="announce-list text-body-md text-ink-light"
            :class="{ 'no-transition': !announceTransition }"
            :style="{
              transform: `translateY(-${displayList.length ? (announceIndex / displayList.length) * 100 : 0}%)`,
            }"
          >
            <view v-for="(item, i) in displayList" :key="i" class="announce-item text-[32rpx] text-ink font-bold">
              {{ item }}
            </view>
          </view>
        </view>
        <!-- 中间：地址区，弹性布局，单行省略，与左侧文案基线对齐 -->
        <view class="address-region min-w-0 flex flex-1 items-center gap-space-xs" @click="goAddress">
          <wd-icon name="location" size="32rpx" class="address-label flex-shrink-0 text-ink" />
          <text class="address-text flex-1 truncate text-body-md text-ink font-[500]">
            {{ locationStore.locationDisplayName || '请选择地址' }}
          </text>
        </view>
        <!-- 右侧：仅预留宽度，避免内容压住微信胶囊；高度随第一行自然撑开 -->
        <view class="capsule-safe flex-shrink-0 bg-transparent" :style="{ width: `${layout.capsuleSafeWidthPx}px` }" />
      </view>

      <!-- 第二行：扫码 + 输入框 + 搜索按钮（椭圆形） -->
      <view class="search-row px-space-md py-space-sm">
        <view
          class="search-box flex items-center gap-space-xs rounded-full px-space-xs py-space-xs text-body-md"
          style="background-color: #ffffff"
        >
          <view class="search-scan mx-space-sm flex-shrink-0" @click="goScan">
            <wd-icon name="scan" size="32rpx" class="scan-icon-line text-ink" />
          </view>
          <input
            v-model="searchKeyword"
            class="search-input min-w-0 flex-1 bg-transparent text-ink"
            type="text"
            placeholder="搜索商品"
            placeholder-class="text-ink-lighter"
          />
          <view
            class="search-btn flex-shrink-0 rounded-full px-space-md py-space-xs text-body-md text-white"
            style="background-color: #1cc920"
            @click="goSearch"
          >
            搜索
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.navbar-placeholder {
  width: 100%;
  flex-shrink: 0;
}

.custom-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: var(--z-fixed-below-modal);
}

/* 与滚动位置同步改变 opacity，比 transition background 更跟手（H5/小程序一致） */
.navbar-scroll-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  background-color: #f5f5f5;
  box-shadow: 0 1rpx 0 var(--color-border-default);
}

.navbar-foreground {
  position: relative;
  z-index: 1;
}

.top-row {
  flex-wrap: nowrap;
  align-items: center;
}

/* 公告区：单行高度，纵向轮播；行高与中间地址区统一为 1.4 以垂直对齐 */
.announce-wrap {
  height: 1.4em;
  line-height: 1.4;
}

.announce-list {
  display: flex;
  flex-direction: column;
  transition: transform var(--duration-normal) ease;
}

.announce-list.no-transition {
  transition: none;
}

.announce-item {
  height: 1.4em;
  line-height: 1.4em;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 地址区与公告区统一行高 1.4，保证左侧与中间垂直居中对齐 */
.address-region {
  line-height: 1.4;
  cursor: pointer;
  &:active {
    opacity: 0.8;
  }
}

.address-label,
.address-text {
  line-height: 1.4;
}

.search-box {
  height: 66rpx;
  min-height: 66rpx;
  box-sizing: border-box;
}

.search-scan,
.search-btn {
  &:active {
    opacity: 0.85;
  }
}

.search-input {
  height: 32rpx;
  line-height: 32rpx;
  font-size: 26rpx;
}

/* 扫码图标视觉上更细：缩小 + 略浅，避免过粗 */
.scan-icon-line {
  opacity: 0.9;
}
</style>
