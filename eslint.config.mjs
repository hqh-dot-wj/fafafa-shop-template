import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // -- 类型安全 --
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // -- 代码质量 --
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'no-duplicate-imports': ['warn', { includeExports: false }],
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'smart'],

      // -- HARNESS_AUDIT 阶段 1（warn-only 出报告） --
      // 函数同时返回 void 与值（漏 return 的常见来源）
      'consistent-return': 'warn',
      'no-restricted-syntax': [
        'warn',
        {
          // forwardRef(() => require(...).XxxModule)：让 TS 看不见 import 边，
          // 绕过 import/no-cycle。HARNESS_AUDIT §2.2
          selector: "CallExpression[callee.name='forwardRef'] CallExpression[callee.name='require']",
          message:
            '禁止 forwardRef + require()：require() 让 TS 看不见 import 边，会绕过环检测。改用 Port / ContractModule / 类型仅引用。',
        },
        {
          // 业务 service 里 setInterval 通常是补偿机制，应改用 @Cron / SchedulerRegistry / Bull。
          // HARNESS_AUDIT §2.4。合理用法（锁续租、abort timeout）也会命中，故为 warn 而非 error。
          selector: "CallExpression[callee.name='setInterval']",
          message:
            'Nest service 中 setInterval 多为补偿机制；改用 @Cron + SchedulerRegistry 或 Bull。若是锁续租/Abort，请在该处加 eslint-disable-next-line 说明。',
        },
      ],
    },
  },
  {
    // Prisma seed 需要 console 输出进度
    files: ['**/prisma/seed.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // 仓库治理脚本在 Node 环境运行，lint-staged 会从根目录直接检查这些文件
    files: ['scripts/**/*.mjs', 'scripts/**/*.cjs'],
    languageOptions: {
      globals: {
        AbortController: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // pre-commit 在仓库根对 apps/backend/**/*.ts 跑 eslint，不会自动加载 apps/backend/eslint.config.mjs
    // 与 backend 包内规则对齐，避免 declaration merge 等空接口误报
    files: ['apps/backend/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
    },
  },
  {
    // 营销落地页为独立静态资源（浏览器全局 gsap/ScrollTrigger），不走 monorepo TS 门禁
    ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', 'deploy/sites/**'],
  },
];
