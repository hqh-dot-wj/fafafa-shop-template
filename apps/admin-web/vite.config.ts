import process from 'node:process';
import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import { type Plugin, defineConfig, loadEnv } from 'vite';
import { setupVitePlugins } from './vite/plugins';
import { createViteProxy, getBuildTime } from './vite/config';

const adminWebDir = fileURLToPath(new URL('./', import.meta.url));
const libsDir = path.resolve(adminWebDir, '../../libs');

/**
 * elegant-router 生成的 `src/router/elegant/imports.ts` 把 BaseLayout 写为同步 import，
 * 导致登录页等任何引用 imports.ts 的入口都会把 base-layout（及其连带的 global-header /
 * sider / tab / theme-drawer / better-scroll / echarts hook）拉进主 chunk。
 * 这里在 Vite 的 transform 阶段把那一行改成 dynamic import，BlankLayout 保持同步。
 * 既避免改动被 elegant-router 反复回写，又能切断登录页 → base-layout 的静态依赖。
 */
function lazyBaseLayoutPlugin(): Plugin {
  return {
    name: 'admin-web:lazy-base-layout',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith('/src/router/elegant/imports.ts')) return null;
      if (!code.includes('import BaseLayout from')) return null;

      const next = code
        .replace(/import BaseLayout from "@\/layouts\/base-layout\/index\.vue";\n?/, '')
        .replace(/(\bbase:\s*)BaseLayout(\s*,)/, '$1() => import("@/layouts/base-layout/index.vue")$2');
      return { code: next, map: null };
    },
  };
}

export default defineConfig((configEnv) => {
  const viteEnv = loadEnv(configEnv.mode, process.cwd()) as unknown as Env.ImportMeta;

  const buildTime = getBuildTime();

  const enableProxy = configEnv.command === 'serve' && !configEnv.isPreview;

  return {
    base: viteEnv.VITE_BASE_URL,
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./', import.meta.url)),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // 指向 libs 源码，避免 CJS dist 在 Vite ESM 下的互操作问题（子路径须在父路径前）
        '@libs/common-utils/tree': path.join(libsDir, 'common-utils/src/tree.ts'),
        '@libs/common-utils/error': path.join(libsDir, 'common-utils/src/error.ts'),
        '@libs/common-utils': path.join(libsDir, 'common-utils/src/index.ts'),
        '@libs/common-constants/regex': path.join(libsDir, 'common-constants/src/regex.ts'),
        '@libs/common-constants': path.join(libsDir, 'common-constants/src/index.ts'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          additionalData: `@use "@/styles/scss/global.scss" as *;`,
        },
      },
    },
    plugins: [lazyBaseLayoutPlugin(), ...setupVitePlugins(viteEnv, buildTime)],
    define: {
      BUILD_TIME: JSON.stringify(buildTime),
    },
    server: {
      host: '0.0.0.0',
      port: 9527,
      open: true,
      proxy: createViteProxy(viteEnv, enableProxy),
      fs: {
        allow: [adminWebDir, libsDir],
      },
    },
    preview: {
      port: 9725,
    },
    build: {
      reportCompressedSize: false,
      sourcemap: viteEnv.VITE_SOURCE_MAP === 'Y',
      commonjsOptions: {
        ignoreTryCatch: false,
      },
      rollupOptions: {
        output: {
          /**
           * 只对"明确在入口静态图里、必须随首屏一起到达"的依赖做 vendor 切分：
           *  - vendor-vue：Vue 运行时 / vue-router / pinia / @vueuse，App.vue 直接依赖
           *  - vendor-naive：Naive UI 组件库，AppProvider / 主题层在首屏即用
           *
           * 重型懒依赖（echarts / monaco / @umoteam/editor / mermaid / vform3 / @vue-flow / xlsx）
           * 故意 **不** 显式归类，交给 Vite 默认按视图懒加载切分。
           * 早期方案曾把它们各自合并成 vendor-* chunk，但 Vite 会把"恰好被入口与懒视图共享的
           * 极少数小工具符号"也拽进这些 vendor chunk，使得入口出现到它们的静态 import，
           * 进而被 modulepreload 链路自动预加载（实测一次首屏会多拉 13MB+ 的 mermaid/umo/echarts）。
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            if (/[\\/]node_modules[\\/](@vue[\\/]|vue[\\/]|vue-router[\\/]|pinia[\\/]|@vueuse[\\/])/.test(id)) {
              return 'vendor-vue';
            }
            if (/[\\/]node_modules[\\/]naive-ui[\\/]/.test(id)) {
              return 'vendor-naive';
            }
            return undefined;
          },
        },
      },
    },
    optimizeDeps: {
      // dev 模式按需触发 esbuild 预构建会强制浏览器 reload；把所有"会被业务页 import 的重型依赖"
      // 提前列入 include 让 Vite 在 server 启动阶段一次性预构建完，消除冷启动 reload 闪屏。
      include: [
        // 原有列表保持不变
        '@umoteam/editor',
        '@braintree/sanitize-url',
        '@amap/amap-jsapi-loader',
        '@vue-flow/core',
        'cron-parser',
        'dagre',
        'highlight.js/lib/core',
        'highlight.js/lib/languages/json',
        'vue-advanced-cropper',
        'vue-draggable-plus',
        // 新增：dev 启动期反复触发 reload 的元凶
        'naive-ui',
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/features',
        'echarts/renderers',
        'element-plus',
        'monaco-editor',
        'mermaid',
        '@better-scroll/core',
        'vform3-builds',
        'xlsx',
        'streamsaver',
        'pinia',
        'vue-i18n',
        'vue-router',
        '@vueuse/core',
      ],
    },
  };
});
