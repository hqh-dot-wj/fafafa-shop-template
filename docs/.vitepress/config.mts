import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'Nest-Admin-Soybean',
  description: '企业级全栈管理系统 - 开箱即用的解决方案',
  base: '/O2O-Mall-project/',
  ignoreDeadLinks: true,

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',

    nav: [
      { text: '治理', link: '/governance/ENGINEERING_CONSTITUTION' },
      { text: 'ADR', link: '/adr/' },
      { text: '领域', link: '/domain/' },
      { text: '开发', link: '/development/getting-started' },
      { text: '功能特性', link: '/features/demo-account' },
      { text: '优化文档', link: '/optimization/overview' },
    ],

    sidebar: {
      '/governance/': [
        {
          text: '治理',
          items: [
            { text: '工程宪章', link: '/governance/ENGINEERING_CONSTITUTION' },
            { text: '文档治理策略', link: '/governance/DOCUMENT_POLICY' },
          ],
        },
      ],
      '/adr/': [
        {
          text: '架构决策（ADR）',
          items: [
            { text: '索引', link: '/adr/' },
            { text: 'TypeScript strictNullChecks', link: '/adr/adr-ts-strictness' },
            { text: 'ESLint 分层', link: '/adr/adr-eslint-layering' },
          ],
        },
      ],
      '/domain/': [
        {
          text: '领域',
          items: [
            { text: '说明', link: '/domain/' },
            { text: '术语表', link: '/domain/glossary' },
          ],
        },
      ],
      '/development/': [
        {
          text: '开发指南',
          items: [
            { text: '开始开发', link: '/development/getting-started' },
            { text: '配置说明', link: '/development/configuration' },
            { text: '数据库开发', link: '/development/database' },
            { text: 'API开发', link: '/development/api' },
          ],
        },
        {
          text: '前端开发',
          items: [
            { text: '前端架构', link: '/development/frontend-architecture' },
            { text: '路由系统', link: '/development/routing' },
            { text: '组件开发', link: '/development/components' },
            { text: '状态管理', link: '/development/state-management' },
          ],
        },
        {
          text: '后端开发',
          items: [
            { text: '后端架构', link: '/development/backend-architecture' },
            { text: '模块开发', link: '/development/modules' },
            { text: '权限控制', link: '/development/permissions' },
            { text: '错误处理', link: '/development/error-handling' },
          ],
        },
        {
          text: '最佳实践',
          items: [
            { text: '代码规范', link: '/development/code-style' },
            { text: '性能优化', link: '/development/performance' },
            { text: '安全实践', link: '/development/security' },
          ],
        },
      ],
      '/features/': [
        {
          text: '功能特性',
          items: [
            { text: '演示账户系统', link: '/features/demo-account' },
            { text: '系统管理', link: '/features/system-management' },
            { text: '租户管理', link: '/features/tenant-management' },
            { text: '监控中心', link: '/features/monitoring' },
            { text: '文件管理', link: '/features/file-management' },
            { text: '定时任务', link: '/features/scheduled-tasks' },
          ],
        },
      ],
      '/optimization/': [
        {
          text: '优化文档',
          items: [
            { text: '优化概述', link: '/optimization/overview' },
            { text: '架构优化', link: '/optimization/architecture' },
            { text: '性能优化', link: '/optimization/performance' },
            { text: '安全优化', link: '/optimization/security' },
            { text: '代码质量优化', link: '/optimization/code-quality' },
          ],
        },
      ],
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/hqh-dot-wj/O2O-Mall-project' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present Nest-Admin-Soybean',
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
      label: '目录',
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short',
      },
    },

    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
});
