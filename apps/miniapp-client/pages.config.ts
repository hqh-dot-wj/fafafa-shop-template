import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages';
import { tabBar } from './src/tabbar/config';

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: 'unibest',
    /** 与 design-tokens `--color-bg-body` / 页面 `bg-fill` 一致，避免原生标题栏 #f8f8f8 与灰底内容区割裂 */
    navigationBarBackgroundColor: '#f5f5f5',
    navigationBarTextStyle: 'black',
    backgroundColor: '#FFFFFF',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^fg-(.*)': '@/components/fg-$1/fg-$1.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)': 'z-paging/components/z-paging$1/z-paging$1.vue',
      '^wd-(.*)': 'wot-design-uni/components/wd-$1/wd-$1.vue',
    },
  },
  // tabbar 的配置统一在 “./src/tabbar/config.ts” 文件中
  tabBar: tabBar as any,
});
