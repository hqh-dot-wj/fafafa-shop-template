# Miniapp Client（小程序端）

基于 uniapp + Vue3 + TypeScript + wot-design-uni 的多端小程序。

## 技术栈

| 技术           | 版本                   | 用途       |
| -------------- | ---------------------- | ---------- |
| uniapp         | 3.0 (4070620250821001) | 跨端框架   |
| Vue 3          | catalog                | UI 框架    |
| TypeScript     | catalog                | 类型安全   |
| UnoCSS         | 66.0.0                 | 原子化 CSS |
| wot-design-uni | latest                 | UI 组件库  |
| z-paging       | 2.8.7                  | 分页组件   |
| Alova          | 3.x                    | 请求库     |
| Pinia          | catalog                | 状态管理   |

## 开发

```bash
pnpm dev:mp          # 微信小程序开发模式
pnpm dev:h5          # H5 开发模式
pnpm build:mp        # 构建微信小程序
```

## 目录结构

| 目录            | 用途              |
| --------------- | ----------------- |
| src/pages/      | 页面              |
| src/pages-auth/ | 登录/授权相关页面 |
| src/components/ | 全局组件          |
| src/api/        | API 接口          |
| src/store/      | Pinia 状态管理    |
| src/http/       | HTTP 请求封装     |
| src/hooks/      | 组合式函数        |
| src/service/    | 业务服务层        |
| src/utils/      | 工具函数          |
| src/types/      | 类型定义          |
| src/layouts/    | 页面布局          |
| src/style/      | 全局样式          |
| src/tabbar/     | 底部导航栏        |

## 关联

- 后端 API → apps/backend/
- 管理后台 → apps/admin-web/
- 共享类型 → libs/common-types/
