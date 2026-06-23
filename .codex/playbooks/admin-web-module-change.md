# Admin-Web Module Change

## 目标

为 admin-web 的页面、组件、路由、store、API 接入和交互治理提供完整执行手册，重点避免以下场景特有错误：

1. 页面模式选错，导致 `index.vue` 与 `modules/*` 拆分混乱
2. 同一语义在搜索、列表、详情、导出、弹层中表现不一致
3. 选中批量操作却循环调用单条接口
4. 页面主流程改了，却没有行为级验证

## 进入本手册前

先读根 `AGENTS.md` + `apps/admin-web/AGENTS.md`，再读本手册。涉及字典再读 `.codex/playbooks/dict-and-job-change.md`；涉及验证再读 `.codex/playbooks/verification-gates.md`。本手册只补 admin-web 场景特有流程，不重复通用禁区。

## admin-web 改动分类

先判断当前属于哪类：

- 页面模块改动
- 路由改动
- `src/service/api/*` 改动
- store / hooks / composable 改动
- 字典联动页改动
- 高风险页面改动
- 跨 app 契约改动

## 默认顺序

1. 先确定页面模式、改动边界和高风险级别
2. 再确认 API 与类型来源
3. 再确认用户可见语义来源
4. 再决定页面结构、批量动作、表单提交体和交互反馈
5. 最后补行为验证与回归验证

## 输出协议与分析要求

按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 输出。admin-web 场景额外覆盖：Mermaid 页面流程图 + 关键代码位置 + 真实数据流。

## 必查事项

### API、类型与提交体来源

- 创建接口与更新接口如果 DTO 不同，前端必须分别声明 `SaveXxxPayload` / `UpdateXxxPayload` 并分别构造提交体；不要复用创建 payload 调更新接口。
- `NSelect` 的 option value 只用稳定标量（优先 `string` / `number`）；布尔或三态语义统一通过 `computed` / `@update:value` 映射，不要直接把 `boolean` / `null` 塞给 `NSelect`。

必须确认：

- 请求与响应类型是否优先来自 `@libs/common-types` 或 backend 生成链路
- 本地类型是 view-model / UI-only 状态，还是错误地重复定义了后端契约
- 提交体是否显式映射到后端 DTO 白名单字段
- backend 契约变化后，是否已确认 `pnpm generate-types` 链路

允许本地类型的场景：

- 纯前端展示态
- 纯组件内部状态
- 将多个后端字段组合成单一 view-model
- backend 尚未导出、且本次没有条件同步迁入共享类型体系的临时兼容层

通用类型与契约禁区见根 `AGENTS.md` §0 硬规则 5-7 + `libs/AGENTS.md` 契约约束；本节只强调 admin-web 内部的提交体拆分与 UI 类型边界。

### 用户可见语义与文案治理

以下内容视为同一类“用户可见语义”：

- 状态
- 阶段
- 类型
- 启停
- 角色
- 支付状态
- 审核状态
- 布尔语义
- 风险标签

默认规则：

1. 若该语义属于字典治理范围，必须通过 `useDict`、`dict-code` 或统一字典组件来源获取
2. 若不是字典，也必须集中到统一的 `statusMeta`、`statusMap`、`resolveXxxStatus` 等单一来源
3. 列表、搜索、详情、导出、统计卡、弹窗、批量确认文案必须使用同一语义来源
4. 用户可见面禁止直接展示原始英文枚举值、数据库 code 或未经确认的 `xxxText`
5. 面向运营的页面，字段名、列名、状态名、通道名、结算方式名必须优先使用简单直白的中文，不要把实现细节词直接暴露给运营
6. 租户、门店、用户、渠道对象等主体信息，默认展示“名称优先、编号次之”；只展示编号视为信息不完整

重点禁止：

- 直接把 `ACTIVE`、`DISABLED`、`PENDING`、`WECHAT_PAY`、`WECHAT_PROFITSHARING`、`BANK_TRANSFER` 之类的大写英文原样给运营看
- 列表页标题写实现词、接口词、数据库词，而不是业务词
- 搜索区、列表区、详情区对同一字段一处叫“支付通道”、另一处叫“channelType”、第三处叫“通道类型编码”

`xxxText` 字段直出的前提：

- backend 契约明确承诺它是稳定的、已本地化的用户文案
- 已确认同一语义在其他页面没有另一套本地映射
- 已确认导出、筛选、日志、详情等其他展示面不会出现语义分裂

通用语义禁区见根 `AGENTS.md` §3 高风险入口（字典治理）；本节只强调 admin-web 多展示面的一致性。

### 页面结构与交互模式

优先遵循 `apps/admin-web/AGENTS.md` 中的页面模式与目录结构，不从空白页堆 UI。

标准参考页：

- 标准单列表页：`system/tenant`、`system/role`、`marketing/coupon/template`
- 复杂列表页：`marketing/scene`、`marketing/course-group/team`

必须确认：

- `index.vue` 是否只负责编排，而不是塞满所有逻辑
- 搜索区、列表区、详情/配置区是否沿用同域现有模式
- 是否至少拆出 `modules/*-search.vue`；复杂列表是否继续拆 `modules/*-table-card.vue`、`modules/*-table-columns.tsx`
- 搜索区折叠、列表卡标题、表格头部操作区是否与参考页保持同一类布局
- 即使复用共享壳组件，也是否仍保留标准模块拆分，而不是把整页重新塞回 `index.vue`
- 表单、详情、配置类编辑是否优先用 Drawer
- 批量操作、导入、确认类交互是否优先用 Modal
- 表格列宽是否按语义分层统一，而不是同类字段宽度漂移明显

### 批量操作与删除语义

默认原则：

1. 选中多条记录时，优先调用批量接口
2. 已存在 `fetchBatchDelete...`、批量启停、批量绑定等接口时，不再循环调用单条接口
3. 若后端只有单条接口，先确认是否应补批量能力，而不是直接在前端写循环
4. 若确实只能逐条调用，必须说明原因，并设计部分失败、逐条反馈与刷新策略

禁止：

- `checkedRowKeys.forEach(async id => fetchDeleteXxx(id))` 这类无治理的逐条删除
- 批量操作成功后只提示一次，却不考虑部分失败或列表回刷一致性

### 路由、权限与高风险页面

完整触发条件与停手协议见根 `AGENTS.md` §3 + `apps/admin-web/AGENTS.md` §8。

admin-web 改动时额外需要警惕的传播面：

- 影响多个页面共享搜索、共享状态映射、共享 hooks 的改动

这类改动不要只在当前页面“看起来能跑”就结束，必须检查传播面。

## 测试与验证要求

### 什么测试不足以证明正确

以下测试只能算 smoke，不足以单独作为完成证据：

- 只 mock `request` 然后断言 `url`、`method`、`data`
- 直接 `readFileSync` 源码后 `toContain(...)`
- 只断言某个函数被调用，没有验证用户可见行为
- 只验证静态文案存在，没有验证筛选、表格、弹层、提交或权限路径

### 本次改动至少要覆盖什么

普通页面、组件、hooks 改动：

- 至少有能证明用户行为的验证方式
- 至少确认搜索、列表、详情、抽屉或弹窗中的关键链路没有语义漂移

页面主流程、路由、权限、高风险页面改动：

- 必须优先考虑 E2E 或等价的行为级验证
- 必须覆盖成功路径、失败路径和关键边界

状态语义或文案治理改动：

- 必须验证列表、搜索、详情至少三个展示面的一致性

### 建议验证命令

普通组件 / hooks / API：

```powershell
pnpm --filter @apps/admin-web typecheck
```

页面或路由改动：

```powershell
pnpm --filter @apps/admin-web typecheck
pnpm verify:admin-view-types
pnpm --filter @apps/admin-web test:e2e
```

附加要求：

- `pnpm verify:admin-view-types` 的触发条件与原因见 `apps/admin-web/AGENTS.md`。
- 本手册只额外强调：页面主流程、路由、权限和高风险页面改动，应优先补行为级验证，而不是停留在 request 配置测试。

字典联动页：

- 额外检查字典来源、展示一致性和提交映射

注意：

- coverage 报表没有 threshold 时，不得把“有 coverage”当作通过证据
- request 配置测试可以保留，但只能当作补充，不是主验证

## 交付前自查

- API 类型来源是否正确
- 是否仍存在散落的 `statusOptions`、原始 code 直出或英文文案泄漏
- 列表、搜索、详情、导出、弹层是否语义一致
- 是否对照过至少一个同模式参考页，而不是临时拼出新布局
- 是否仍把大量搜索区和表格细节堆在 `index.vue`，没有按 `modules/*` 拆分
- 是否仍有运营看不懂的大写英文状态、通道、结算方式或内部实现词
- 租户、门店、用户等主体字段是否只展示编号，没有名称
- 同类列宽是否明显不一致，导致页面观感发散
- 是否误把整行对象直接提交给后端
- 批量操作是否沿用了批量接口或解释了逐条调用原因
- 是否提供了行为验证，而不只是 smoke 测试

## admin-web 常见返工点

- `src/service/api/*` 手写一套与 backend 漂移的接口类型
- 同一状态在不同页面各写一套 `switch` / `map`
- 直接渲染 `statusText`、`teamStatusText` 却没确认契约来源
- 改了 `src/views/**` 里的表格页面，却只跑包装后的 `typecheck:admin`
- 已有批量接口仍在前端循环单删
- 测试只断言 request 配置或源码字符串
