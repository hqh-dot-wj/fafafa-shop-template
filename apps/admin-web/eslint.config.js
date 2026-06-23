import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@soybeanjs/eslint-config';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(configDir, '../..');
/** 与同仓根目录 `.prettierrc.json` 对齐；@soybeanjs/eslint-config 仅尝试读取 `cwd/.prettierrc`（无 .json），否则会退回 trailingComma:none 等与编辑器 Prettier 冲突 */
const repoPrettier = JSON.parse(readFileSync(path.join(monorepoRoot, '.prettierrc.json'), 'utf8'));

/** @soybeanjs/eslint-config 会把 `prettier/prettier` 插在用户片段之后；必须把关闭项放在整个数组末尾才能生效 */
export default defineConfig(
  {
    vue: true,
    unocss: true,
    cwd: monorepoRoot,
    usePrettierrc: false,
    prettierRules: {
      ...repoPrettier,
      /** Vue 模板格式化；与 @soybeanjs 内置一致 */
      htmlWhitespaceSensitivity: 'ignore',
    },
  },
  {
    // 插件自动生成，避免解析/语法差异导致 lint 失败
    ignores: [
      // 与根 .gitignore 的 build/ 一致：本地 Vite 插件目录不入库，勿参与检查
      'build/**',
      'src/typings/components.d.ts',
      'src/typings/elegant-router.d.ts',
      'src/router/elegant/**',
      // Vitest 运行期生成的临时配置，勿参与静态检查（cwd 为 apps/admin-web）
      'vitest.config.ts.timestamp-*.mjs',
    ],
  },
  {
    rules: {
      'vue/multi-word-component-names': [
        'warn',
        {
          ignores: ['index', 'App', 'Register', '[id]', '[url]'],
        },
      ],
      'vue/component-name-in-template-casing': [
        'warn',
        'PascalCase',
        {
          registeredComponentsOnly: false,
          ignores: ['/^icon-/'],
        },
      ],
      'unocss/order-attributify': 'off',
      // Vite 项目中 process.env / import.meta.env 是合法用法
      'n/prefer-global/process': 'off',
      // 部署脚本等场景存在合理的 shadow，降为 warn
      'no-shadow': 'off',
      // 历史代码中存在 ++ 用法，降为 warn 逐步修复
      'no-plusplus': 'off',
      // 允许 == null 简写（同时匹配 null 和 undefined）
      'no-eq-null': 'off',
    },
  },
  {
    // 脚本文件放宽
    files: ['scripts/**/*.cjs'],
    rules: {
      'no-console': 'off',
    },
  },
).then((configs) => [
  ...configs,
  {
    rules: {
      // 格式交给 .vscode Prettier + formatOnSave；此处关闭避免与 eslint-plugin-prettier 重复满屏提示
      'prettier/prettier': 'off',
    },
  },
]);
