/**
 * 首页自定义导航栏尺寸：状态栏、导航内容区高度、胶囊安全区宽度
 * 基于 docs/design/index/custom-navbar.md 实现，用于双层导航 + 胶囊安全区适配
 */
import { computed, ref } from 'vue';
import { phone } from '@/utils/systemInfo';

export interface CustomNavBarLayout {
  /** 状态栏高度 px */
  statusBarHeightPx: number;
  /** 第一行（topRow）内容区高度 px，不含状态栏 */
  navBarContentHeightPx: number;
  /** 导航栏总高度 px = 状态栏 + 内容区 */
  navBarTotalHeightPx: number;
  /** 第一行底部距屏幕顶的 px（微信由胶囊 bottom 决定，其他平台为 statusBar + contentHeight） */
  firstRowBottomPx: number;
  /** 右侧胶囊安全区宽度 px，内容区右边界不得超过 (windowWidth - capsuleSafeWidthPx) */
  capsuleSafeWidthPx: number;
  /** 窗口宽度 px，用于计算 rpx 比例 */
  windowWidthPx: number;
}

const layout = ref<CustomNavBarLayout | null>(null);

function initLayout(): CustomNavBarLayout {
  const statusBarHeightPx = phone?.StatusBar ?? 0;
  const navBarContentHeightPx = phone?.CustomBar ?? 44;
  const windowWidthPx = phone?.windowWidth ?? 375;

  let capsuleSafeWidthPx = 0;
  let firstRowBottomPx = statusBarHeightPx + navBarContentHeightPx;
  // #ifdef MP-WEIXIN
  if (typeof uni !== 'undefined' && uni.getMenuButtonBoundingClientRect) {
    const rect = uni.getMenuButtonBoundingClientRect();
    capsuleSafeWidthPx = windowWidthPx - rect.left;
    // 第一行底部以胶囊下边界为准，与系统胶囊对齐
    firstRowBottomPx = rect.bottom;
  }
  // #endif

  return {
    statusBarHeightPx,
    navBarContentHeightPx,
    navBarTotalHeightPx: statusBarHeightPx + navBarContentHeightPx,
    firstRowBottomPx,
    capsuleSafeWidthPx,
    windowWidthPx,
  };
}

/**
 * 获取自定义导航栏布局尺寸（状态栏、内容区高度、胶囊安全区宽度）
 * 微信小程序下基于 getMenuButtonBoundingClientRect 计算，其他平台为默认值
 */
export function useCustomNavBar(): { layout: import('vue').ComputedRef<CustomNavBarLayout> } {
  if (!layout.value) {
    layout.value = initLayout();
  }
  return {
    layout: computed(() => layout.value ?? initLayout()),
  };
}
