import uniHelper from '@uni-helper/eslint-config';
import prettierConfig from 'eslint-config-prettier';

/** 格式由仓库根目录 Prettier 统一；关闭 antfu stylistic，并禁用与 Prettier 冲突的 ESLint 规则 */
export default uniHelper(
  {
    unocss: true,
    vue: true,
    markdown: false,
    stylistic: false,
    ignores: [
      // 忽略uni_modules目录
      '**/uni_modules/',
      // 忽略原生插件目录
      '**/nativeplugins/',
      'dist',
      // unplugin-auto-import 生成的类型文件，每次提交都改变，所以加入这里吧，与 .gitignore 配合使用
      'auto-import.d.ts',
      // vite-plugin-uni-pages 生成的类型文件，每次切换分支都一堆不同的，所以直接 .gitignore
      'uni-pages.d.ts',
      // 插件生成的文件
      'src/pages.json',
      'src/manifest.json',
      // 忽略自动生成文件
      'src/service/**',
    ],
    // https://eslint-config.antfu.me/rules
    rules: {
      'no-useless-return': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      'vue/no-unused-refs': 'off',
      'unused-imports/no-unused-vars': 'off',
      'eslint-comments/no-unlimited-disable': 'off',
      'jsdoc/check-param-names': 'off',
      'jsdoc/require-returns-description': 'off',
      'ts/no-empty-object-type': 'off',
      'no-extend-native': 'off',
      'vue/singleline-html-element-content-newline': [
        'error',
        {
          externalIgnores: ['text'],
        },
      ],
      // vue SFC 调换顺序改这里
      'vue/block-order': [
        'error',
        {
          order: [['script', 'template'], 'style'],
        },
      ],
    },
    formatters: {
      // Formatting authority is Prettier; ESLint keeps quality fixes only.
      css: false,
      html: false,
    },
  },
  {
    files: ['src/utils/systemInfo.ts'],
    rules: {
      // 条件编译分支内需先 let 再赋值后导出
      'import/no-mutable-exports': 'off',
    },
  },
).append(prettierConfig);
