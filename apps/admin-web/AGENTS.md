# Admin-Web 前端指引

## 1. 速览

- 技术栈：Vue3 + Pinia + VueUse + Naive UI + `@elegant-router/vue` + TypeScript
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. `.codex/playbooks/admin-web-module-change.md`
  4. 涉及验证再看 `.codex/playbooks/verification-gates.md`
  5. 涉及字典再看 `.codex/playbooks/dict-and-job-change.md`
- 涉及页面梳理、方案设计、Mock、函数/接口改动分析、进入实施前分析或交付说明时，再读 `docs/governance/AGENT_OUTPUT_PROTOCOL.md`。
- 按场景深读：[`docs/page-patterns.md`](./docs/page-patterns.md)（文件树、页面模式、根容器、文案、状态渲染）、[`docs/conventions.md`](./docs/conventions.md)（API 类型、Naive UI hooks、列名）、[`docs/troubleshooting.md`](./docs/troubleshooting.md)（TS 爆红、components.d.ts、Prettier）。
- 根 `AGENTS.md` 已覆盖：任务决策树、通用高风险、统一反模式、跨 app 顺序、统一验证要求。
- 本文件只保留 admin-web 特有硬约束：反模式、高风险页面清单、E2E 触发条件、验证补充。

## 2. 目录与页面模式

文件树、定位规则、标准实体页目录、拆分硬度、模块画像、页面模式矩阵详见 [`docs/page-patterns.md`](./docs/page-patterns.md)。

## 3. 环境与命令

- 开发：`pnpm dev:admin`
- 构建：`pnpm build:admin`
- 类型检查：`pnpm typecheck:admin` 或 `pnpm --filter @apps/admin-web typecheck`
- views 类型门禁：`pnpm verify:admin-view-types`
- Lint：`pnpm --filter @apps/admin-web lint`
- 格式化：`pnpm --filter @apps/admin-web format`

默认规则：

- 页面、路由、接口联调优先用 `pnpm dev:admin`。
- 页面开发、自检布局、查看表格交互、核对文案时，默认使用 `pnpm dev:admin`，不要把 `pnpm build:admin` 当成日常开发自检。
- `pnpm build:admin` 只用于验证构建产物、定位打包问题、用户明确要求，或确实需要检查生产构建差异时再执行。
- backend 契约变更后，先确认 `pnpm generate-types` 是否已执行，再写 `src/service/api/*` 或页面类型。
- 改动 `src/views/**`、`useTable` 页面、`NDataTable` 表格封装或列定义时，必须补跑 `pnpm verify:admin-view-types`。
- 是否执行 E2E、lint、typecheck，由用户指令与任务风险决定；未执行时必须在交付中说明。

### 3.1 统一输出协议

按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 输出。admin-web 页面类任务额外覆盖：Mermaid 页面流程图、真实数据流、页面与直接上下游"关联闭环"收口。

## 4. admin-web 特有反模式

通用反模式（测试 / Mock / 假绿等）见根 `AGENTS.md` §5。以下只列 admin-web 特有项：

- `useTable` 分页体缺 `pageNum` / `pageSize`
- `TableDataWithIndex` 与表格卡片类型不一致
- `NSelect` 未使用 `SelectOption[]`，或直接绑定 `boolean` / `null`
- `getRoutePath` 误传任意 `string`
- 页面模式选错，导致 `index.vue` 与 `modules/*` 拆分混乱
- Drawer 打开/关闭后表单状态未重置，或 `restoreValidation()` 缺失
- 树筛选切换后，右侧列表仍残留旧搜索条件
- 路由 meta、菜单权限、接口权限不一致
- 搜索、列表、详情、弹层对同一语义使用不同文案或不同状态来源
- `NDataTable` 列 `render` 中直接输出 `row.status`、`row.type` 等原始枚举字符串（`PENDING`、`SUCCESS`、`ENABLED` 等英文大写）——后台管理系统面向运营，每个状态列必须通过翻译映射后展示中文
- 状态列翻译映射散落在各页面各写一套，而非使用 `DictTag`、`enableStatusRecord`（`constants/business.ts`）或模块集中 `labelMap`
- 列名使用英文字段名或无意义缩写（如写 `"roleName"` 而非 `"角色名称"`、写 `"status"` 而非 `"状态"`）

## 5. 高风险页面清单

完整高风险触发条件与停手协议见根 `AGENTS.md` §3。admin-web 独有高风险页面清单：

| 页面或模块                 | 风险原因                       |
| -------------------------- | ------------------------------ |
| `system/tenant`            | 平台级权限、租户语义           |
| `system/dict`              | 字典治理链路                   |
| `system/menu`              | 动态路由、权限 meta            |
| `monitor/job`              | 定时任务调度与后台任务页联动   |
| `system/system-config`     | 平台级系统配置                 |
| 登录、权限、用户态相关页面 | 认证授权、菜单权限、用户态传播 |

## 6. 测试与验证

通用验证分层见 `.codex/playbooks/verification-gates.md`。本文件只补 admin-web 特有触发条件。

### 6.1 E2E 触发表

| 改动类型                           | 是否建议 E2E |
| ---------------------------------- | ------------ |
| 纯样式或局部组件调整               | 通常不需要   |
| 页面主流程、搜索、表格操作改动     | 建议         |
| 动态路由、菜单、权限改动           | 强烈建议     |
| 登录后访问路径改动                 | 强烈建议     |
| 任务管理、字典管理、系统配置页改动 | 建议         |

### 6.2 admin-web 最小验证

完整最小验证矩阵见根 `AGENTS.md` §6。admin-web 附加要求：

- 高风险页面改动优先 `pnpm --filter @apps/admin-web test:e2e` 或等价行为级验证
- 字典联动页须同步检查字典来源、列表/搜索/详情一致性

当前会话是否执行这些命令，由用户指令决定；若未执行，交付时必须明确推荐验证集。

## 7. 交付与提交

- 提交信息格式沿用根 `AGENTS.md`：`<type>(admin-web): <中文描述>`。
- PR 说明写清改动页面、路由、权限、接口、字典依赖和共享类型影响。
- 页面视觉或交互改动建议附截图或录屏。
- 禁止把无关页面重构、全量格式化或与需求无关的规则修正混入同一个 PR。
