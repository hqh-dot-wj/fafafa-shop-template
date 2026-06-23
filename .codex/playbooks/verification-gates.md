# Verification Gates

## 目标

为仓库提供完整的验证门禁，解决“只列命令、不判质量”的问题。

本手册同时回答两件事：

1. 这次应该跑什么
2. 跑出来什么才算足够证明改动正确

说明：

- “最小该跑什么命令”优先以根 `AGENTS.md` 和对应子 `AGENTS.md` 的矩阵为准。
- 本手册重点回答“什么证据层级才算足够”，不重复维护整套命令路由表。

## 使用时机

以下场景必须进入本手册：

- 用户明确要求运行验证
- 用户要求 review
- 用户要求提交、PR、合并前检查
- 当前任务属于高风险改动
- 当前任务涉及跨 app 契约、字典、任务、批量写操作、状态语义治理

若用户未要求实际执行命令，也仍然必须按本手册判断：

- 哪些验证是必须的
- 哪些测试只是 smoke，不足以作为完成证据
- 交付时要明确哪些已执行、哪些未执行、哪些风险尚未覆盖

若当前任务命中 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 的统一输出协议，交付里还必须单列：

- `逻辑矫正` 是否已落地
- `注释审查与注释方案` 是否已落地
- 测试与回归建议

## Micro / Slice / Batch / PR 分层

| 层级  | 目标                    | 典型命令 / 证据                                                                                                                |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Micro | 只修当前变更文件        | `pnpm fix:changed`；pre-commit 中 lint-staged 只对 staged 文件做 Prettier + ESLint fix                                         |
| Slice | 按受影响 app 或脚本验证 | `pnpm check:slice`，由 `scripts/tasks/changed-files.mjs` 映射 backend / admin / miniapp / scripts，并优先走 package-local 命令 |
| Batch | 阶段性跨文件收口        | 根 `AGENTS.md` 第 6 节矩阵里的对应 app / 跨 app 验证链路                                                                       |
| PR    | 合并前完整证据          | `pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test`                                              |

执行原则：

- 小节任务默认停在 Micro；需要证明某个 app 切片闭环时再升级 Slice。
- Batch 用于阶段收口，不替代 PR 门禁；PR 门禁只在用户要求提交、PR、合并前检查时使用。
- `pnpm report:strict` 是前端 strict 非阻塞报告，不计入默认通过条件，也不进入 pre-commit / pre-push。
- `pnpm verify` 是聚合全量入口，不用于日常小改自检。

## 证据等级

### 一级：静态门禁

用于发现编译、类型、lint、基础治理问题。

包括：

- typecheck
- lint
- verify-monorepo
- `pnpm verify:quality-gates`
- 治理脚本

静态门禁不是行为正确的证明。

### 二级：smoke 测试

用于确认基本 wiring 没断。

包括：

- API request 配置测试
- 组件存在性测试
- 源码字符串测试

smoke 测试只能证明“某些线接上了”，不能证明业务行为正确。

### 三级：行为测试

用于验证用户或业务真正关心的行为。

包括：

- Service 行为测试
- 组件交互测试
- 页面流程测试
- 状态切换测试
- 错误处理测试

按域设定最低可接受证据层级：

| 域                                                                                                            | 最低层级                                      | 说明                                                                                                     |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 高风险域（finance / payment / auth / 状态机 / 多租户隔离 / 字典治理 / 定时任务 / 跨 app 契约 / 订单退款链路） | **L3 行为测试 + L4 集成或人工链路** 双覆盖    | L3 单独不够；L4 至少要覆盖失败 / 回滚 / 补偿 / 跨租户拒绝                                                |
| 普通 backend / admin-web                                                                                      | **L3 行为测试**                               | 不得用 L1（typecheck / lint）或 L2（smoke / 配置存在性）替代；行为测试至少覆盖 happy path + 一条失败路径 |
| miniapp-client                                                                                                | **L3 行为测试 或 H5 / MP 任一端人工链路验证** | 选用人工链路时，交付说明须写清楚验证步骤与端                                                             |

### 四级：集成 / E2E / 人工链路验证

用于验证真实链路、路由、权限、双端行为或跨模块联动。

包括：

- admin-web E2E
- 高风险 backend 集成链路测试
- miniapp H5 / MP 人工流程验证
- 登录、支付、下单、任务页、字典联动的真实链路验证

## 什么不算通过

以下情况不能宣称“已经验证完成”：

- 只跑了 typecheck / lint
- 只有 smoke 测试，没有行为测试
- 只有 happy path，没有边界和失败路径
- 高风险链路没有租户、权限、幂等、并发或状态切换验证
- 通过 `@ts-nocheck`、大量 `any` 或过度 mock 让测试“绿了”
- 只看 coverage 报表，没有判断覆盖内容是否有价值

## 按改动类型的验证要求

### 命令矩阵（最小静态门禁）

| 改动类型                                                 | 验证要求                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `backend-only` 普通 Service/Repository                   | `pnpm typecheck:backend`；新改测试按 `TEST_SPEC_PROTOCOL.md`                                                         |
| `admin-web-only` 组件/hooks/API                          | `pnpm typecheck:admin`；必要时 `pnpm lint:admin`                                                                     |
| `admin-web-only` 页面/`views/**`/`useTable`/`NDataTable` | `pnpm typecheck:admin` + `pnpm verify:admin-view-types`                                                              |
| `miniapp-only`                                           | `pnpm lint:h5` + `pnpm typecheck:h5`                                                                                 |
| 字典治理（跨目录）                                       | `pnpm verify:dict-governance` + `pnpm verify-monorepo` + 相关 app typecheck/lint                                     |
| 定时任务（跨目录）                                       | backend 测试 + `pnpm typecheck:backend`；有管理端则补 admin typecheck + `verify:admin-view-types`                    |
| 跨 app 契约                                              | `pnpm typecheck:backend` + `pnpm generate-types` + 受影响前端 typecheck/lint；views 改动补 `verify:admin-view-types` |
| 仅文档                                                   | 核对路径与命令真实性；一般无需代码验证                                                                               |
| 合并前 / 大范围                                          | `pnpm verify`（见根 `AGENTS.md` PR 分层）                                                                            |

本表与 `scripts/harness-manifest.mjs` 登记的 `check:slice` 路由一致；**命令通过 ≠ TaskComplete**（见 `HARNESS_ROADMAP.md` §0.2）。

### 命令选择

- 路径类型必读链见根 `AGENTS.md` §2；子 `AGENTS.md` 补域内细则。
- 本手册补“命令跑完后需要什么证据级别”。

### backend 改动必须证明

- happy path 正确
- 边界条件正确
- 失败路径正确

若涉及以下任一内容，还要额外覆盖：

- 多租户：租户隔离与权限拒绝
- 批量写操作：空数组、重复项、非法项、部分失败
- 删除：关联校验、软删语义、批量语义
- 高风险写操作：幂等、并发、审计或日志

### admin-web 改动必须证明

- 用户可见行为正确，而不是只证明 request 配置正确
- 列表、搜索、详情、抽屉或弹窗中受影响的主流程正确
- 状态语义、文案、按钮行为与权限没有漂移
- 页面层改动时，已按子 `AGENTS.md` 规则补齐 `verify:admin-view-types`

### miniapp-client 改动必须证明

- 加载态、空态、错误态和主流程正确
- 若声明影响双端，已分别说明 H5 与 MP 的验证结论
- 高风险链路已覆盖失败、回跳、重进和状态刷新语义

### 字典、任务、跨 app 改动必须证明

- 字典：同一语义在多展示面一致，且没有原始 code 直出
- 任务：调度、失败、日志、后台任务页或联动页面一致
- 跨 app：backend 变更、`generate-types` 链路、消费端同步和受影响端验证都已评估

## Test-first Fix 红灯证据要求

适用场景：

- 用户要求先复现问题再修复。
- 已有 bug 修复，尤其是需要证明“红转绿”的修复。
- 高风险业务链路修复：订单、财务、支付、退款、佣金、钱包、租户、状态机、幂等相关问题。

流程要求：

1. 先说明现有逻辑画像：入口、核心方法、状态、权限、租户、副作用和现有测试覆盖。
2. 将发现分为：确定 bug、疑似问题、遗留行为、测试缺口。
3. 确定 bug 必须先写失败测试。
4. 失败测试必须失败在目标业务原因上。
5. 遗留行为应先写 characterization test，避免修复或重构时误改行为。
6. 修复后必须让目标测试从红到绿。
7. 涉及 backend 测试编写或修改时，必须按 `docs/governance/TEST_SPEC_PROTOCOL.md` 先产出测试规格。
8. 高风险链路不得只靠 mock 单测声明完成。
9. 交付必须说明哪些真实链路未验证。

红灯失败原因确认：

- 可以作为复现证据：断言失败直接对应目标业务语义、状态切换、权限 / 租户拒绝、金额边界、幂等语义或错误处理。
- 不得作为复现证据：环境失败、依赖未启动、fixture 缺失、mock 配置错误、类型编译失败、测试文件自身语法错误。
- 如果失败原因不明确，必须先定位失败原因，不得声称“已复现”。

Mock 限制：

- 可以 mock 外部支付网关、短信、邮件、时间、外部 HTTP。
- 谨慎 mock Repository、Prisma、权限上下文、租户上下文、事件总线、任务调度。
- 不应 mock 到失真：订单状态机、金额计算、结算口径、租户隔离、权限拒绝、幂等逻辑、批量写入语义。

禁止：

- 用环境失败冒充问题复现。
- 用 fixture 缺失冒充问题复现。
- 用 request 配置测试冒充业务行为测试。
- 用源码字符串断言冒充真实链路验证。
- 用大量 mock 让测试变绿后宣称高风险链路完成。

## 测试质量门禁

### 前端测试

以下测试可以保留，但只能算补充：

- request 配置测试
- `readFileSync(...).toContain(...)`
- 只断言某个配置项存在

前端业务改动至少要有一种行为级证据：

- 组件交互测试
- 页面流程测试
- E2E
- 等价的人工流程验证记录

### backend 测试

以下情况视为测试质量不足：

- 只测成功路径
- 批量逻辑不测空输入、重复输入、非法输入、部分失败
- 高风险逻辑不测权限、租户、幂等、并发
- 测试文件依赖 `@ts-nocheck` 才能通过

### coverage 说明

- coverage 报表没有 threshold 时，不能把“覆盖率已生成”当作完成证明
- 覆盖内容若主要是 smoke 测试，coverage 再高也不能证明质量充分

## 高风险附加要求

高风险触发条件清单见根 `AGENTS.md` §3。命中高风险时，若当前会话未执行验证，交付时必须明确：

1. 哪些验证尚未执行
2. 推荐执行哪些命令
3. 哪些风险仍未被验证覆盖

## 合并前全量门禁

仅在用户明确要求全量门禁、提交前检查或 PR 阶段时使用：

```powershell
pnpm verify-monorepo; pnpm verify:scripts; pnpm lint; pnpm typecheck; pnpm test
```

## 交付前检查

- 是否区分了静态门禁、smoke、行为测试和 E2E / 人工链路验证
- 是否把不足以证明正确的测试误当成通过证据
- 是否覆盖了高风险链路的失败和边界语义
- 是否在交付里清楚写出已执行与未执行的验证项
