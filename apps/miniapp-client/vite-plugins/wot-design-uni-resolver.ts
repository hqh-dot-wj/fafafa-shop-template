import type { ComponentResolver } from '@uni-helper/vite-plugin-uni-components';

/** WdPopup -> wd-popup */
function wdKebabFromPascal(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 将 easycom 的 wd-* 解析为显式 import，避免 H5 生产构建仅渲染插槽、不加载 wot 组件实现。
 */
export function WotDesignUniResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name) => {
      if (!name.startsWith('Wd')) {
        return;
      }
      const stem = name.slice(2);
      if (!stem) {
        return;
      }
      const kebab = wdKebabFromPascal(stem);
      return {
        name,
        from: `wot-design-uni/components/wd-${kebab}/wd-${kebab}.vue`,
      };
    },
  };
}
