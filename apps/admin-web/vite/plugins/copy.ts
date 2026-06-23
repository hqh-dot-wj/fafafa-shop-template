import type { PluginOption } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/** 配置静态资源复制 */
export function setupCopyPlugin(): PluginOption {
  return viteStaticCopy({
    targets: [
      {
        src: '../../node_modules/tinymce/{skins,icons,themes,plugins,models}',
        dest: 'assets',
      },
    ],
  });
}
