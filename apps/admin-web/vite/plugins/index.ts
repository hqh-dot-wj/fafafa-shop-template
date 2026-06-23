import type { PluginOption } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { setupCopyPlugin } from './copy';
import { setupDevtoolsPlugin } from './devtools';
import { setupHtmlPlugin } from './html';
import { setupMonacoEditorPlugin } from './monaco-editor';
import { setupElegantRouter } from './router';
import { sanitizeComponentsDtsPlugin } from './sanitize-components-dts';
import { setupUnocss } from './unocss';
import { setupUnplugin } from './unplugin';

export function setupVitePlugins(viteEnv: Env.ImportMeta, buildTime: string) {
  const plugins: PluginOption = [
    vue(),
    vueJsx(),
    setupDevtoolsPlugin(viteEnv),
    setupElegantRouter(),
    setupUnocss(viteEnv),
    ...setupUnplugin(viteEnv),
    sanitizeComponentsDtsPlugin(),
    setupHtmlPlugin(buildTime),
    setupMonacoEditorPlugin(viteEnv),
    setupCopyPlugin(),
  ];

  return plugins;
}
