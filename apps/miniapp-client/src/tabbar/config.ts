import type { TabBar } from '@uni-helper/vite-plugin-uni-pages';
import type { CustomTabBarItem, NativeTabBarItem } from './types';

type NativeTabBarList = NonNullable<TabBar['list']>;

/**
 * tabbar 选择的策略，更详细的介绍见 tabbar.md 文件
 * 0: 'NO_TABBAR' `无 tabbar`
 * 1: 'NATIVE_TABBAR'  `原生 tabbar`
 * 2: 'CUSTOM_TABBAR' `自定义 tabbar`
 *
 * 温馨提示：本文件的任何代码更改了之后，都需要重新运行，否则 pages.json 不会更新导致配置不生效
 */
export const TABBAR_STRATEGY_MAP = {
  NO_TABBAR: 0,
  NATIVE_TABBAR: 1,
  CUSTOM_TABBAR: 2,
};

// 当前项目默认使用自定义 tabbar：
// - H5 / 需要统一角标表现的端依赖自定义渲染
// - 原生 tabbar 配置仅保留为 pages 配置与回退基线
export const selectedTabbarStrategy = TABBAR_STRATEGY_MAP.CUSTOM_TABBAR;

// 原生 tabbar 回退配置：仅在切换到 NATIVE_TABBAR 时生效。
export const nativeTabbarList: NativeTabBarItem[] = [
  {
    iconPath: 'static/tabbar/home.png',
    selectedIconPath: 'static/tabbar/homeHL.png',
    pagePath: 'pages/index/index',
    text: '首页',
  },
  {
    iconPath: 'static/tabbar/personal.png',
    selectedIconPath: 'static/tabbar/personalHL.png',
    pagePath: 'pages/me/me',
    text: '个人',
  },
];

// 自定义 tabbar 的正式配置。
// 若后续需要鼓包项，应在 `tabbar/store.ts` 与 `tabbar/index.vue` 中同时声明交互和视觉表现。
export const customTabbarList: CustomTabBarItem[] = [
  {
    text: '首页',
    pagePath: 'pages/index/index',
    iconType: 'image',
    icon: '/static/tabbar/home.png',
    iconActive: '/static/tabbar/homeHL.png',
  },
  {
    text: '分类',
    pagePath: 'pages/category/category',
    iconType: 'image',
    icon: '/static/tabbar/category.png',
    iconActive: '/static/tabbar/categoryHL.png',
  },
  {
    text: '购物车',
    pagePath: 'pages/cart/cart',
    iconType: 'image',
    icon: '/static/tabbar/cart.png',
    iconActive: '/static/tabbar/cartHL.png',
    // badge: 动态显示购物车数量，在 store.ts 中配置
  },
  {
    pagePath: 'pages/me/me',
    text: '我的',
    iconType: 'image',
    icon: '/static/tabbar/personal.png',
    iconActive: '/static/tabbar/personalHL.png',
  },
];

/**
 * 是否启用 tabbar 缓存
 * NATIVE_TABBAR(1) 和 CUSTOM_TABBAR(2) 时，需要tabbar缓存
 */
export const tabbarCacheEnable = [TABBAR_STRATEGY_MAP.NATIVE_TABBAR, TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(
  selectedTabbarStrategy,
);

/**
 * 是否启用自定义 tabbar
 * CUSTOM_TABBAR(2) 时，启用自定义tabbar
 */
export const customTabbarEnable = [TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy);

/**
 * 是否需要隐藏原生 tabbar
 * CUSTOM_TABBAR(2) 时，需要隐藏原生tabbar
 */
export const needHideNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR;

const _tabbarList: NativeTabBarList = customTabbarEnable
  ? customTabbarList.map((item) => ({ text: item.text, pagePath: item.pagePath }))
  : nativeTabbarList;
export const tabbarList = customTabbarEnable ? customTabbarList : nativeTabbarList;

const _tabbar: TabBar = {
  // 只有微信小程序支持 custom。App 和 H5 不生效
  custom: selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR,
  color: '#999999',
  selectedColor: '#018d71',
  backgroundColor: '#F8F8F8',
  borderStyle: 'black',
  height: '50px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: _tabbarList,
};

export const tabBar = tabbarCacheEnable ? _tabbar : undefined;
