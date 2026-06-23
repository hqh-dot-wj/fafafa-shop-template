# Context Scan

## 目标

在进入实现前，按当前任务范围收集充分上下文与证据，同时强制检查最容易重复返工的五类问题：

1. 契约与类型来源
2. 用户可见语义与文案
3. 批量读写与删除语义
4. 测试质量与验证充分性
5. 高风险边界与跨 app 影响

本手册不是“随便看看再开改”，而是进入实现前的强制扫描门槛。

## 进入本手册前

先读根 `AGENTS.md` + 当前目录最近的 `AGENTS.md`，再读本手册。再按任务范围补读对应场景手册：`backend-safe-change.md` / `admin-web-module-change.md` / `miniapp-page-change.md` / `dict-and-job-change.md` / `verification-gates.md` / `review-mode.md`。本手册只负责"进入实现前如何收集证据"。

## 执行顺序

### 1. 先给任务归类

任务类型直接按根 `AGENTS.md` 第 2 节归类，不在本手册重复定义。

### 2. 按顺序收集证据

优先读取：

1. 将要修改的文件
2. 直接依赖的类型、接口、配置、store、repository 或脚本
3. 同域最近的 2-3 个相似实现
4. 与该链路直接相关的测试
5. 只有在证据仍不足时，才扩展到更大范围

禁止：

- 无目的全仓遍历
- 因为“怕漏掉”而通读无关模块
- 在没有高风险信号时直接扩大为跨 app 大扫描

大任务 / 跨 app / `refactor` 进入实现前，先读 `.codex/playbooks/large-refactor.md`。

若当前任务属于以下任一场景，进入实现前必须先按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 选择对应模板并补齐关键证据：

- 页面梳理 / 后端模块梳理
- 方案设计 / Mock 数据
- 函数改动分析 / 接口改动分析
- 进入改代码前的实现分析

这些输出不得省略：

- 关键代码位置
- 真实流程
- `逻辑矫正`
- `注释审查与注释方案`
- 兼容性影响
- 测试与回归建议

### 3. 进入实现前必须回答的 9 个问题

1. 这次改动落在哪一层：页面、API、store、Service、Repository、schema、任务还是共享类型？
2. 输入、输出、错误语义分别是什么？是否已有同域标准写法？
3. 类型来源在哪里？是 backend DTO、`@libs/common-types`、本地 view-model，还是被错误手写了一份重复契约？
4. 这次改动是否涉及用户可见状态、阶段、启停、布尔语义、提示语或 `xxxText` 字段？
5. 这次改动是否涉及批量操作、删除、排序、导入、逐条更新、事务或 N+1 风险？
6. 现有测试是什么类型：行为测试、集成测试，还是仅仅 URL/method 测试、源码字符串测试、`@ts-nocheck` 测试？
7. 是否触达多租户、权限、支付、认证、字典、任务、Prisma、共享类型或跨 app 契约？
8. 最小可接受验证集是什么？哪些属于必须执行，哪些只是建议补强？
9. **是否应建 exec-plan / 分几会话？** 见 `HARNESS_ROADMAP.md` §0.4 与 `.codex/playbooks/session-orchestration.md`。`refactor` / `cross-app` 进入实现前须有 `docs/exec-plans/active/*.md` 或 `no-exec-plan` 豁免。

任一问题答不清，就先补针对性证据，不要直接开始实现。

## 问题谱系扫描清单

### 契约与类型来源

必须检查：

- 类型来源是否清晰：backend DTO、`@libs/common-types`、本地 view-model，还是错误地重复手写了一份契约
- 页面或接口层是否把列表行对象、详情对象或表单对象直接当写入 DTO 提交
- backend 契约变化是否会传导到 admin-web / miniapp-client

高危信号：

- 命中契约与类型反模式（前端手写 backend 同义 DTO/VO、跳过 `pnpm generate-types`、未走 OpenAPI 链路），见根 `AGENTS.md` §0 硬规则 5-7 + `libs/AGENTS.md`

### 用户可见语义与文案

必须检查：

- 列表、搜索、详情、导出、日志、弹窗是否对同一语义使用不同文案
- 是否直接展示 `statusText`、`teamStatusText`、`xxxText` 等字段而未确认其语义来源
- 是否存在英文枚举值、英文提示语或原始后端 code 直接暴露给用户

高危信号：

- 命中用户可见语义反模式（原始 code/英文枚举直出、xxxText 未确认、多展示面文案漂移），见根 `AGENTS.md` §3 字典治理
- admin-web 与 miniapp 对同一状态显示不一致

### 批量读写与删除语义

必须检查：

- 选中 10 条记录时，是否有单次批量接口或仓储能力可用
- backend 是否用逐条 `findById`、逐条 `count`、逐条 `update` 处理同模型批量写入
- 是否把 `Promise.all` 当作事务内的性能优化理由
- 删除、导入、排序、重算、同步任务是否存在 N+1 读写模式

高危信号：

- 命中批量/删除反模式（逐条 N+1、事务内 `Promise.all`、批量 API 未用），见各子 `AGENTS.md` 与 `.codex/playbooks/backend-safe-change.md` §批量读写

### 测试质量与验证充分性

必须检查：

- 现有测试验证的是业务行为，还是仅仅验证 URL、method、源码字符串
- 关键链路是否覆盖 happy path、边界条件、失败路径
- 高风险链路是否覆盖权限、租户、幂等、并发、状态切换或手动重试
- 测试代码本身是否被 `@ts-nocheck`、大量 `any`、过度 mock 掩盖问题

高危信号：

- `readFileSync(...).toContain(...)` 充当主测试
- 只有 `vi.mock(request)` 然后断言 `url` / `method`
- 高风险业务只有 happy path，没有异常路径
- coverage 只有报表，没有被当作质量门槛使用

### 高风险边界与跨 app 影响

必须检查：

- 是否命中根 `AGENTS.md` §3 高风险触发条件
- 是否需要走 `backend -> generate-types -> frontend` 链路
- 若涉及 OpenAPI 契约，是否先用 `pnpm dev:backend` 刷新并检查 `apps/backend/public/openApi.json`，再生成类型
- 若在 Windows 脚本里启动 `pnpm dev:backend`，是否使用 `pnpm.cmd` 作为 `Start-Process -FilePath`

高危信号：

- 改动一个字段会影响 backend、admin-web、miniapp 三端，却只打算修一端
- 高风险链路修改后没有明确验证路径
- 为刷新 OpenAPI 先跑 build，或在源产物仍旧时通过绕过 Turbo cache 反复生成类型
- Windows 自动化里用 `Start-Process -FilePath pnpm` 启动 dev 进程，导致命中 shim 后失败
- 在高风险改动中顺手做无关重构

## 进入实现前的通过条件

同时满足以下条件，才允许进入实现：

1. 已明确任务归类和影响范围
2. 已回答“8 个问题”
3. 已确认类型来源和用户可见语义来源
4. 已判断批量语义与删除语义是否合理
5. 已判断现有测试是否足够，知道本次至少需要什么验证
6. 没有未处理的高风险边界歧义

若以上任一条件不满足，应继续扫描或停下来问用户，不要带着模糊边界开始改。

## 必须升级风险意识的信号

出现以下任一信号，停止“快速直接改”模式：

- 涉及跨 app 契约变更
- 涉及多租户、支付、认证、权限
- 涉及 Prisma schema、migration、seed
- 涉及字典治理或定时任务
- 涉及批量删除、批量写入、导入导出、数据迁移
- 涉及用户可见状态语义或文案统一
- 现有测试明显只停留在 smoke 层，无法证明行为正确

## 停止规则

- 不为“也许后面会用到”去读更多无关文件
- 不把 `.cursor/*` 当作第一权威来源
- 不在边界模糊时直接开改
- 不在没有完成问题谱系扫描时宣称“已经理解上下文”
