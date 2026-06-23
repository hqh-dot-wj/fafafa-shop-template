import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { VantResolver } from 'unplugin-vue-components/resolvers';

const cWebDir = fileURLToPath(new URL('./', import.meta.url));
const libsDir = path.resolve(cWebDir, '../../libs');

export default defineConfig((configEnv) => {
  const viteEnv = loadEnv(configEnv.mode, process.cwd(), '');
  const enableProxy = configEnv.command === 'serve' && !configEnv.isPreview;
  const apiBase = viteEnv.VITE_API_BASE || '/api';

  return {
    base: viteEnv.VITE_BASE_URL || '/shop/',
    resolve: {
      alias: {
        '@': path.join(cWebDir, 'src'),
        '@libs/common-utils/tree': path.join(libsDir, 'common-utils/src/tree.ts'),
        '@libs/common-utils/error': path.join(libsDir, 'common-utils/src/error.ts'),
        '@libs/common-utils': path.join(libsDir, 'common-utils/src/index.ts'),
        '@libs/common-constants/regex': path.join(libsDir, 'common-constants/src/regex.ts'),
        '@libs/common-constants': path.join(libsDir, 'common-constants/src/index.ts'),
      },
    },
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/typings/auto-imports.d.ts',
        dirs: ['src/hooks', 'src/stores'],
        eslintrc: {
          enabled: true,
          filepath: './.eslintrc-auto-import.json',
        },
      }),
      Components({
        resolvers: [VantResolver({ importStyle: false })],
        dts: 'src/typings/components.d.ts',
        types: [{ from: 'vue-router', names: ['RouterLink', 'RouterView'] }],
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: 5175,
      proxy: enableProxy
        ? {
            [apiBase]: {
              target: viteEnv.VITE_DEV_API_PROXY || 'http://127.0.0.1:8080',
              changeOrigin: true,
            },
          }
        : undefined,
      fs: {
        allow: [cWebDir, libsDir],
      },
    },
    preview: {
      port: 5176,
    },
    build: {
      outDir: 'dist',
      reportCompressedSize: false,
    },
  };
});
