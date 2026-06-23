---
title: Admin-Web Page Patterns
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-20
---

# Admin-Web Page Patterns

承接 admin-web AGENTS 中页面模式矩阵、根容器/分区文案/状态渲染等基线。规则正文以 `apps/admin-web/AGENTS.md` 为准。

## 1. 文件树与定位索引

这是一棵用于定位页面、API、状态和共享组件落点的文件树，不是完整文件清单。完整检索仍用 `rg --files apps/admin-web/src`。

```text
apps/admin-web/
├── src/
│   ├── views/                    # 页面事实入口；页面改动优先从这里定位
│   │   ├── _builtin/             # 登录、错误页、用户中心、OAuth、iframe
│   │   ├── home/                 # 首页仪表盘
│   │   ├── system/               # 系统管理：用户、角色、菜单、字典、租户、配置
│   │   ├── monitor/              # 系统监控：任务、日志、缓存、在线用户
│   │   ├── pms/                  # 商品基础资料：商品、分类、品牌、属性
│   │   ├── store/                # 门店运营：商品、订单、库存、分销、财务
│   │   ├── marketing/            # 营销中心：活动、优惠券、拼课、实例、决策
│   │   ├── finance/              # 财务中心：分销、清结算、内部共享展示
│   │   ├── member/               # 会员管理与升级申请
│   │   └── tool/                 # 开发工具
│   ├── service/
│   │   ├── api/                  # 后端接口封装；请求/响应类型优先来自 common-types
│   │   │   ├── system/
│   │   │   ├── monitor/
│   │   │   ├── pms/
│   │   │   ├── store/
│   │   │   ├── marketing/
│   │   │   ├── member/
│   │   │   ├── lbs/
│   │   │   └── tool/
│   │   └── request/              # 请求实例、拦截器、错误处理
│   ├── components/               # 全局通用组件
│   ├── hooks/                    # 通用 hooks 与业务 hooks
│   ├── store/                    # Pinia 状态
│   ├── router/                   # 路由、守卫、动态路由
│   ├── layouts/                  # 后台布局
│   ├── locales/                  # i18n 文案
│   ├── constants/                # 通用业务常量与展示映射
│   ├── styles/                   # 全局样式
│   ├── theme/                    # 主题配置
│   ├── utils/                    # 运行环境无关工具
│   ├── typings/                  # 前端本地类型声明
│   └── test/                     # 前端测试工具
├── packages/                     # admin-web 内部共享包，禁止给其他 app 当公共依赖
│   ├── alova/                    # 请求适配
│   ├── axios/                    # 请求适配
│   ├── hooks/                    # 内部共享 hooks
│   ├── materials/                # 物料
│   ├── ofetch/                   # 请求适配
│   ├── uno-preset/               # UnoCSS preset
│   └── utils/                    # 内部共享工具
├── build/                        # Vite / 构建插件
├── e2e/                          # E2E 测试
├── scripts/                      # admin-web 专用脚本
└── public/                       # 静态资源
```

定位规则：

- 页面功能先定位 `src/views/[module]/[entity]/index.vue`，再看同目录 `modules/*`、对应 `src/service/api/[module]/*` 和相邻测试。
- API 类型不要在页面层重写 backend 同义 DTO / VO；优先从 `@libs/common-types` 或既有 `src/service/api/*` 类型链路取得。
- 修改 `src/views/**`、列定义、`useTable` 或 `NDataTable` 时，必须按根规则补 `pnpm verify:admin-view-types`。
- 系统租户、字典、菜单、任务、登录和权限页面属于高风险入口，触达时先按根 `AGENTS.md` §3 停手确认。
- 普通页面扫描边界是"页面 index -> modules -> service/api -> 类型来源 -> 同模式参考页 -> 相关测试"；没有契约或高风险信号时不扩成全 admin-web 扫描。

## 2. 标准实体页目录

```text
src/views/[module]/[entity]/
├── index.vue
└── modules/
    ├── [entity]-operate-drawer.vue
    ├── [entity]-search.vue
    └── [entity]-[feature]-modal.vue
```

- `index.vue`：负责编排列表、搜索、弹层和主表格。
- `modules/*-drawer.vue`：表单、详情、配置。
- `modules/*-modal.vue`：确认、导入、批量操作。

## 3. 列表页拆分硬度

`index.vue` **必须拆分**的触发条件（满足任一即必须拆）：

1. 模板 + `<script setup>` 合计超过 **250 行**
2. 同时承载列表 + 搜索表单 + 抽屉 / 弹窗（任意 2 种以上）
3. columns 定义（含 render 函数）超过 **80 行**
4. 存在 **≥ 2 个批量操作**（批量删除 / 批量启用 / 批量导出等）

参考层级：

- 默认拆分参考 `system/tenant`、`system/role`、`marketing/coupon/template`：至少拆成 `index.vue + modules/*-search.vue`。
- 中等复杂度（列多、操作多、详情重）参考 `marketing/scene`、`marketing/course-group/*`：再拆 `modules/*-table-card.vue`、`modules/*-table-columns.tsx`、必要的指标卡或详情壳组件。

**例外**：纯只读、列数 ≤ 5、无搜索、无批量、无详情的简单展示页可一体；选用例外时在 `index.vue` 顶部加一行中文注释说明原因。

其余约束：

- `index.vue` 只做编排：拉取数据、组合搜索参数、协调抽屉/弹窗、拼装表格列与操作，不承载大段模板和大段列定义。
- 允许复用共享壳组件，但共享壳只能作为 `modules/*` 内部实现，不能替代标准目录结构。
- 新页面或重构页面前，先在 `system/` 或 `marketing/` 中找到同模式参考页；找不到参考页时，再单独说明原因。

## 4. 模块画像

- `_builtin/`：登录、错误页、用户中心、OAuth、iframe
- `home/`：首页仪表盘
- `system/`：系统管理
- `monitor/`：系统监控
- `pms/`：商品基础域
- `store/`：商城运营
- `marketing/`：营销中心
- `member/`：会员管理
- `tool/`：开发工具

## 5. 页面模式矩阵

| 页面模式       | 适用场景                     | 参考实现                        | 必查项                                 |
| -------------- | ---------------------------- | ------------------------------- | -------------------------------------- |
| 标准 CRUD 列表 | 扁平列表、搜索筛选、抽屉编辑 | `system/role`、`post`、`tenant` | API 类型、`useTable`、`operate-drawer` |
| 左树右表       | 左侧树筛选、右侧列表         | `system/user`、`post`           | 树选中联动、筛选残留                   |
| 左树主从       | 左侧树、右侧详情 + 子表      | `system/menu`、`dict`           | 选中态、详情刷新、主从一致性           |
| 树形表格       | 原生树结构展示               | `system/dept`                   | `idField`、层级展开、批量操作          |

新增页面先选模式，再落组件与 hooks；不要从空白页直接堆 UI。

## 6. 根容器样式选择

判断条件：是否是"单列表卡 + `NDataTable` 开启 `flex-height`"？

| 情况                                    | 根容器 class                                                                | 列表卡 class                                   |
| --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| 单列表卡 + `flex-height`                | `min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto` | `card-wrapper sm:flex-1-hidden`                |
| 多卡片纵向叠放 / 表格未开 `flex-height` | `overflow-y-auto`，必要时配 `min-h-0`                                       | 常规 `card-wrapper`，不强加 `sm:flex-1-hidden` |

禁止：根节点使用 `overflow-hidden` 却不提供内部滚动。

## 7. 分区与文案

- 搜索区、统计区、列表区、详情/配置区使用分卡片布局；卡片统一 `:bordered="false" size="small"`。
- 搜索区字段顺序遵循"核心主键 -> 业务类型 -> 状态 -> 时间 -> 操作按钮"，按钮区统一右对齐。
- 搜索区默认拆到 `modules/*-search.vue`；使用 `NCollapse` 时，必须显式给出 `default-expanded-names`，避免不同页面折叠行为漂移。
- 列表区统一 `NDataTable + remote + mobilePagination`，列名语义与菜单语义一致。
- 面向运营的页面文案禁止中英文混排，字段名、列名、按钮名优先使用简单直白的中文业务词。
- 禁止在列表、搜索、详情、抽屉、弹窗中直接展示原始英文枚举值、大写状态码、通道码或结算方式码，例如 `ACTIVE`、`PENDING`、`WECHAT_PAY`、`BANK_TRANSFER`。
- 状态、类型、通道、结算方式等用户可见语义，必须通过字典或统一映射转成易懂文案；同一语义在搜索、列表、详情、导出中必须保持一致。
- 租户、门店、用户、渠道对象等"人看得懂的主体"，默认展示"名称优先、编号次之"；禁止只给 `tenantId`、`storeId`、`userId` 让运营自行猜测。
- 表格列宽要按语义分层：状态列、操作列、金额列、时间列使用稳定宽度；编号、流水号、编码类字段使用 `minWidth + ellipsis`；同类语义列在同页内保持接近宽度，避免明显忽宽忽窄。
- 公共动作文案优先复用 `$t('common.search')`、`$t('common.reset')`、`$t('common.add')`、`$t('common.edit')`、`$t('common.delete')`。
- 新增或修改页面文案时，同步维护 `zh-cn.ts`、`en-us.ts` 与 `src/typings/app.d.ts`。

## 8. 中文注释规则

- `index.vue` 父页面的 `<template>` 注释要说明页面编排职责：搜索区维护哪些筛选模型、指标区基于什么结果汇总、表格/抽屉/弹窗承接什么业务动作。
- `modules/*.vue` 子组件的 `<template>` 注释要说明组件内部逻辑分区职责；搜索、指标、表格、详情、预检、异常提示等分区根节点上方各用一句 HTML 注释。
- `<script setup>` / TSX 中的 `watch` 联动、复杂 `computed`、提交前映射、错误处理段落、搜索/重置/保存方法，上方用中文注释说明数据流和边界。
- 注释必须说明前后端职责边界：哪些条件走后端查询、哪些只做当前页前端过滤、金额/状态/租户/权限等真实判定由哪里负责。
- 禁止逐行复述代码。
- 禁止只写“文案锚点”“TODO: Add Search”“这里是列表”这类无法解释业务链路的注释。
- 用户可见字符串一律走 `$t`；注释只描述结构、数据流、边界与注意点。

## 9. 状态与枚举渲染规范

§7 中已禁止直接渲染原始枚举字符串。本节补充**必须使用的具体工具**，按优先级从高到低：

| 方案                                                                                     | 适用场景                               | 参考实现                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `<DictTag value={row.x} dictCode="xxx" />`                                               | 字典治理管控的字段（性别、部门类型等） | `system/user` 性别列；需先调用 `useDict('xxx')`                                            |
| `enableStatusRecord[row.status]` + `<NTag>`                                              | 通用启用/停用二态                      | `apps/admin-web/src/constants/business.ts` 中的 `enableStatusRecord`；`system/role` 状态列 |
| 页面顶部集中声明 `const xStatusMap = { KEY: { label: '中文', type: '...' } }` + `<NTag>` | 当前页特有枚举（非字典、非通用二态）   | `marketing/asset` 状态列                                                                   |
| 模块已有 helper 函数                                                                     | 模块已建立集中 helper 的情况           | `finance-display.ts` 中的 `getFinanceXxxStatusLabel`                                       |

**禁止**:列 `render` 内写多分支内联三元（`row.s === 'A' ? '...' : row.s === 'B' ? '...' : row.s`），这类写法散落不可复用，且回退到原始值时直接暴露英文。

**关键文件**:

- `apps/admin-web/src/constants/business.ts`:`enableStatusRecord`、`dataScopeRecord` 等通用常量
- `apps/admin-web/src/components/custom/dict-tag.vue`:`<DictTag>` 组件
- `apps/admin-web/src/hooks/business/dict.ts`:`useDict(dictCode)` hook
