---
title: Admin-Web Troubleshooting
status: active
doc_type: agent-supplement
owner: engineering-governance
last_verified: 2026-05-15
---

# Admin-Web Troubleshooting

承接 admin-web AGENTS 中"遇到这类报错怎么办"的查询表。规则正文以 `apps/admin-web/AGENTS.md` 为准。

## 1. IDE / TS 爆红查询表

| 报错信号                                                                     | 触发条件                                      | 推荐写法                                                                                                            |
| ---------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `apiFn` 不能赋给 `TableApiFn`；`PaginatingQueryRecord` 缺 `pageNum/pageSize` | `request<>` 只写了 `{ rows, total }`          | 在 `*.api.d.ts` 声明 `type XxxList = Api.Common.PaginatingQueryRecord<Row>`，`fetchXxxList` 使用 `request<XxxList>` |
| `TableColumn<TableDataWithIndex<T>>` 不能赋给 `TableColumn<T>`               | `useHookTable` transformer 给每行加了 `index` | `NDataTable` 封装的 `columns` / `data` / `row-key` 统一使用 `NaiveUI.TableDataWithIndex<业务行类型>`                |
| `Type '{ label; value }[]' is not assignable to SelectMixedOption[]`         | `NSelect` 使用未标注的裸 option 对象          | `options` 显式声明为 `SelectOption[]` 或 `computed((): SelectOption[] => ...)`                                      |
| `NSelect` 绑定 `boolean` / `boolean \| null`                                 | 用布尔或三态直接当 option value               | 统一改为稳定标量（如 `'true'` / `'false'` / `''`），提交时映射回 `boolean \| null \| undefined`                     |
| `import/order` 报 `@/locales` 顺序问题                                       | import 分组不符合规则                         | `@/locales` 放在 `@/components` 之后、本地 `./` 之前                                                                |
| `@typescript-eslint/no-use-before-define`                                    | `<script setup>` 中状态声明在使用点之后       | 先声明 `ref` / `reactive` / `computed`，再写 `getData`、树回调等                                                    |
| `@typescript-eslint/no-shadow`                                               | 解构 `data` 与外层 `data` 重名                | 改名为 `listData`、`versionRows` 等                                                                                 |
| `no-underscore-dangle`                                                       | 局部变量使用 `_draftXxx` 一类命名             | 改为 `originalSku`、`draftStockChange` 等可读名                                                                     |
| `eqeqeq` 与可选数值判断冲突                                                  | 需要排除 `null/undefined` 又保留 `0`          | 用 `typeof x === 'number'` 等显式判断                                                                               |
| 列头 i18n 切换后不刷新                                                       | 在静态数组里直接调用 `$t`                     | 把列定义放进 `computed(() => [...])`                                                                                |
| `getRoutePath` 不接受任意 `string`                                           | 传入值不是 `RouteKey`                         | 静态路由名直接用 `RouteKey`；外部字符串调用前集中断言并校验                                                         |
| 提交接口被 Nest `forbidNonWhitelisted` 拒绝                                  | 直接把整行 row / create payload 传给 update   | 分别声明 `SaveXxxPayload` / `UpdateXxxPayload`，显式 `Pick` / `WriteBody` 映射                                      |

## 2. components.d.ts 自动生成相关

- 由 `unplugin-vue-components` 自动生成；不要手改业务逻辑。
- 已知问题：部分 Iconify 名称含 `:` 时会生成非法 TS。
- 本仓通过 `build/plugins/sanitize-components-dts.ts` 在构建与开发阶段自动修复。
- 拉代码后若仍见旧语法，执行一次 `pnpm --filter @apps/admin-web dev` 或 `pnpm --filter @apps/admin-web build` 即可重写修复。
- `components.d.ts` 作为自动生成文件默认不提交进库；需要刷新本地类型解析时，重跑 `dev` 或 `build` 即可。

## 3. Prettier / ESLint

- 格式以仓库根 `.prettierrc.json` 为准。
- `@soybeanjs/eslint-config` 已处理与 Prettier 的配合，不要把 ESLint 当第二套格式化器。
- 合并前可用 `pnpm --filter @apps/admin-web lint` 查质量类问题；统一排版时用 Prettier。
