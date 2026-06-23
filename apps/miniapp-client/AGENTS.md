# Miniapp-Client 小程序指引

## 1. 速览

- 技术栈：uniapp + Vue3 + TypeScript + Vite5 + UnoCSS + wot-design-uni
- 先读顺序：
  1. 根 `AGENTS.md`
  2. 本文件
  3. `.codex/playbooks/miniapp-page-change.md`
  4. 涉及验证再看 `.codex/playbooks/verification-gates.md`
  5. 涉及跨端语义或字典再看 `.codex/playbooks/dict-and-job-change.md`
- 涉及页面梳理、方案设计、Mock、函数/接口改动分析、进入实施前分析或交付说明时，再读 `docs/governance/AGENT_OUTPUT_PROTOCOL.md`。
- 按场景深读：[`docs/agent-map.md`](./docs/agent-map.md)（文件树、目录结构、页面类型矩阵）、[`docs/troubleshooting.md`](./docs/troubleshooting.md)（常见故障模式表）。
- 根 `AGENTS.md` 已覆盖：任务决策树、通用高风险、统一反模式、跨 app 契约链路、统一验证要求。
- 本文件只保留 miniapp 特有硬约束：反模式、双端边界、布局红线、高风险链路、用户语义统一、验证补充。

## 2. 目录与页面类型

文件树、目录结构、页面类型矩阵详见 [`docs/agent-map.md`](./docs/agent-map.md)。

## 3. 环境与命令

- 开发：`pnpm dev:mp`（根目录）/ `pnpm --filter @apps/miniapp-client dev:h5`（仅 H5）
- 构建：`pnpm build:mp`（根目录）/ `pnpm --filter @apps/miniapp-client build:h5`（仅 H5）
- Lint：`pnpm lint:h5`
- 类型检查：`pnpm typecheck:h5`

默认规则：

- 先判断问题发生在 H5、MP 还是双端，再选择运行命令。
- 小程序 / H5 页面开发、自检交互与布局时，根目录用 `pnpm dev:mp`；仅 H5 用 `pnpm --filter @apps/miniapp-client dev:h5`。
- 不要把构建命令当成日常开发自检；只有在验证构建产物、定位平台打包问题、用户明确要求时才执行 build。
- 涉及布局、滚动、安全区时，优先在对应平台现场验证，不要只在一种端上推断另一端行为。
- backend 契约变更后，先确认共享类型或接口映射是否同步，再继续改页面交互与 store。

### 3.1 统一输出协议

按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 输出。miniapp 页面类任务额外覆盖：Mermaid 页面流程图、真实数据流、H5 / MP 双端边界、页面/store/api 与直接上下游"关联闭环"收口。

## 4. miniapp 特有反模式

通用反模式（测试 / Mock / 假绿等）见根 `AGENTS.md` §5。以下只列 miniapp 特有项：

- 只在 H5 测过，就默认 MP 也正常
- 用运行时平台判断替代条件编译
- 页面根容器、`scroll-view`、安全区链路没理顺，就先改业务逻辑
- 页面直接散落 request 实现，绕开 `src/api/` 与 `src/store/`
- 详情页、卡片、结果页、进度组件对同一状态各维护一套映射
- 高风险链路只验证 happy path，不验证回跳、刷新、失败和页面重进语义
- 布局问题靠业务逻辑补救滚动或安全区问题

## 5. API、类型与状态边界

### 5.1 API 映射

miniapp-client 通过 `src/api/` 调 backend，主要前缀为 `/client/*`：

- 认证：`api/login.ts`
- 商品：`api/product.ts`
- 订单：`api/order.ts`
- 支付：`api/payment.ts`
- 地址：`api/address.ts`
- 分销与升级：`api/distribution.ts`、`api/upgrade.ts`

### 5.2 类型来源

- API 请求/响应类型优先使用 `@libs/common-types`
- backend 尚未导出的类型，才允许在本地临时定义
- 临时本地类型后续优先迁回共享类型体系

### 5.3 组织约定

- 全局可复用能力放 `src/components/`，页面私有 UI 放 `src/pages/xx/components/`
- API 调用放 `src/api/`，不要在页面里直接散落请求实现
- 状态优先沉淀到 `src/store/`，避免多个页面各自维护一套登录态、订单态或支付态逻辑
- 页面、组件、store 命名贴近业务语义，不使用含糊缩写

## 6. 双端边界与布局红线

### 6.1 通用规则

- 平台差异必须用条件编译，不要用运行时平台判断替代
- 颜色、字号、间距、圆角优先使用 Design Token 与 UnoCSS 语义类
- 布局问题先修容器链、滚动链和安全区，再动业务逻辑
- 弹层优先使用组件自带 `lock-scroll` 等能力，不手写一套滚动锁实现
- 需要区分 H5 / MP 的样式或交互时，优先显式写出平台边界

### 6.2 整页固定头尾 + 中间滚动

Tab 页采用“固定头尾 + 中间 `scroll-view`”时，必须：

1. `definePage` 设 `disableScroll: true`
2. 根容器配合 `overflow: hidden`
3. 弹层使用组件自带 `lock-scroll`

### 6.3 H5 特有红线

带自定义 Tabbar 的 H5 页面，若需要防止整页滚动导致顶栏被带走：

- 页面根容器在 H5 下使用 `position: fixed`
- `bottom: var(--tabbar-total-height)`
- 顶边根据是否自定义导航选择：
  - `top: 0`
  - 或 `top: var(--window-top, 44px)`

`page-meta` 可辅助，但不能当作 H5 禁止整页滚动的唯一手段。

## 7. 用户可见语义与高风险链路

### 7.1 语义统一

以下语义必须有统一来源，不能在多个页面和组件各写一套：

- 团状态
- 支付状态
- 成员角色
- 订单状态
- 升级申请状态
- 分销等级或团队身份

默认规则：

- 不直接展示原始 code、数据库原值或临时 fallback 文案
- 若后端返回 `statusText`、`teamStatusText`、`payStatusText` 等字段，必须确认其为稳定可展示语义
- 同一语义在列表、详情、卡片、进度组件、分享文案、结果页中必须一致

### 7.2 高风险链路检查表

完整高风险触发条件与停手协议见根 `AGENTS.md` §3。miniapp 独有高风险链路：

| 链路        | 必查项                               |
| ----------- | ------------------------------------ |
| 登录注册    | token 写入、刷新、回跳、授权失败处理 |
| 下单        | 预览数据、提交幂等、地址和商品状态   |
| 支付结果    | prepay 返回、支付后刷新、结果页回跳  |
| 升级 / 分销 | 申请状态、推荐码、团队统计、角色切换 |

以下页面或流程默认属于高风险：

- `pages-auth/login.vue`
- `pages/order/create.vue`
- `pages/pay/result.vue`
- `pages/upgrade/*`

### 7.3 敏感链路提示

- 登录、支付、下单、分销升级链路改动时，同时检查 token、回跳、签名、订单状态刷新和用户态一致性
- 不在页面层硬编码认证、支付、分销语义；优先复用现有 `api`、`store`、拦截器和公共组件
- 涉及平台差异、分享态、授权态、支付回调时，必须明确 H5 与 MP 的边界

## 8. 测试与验证

通用验证分层见 `.codex/playbooks/verification-gates.md`。本文件只补 miniapp 特有触发条件。

### 8.1 miniapp 最小验证

完整最小验证矩阵见根 `AGENTS.md` §6。miniapp 附加要求：

- 布局 / 条件编译 / tabbar 改动须补对应平台（H5 或 MP）人工行为验证
- 高风险链路（登录 / 支付 / 订单 / 升级 / 分销）须补联调或人工流程验证，并分别说明 H5 与 MP 验证结论

当前会话是否执行这些命令，由用户指令决定；若未执行，必须在交付说明里列出推荐验证项。

### 8.2 高风险链路验证要求

- 必须覆盖成功路径、失败路径和回跳 / 重进语义
- 若声明影响双端，必须分别说明 H5 与 MP 的验证结论
- 布局与滚动问题至少验证容器链、滚动链、安全区和弹层滚动行为

## 9. 交付与提交

- 提交信息格式沿用根 `AGENTS.md`：`<type>(miniapp-client): <中文描述>`
- PR 说明必须写清影响平台：H5、MP 还是双端
- 页面交互、布局、安全区、支付结果等改动，建议附截图或录屏，并写清人工验证路径
- 若改动依赖 backend 接口或共享类型调整，需要在 PR 中说明对应接口、字段和联调影响
