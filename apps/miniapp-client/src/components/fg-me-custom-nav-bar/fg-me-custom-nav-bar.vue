<script lang="ts" setup>
/**
 * 「我的」页自定义导航：默认全透明；随滚动渐显底色，左上角展示头像 + 昵称（与首页导航渐显逻辑一致）。
 */
import { computed } from 'vue';
import { useCustomNavBar } from '@/hooks/useCustomNavBar';

const props = withDefaults(
  defineProps<{
    /** 0=完全透明，1=白底完全不透明；由页面 scroll-view @scroll 驱动 */
    scrollBackgroundOpacity?: number;
    hasLogin?: boolean;
    avatarUrl?: string;
    nickname?: string;
  }>(),
  {
    scrollBackgroundOpacity: 0,
    hasLogin: false,
    avatarUrl: '',
    nickname: '',
  },
);

const emit = defineEmits<{
  login: [];
}>();

const scrollBgOpacitySafe = computed(() => Math.min(1, Math.max(0, props.scrollBackgroundOpacity)));

const { layout } = useCustomNavBar();

const topRowHeightPx = computed(() => layout.value.firstRowBottomPx - layout.value.statusBarHeightPx);

const displayName = computed(() => (props.nickname?.trim() ? props.nickname : '微信用户'));

const avatarSrc = computed(() => props.avatarUrl || '/static/images/default-avatar.png');

function onUserRowTap() {
  if (!props.hasLogin) {
    emit('login');
  }
}
</script>

<template>
  <view
    class="me-custom-navbar"
    :style="[
      { paddingTop: `${layout.statusBarHeightPx}px` },
      { pointerEvents: scrollBgOpacitySafe < 0.03 ? 'none' : 'auto' },
    ]"
  >
    <view class="navbar-scroll-bg" :style="{ opacity: scrollBgOpacitySafe }" aria-hidden="true" />
    <view class="navbar-foreground flex items-center gap-space-sm" :style="{ height: `${topRowHeightPx}px` }">
      <!-- 随滚动渐显：与底色同一 opacity -->
      <view
        class="me-nav-user min-w-0 flex flex-1 items-center gap-space-sm overflow-hidden"
        :style="{ opacity: scrollBgOpacitySafe }"
        @click="onUserRowTap"
      >
        <image class="me-nav-avatar shrink-0" :src="avatarSrc" mode="aspectFill" />
        <text v-if="hasLogin" class="min-w-0 truncate text-title-md text-ink font-semibold">
          {{ displayName }}
        </text>
        <text v-else class="min-w-0 truncate text-body-lg text-ink">点击登录</text>
      </view>
      <view class="capsule-safe shrink-0 bg-transparent" :style="{ width: `${layout.capsuleSafeWidthPx}px` }" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.me-custom-navbar {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  z-index: var(--z-fixed-below-modal);
}

.navbar-scroll-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--color-bg-body);
  box-shadow: 0 1rpx 0 var(--color-border-default);
}

.navbar-foreground {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  padding-right: 0.75rem;
  padding-left: 0.75rem;
}

.me-nav-avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 1rpx solid var(--color-border-default);
  background-color: var(--color-bg-surface);
}
</style>
