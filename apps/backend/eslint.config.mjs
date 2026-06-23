import rootConfig from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  {
    rules: {
      // NestJS 大量使用装饰器和空接口，放宽相关规则
      '@typescript-eslint/no-empty-object-type': 'off',
      // NestJS 依赖注入需要构造函数参数，允许空构造函数
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'off',
      // 后端 console 由 logger 替代，但不阻塞开发
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // 测试文件放宽规则
    // HARNESS_AUDIT §2.7：no-explicit-any 与 ban-ts-comment 从 off 调整为 warn，
    // 让 spec 中 754 处 `as any` + 99 处 @ts-(ignore|nocheck) 可见。
    // console 仍 off（spec 里需要打调试日志）。
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': ['warn', { 'ts-ignore': 'allow-with-description' }],
      'no-console': 'off',
    },
  },
  {
    // 脚本文件放宽
    files: ['scripts/**/*.cjs', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    // Prisma seed 脚本需要 console 输出进度，且含动态 SQL
    files: ['prisma/seed.ts', 'prisma/seed-pipeline.ts', 'prisma/seed-platform-hunan.ts', 'prisma/seeds/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**', 'scripts/**/*.cjs'],
  },
];
