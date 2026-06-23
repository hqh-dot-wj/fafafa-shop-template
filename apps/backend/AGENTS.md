# Backend 后端指引

## 项目结构与模块组织

### 技术栈

NestJS + Prisma + 多租户（`BaseRepository` / `SoftDeleteRepository`）

### 修改 backend 前先看

1. 仓库根 `AGENTS.md`
2. 本文件
3. 相关 playbook：
   - `.codex/playbooks/context-scan.md`
   - `.codex/playbooks/backend-safe-change.md`
   - `.codex/playbooks/dict-and-job-change.md`
   - `.codex/playbooks/verification-gates.md`
4. 按场景深读：[`apps/backend/docs/agent-map.md`](./docs/agent-map.md)（文件树、读写决策、操作日志、字典治理、常见返工点）

涉及后端模块梳理、方案设计、Mock、函数/接口改动分析、进入实施前分析或交付说明时，还必须读 `docs/governance/AGENT_OUTPUT_PROTOCOL.md`。

### 模块结构

文件树、定位规则、标准模块目录详见 [`docs/agent-map.md`](./docs/agent-map.md)。

触达 `finance`、`payment`、`auth`、`tenant`、`dict`、`job`、`prisma` 或跨 app 契约时，按根 `AGENTS.md` §3 高风险流程停手确认。

### 路径与职责边界

- `system/`、`admin/`：后台管理域
- `client/`：小程序 C 端接口域
- 能力域模块负责 Service、Repository、规则与配置
- `module/client/*` 负责 C 端 Controller，依赖方向必须是 `client -> 能力域`
- Controller 负责入参、权限、错误语义入口；Service 负责业务编排；Repository 负责数据访问与租户/软删边界

### 全局模块注册

以下模块只能在 `app.module.ts` 中 `forRoot()` 一次：

- `ScheduleModule`
- `EventEmitterModule`
- `ConfigModule`
- `BullModule`
- `ThrottlerModule`

禁止在子模块重复调用 `forRoot()`。

## 构建、测试与本地运行

### 常用命令

- 开发：`pnpm dev:backend`
- 构建：`pnpm build:backend`
- 类型检查：`pnpm typecheck:backend` 或 `pnpm --filter @apps/backend typecheck`
- 测试：`pnpm --filter @apps/backend test -- <对应模块或文件>`

默认规则：

- 开发后端接口、联调回调、查看本地 Swagger 或运行态自检时，优先使用 `pnpm dev:backend`。
- 不要把 `pnpm build:backend` 当成日常接口开发自检；只有在验证构建产物、排查打包问题、用户明确要求或跨 app 链路明确依赖构建结果时才使用。

### 本地运行提示

- Prisma CLI 与 Nest 运行时统一使用 `DATABASE_URL`
- 在仓库根运行 Prisma 相关命令时，先 `cd apps/backend`
- `prisma` 与 `@prisma/client` 版本必须保持一致
- 涉及前端契约的 backend 变更完成后，若影响 DTO/接口类型，应按根 `AGENTS.md` 的跨 app 链路继续执行

## 代码风格与命名规范

- 优先遵循 `dto/vo/service/repository/controller/module` 的既有分层，不在单文件里混合多层职责。
- 新增接口、Service、Repository 时，命名与模块语义保持一致，不使用含糊缩写。
- 租户内普通读写优先走 `BaseRepository` / `SoftDeleteRepository`，不要绕过既有仓储边界。
- 前端传入的 `tenantId` 不得直接落库，必须由后端上下文注入。
- 写查询、删改逻辑时，先确认租户条件、软删语义、权限边界和错误语义，不靠“默认猜测”。
- 涉及关键业务链路的写操作，优先保持审计和日志能力可追溯，不在高风险模块里顺手大改无关代码。

## 统一输出协议

按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 输出。backend 场景额外强调：

- 进入实施时，事务边界、租户来源、状态切换、兼容原因等注释调整属于交付范围。
- 默认按“关联闭环”处理直接上下游，不把明显问题留给调用方或消费端。

## 测试规范

### backend 修改分类矩阵

| 改动类型                        | 先检查什么                     | 重点风险               |
| ------------------------------- | ------------------------------ | ---------------------- |
| 普通接口 / Service / Repository | 分层、入参出参、错误语义       | 回归、空值、权限       |
| 多租户                          | 接口类型、租户来源、读写过滤   | 跨租户泄漏             |
| Prisma / 数据结构               | Repository 边界、schema、seed  | 结构漂移、租户条件丢失 |
| 字典                            | 治理清单、初始化数据、前端引用 | 文案与语义不一致       |
| 定时任务                        | `@CodeManagedJob`、`@Task`、锁 | 重入、不可观测         |
| finance / payment / auth        | 幂等、权限、日志、状态机       | 资金或身份风险         |

### 最小验证建议

完整最小验证矩阵见根 `AGENTS.md` §6。backend 命令变体与附加要求：

- 按模块/文件粒度运行：`pnpm --filter @apps/backend typecheck` 与 `pnpm --filter @apps/backend test -- <对应模块或文件>`
- 字典改动可直接跑 `node scripts/check-dict-governance.mjs`（等价 `pnpm verify:dict-governance`）
- 高风险模块必须有对应测试，不允许无测试提交

当前会话是否执行这些命令，由用户指令决定；若未执行，必须在交付说明里明确列出推荐验证集。

## 提交与 Pull Request

- 提交信息格式沿用根 `AGENTS.md`：`<type>(backend): <中文描述>`。
- PR 说明必须写清本次改动涉及的模块、接口、Repository、任务或字典治理点。
- 若涉及多租户、支付、认证、定时任务、Prisma、字典治理，必须附验证证据或明确列出未验证风险。
- backend 契约变更需要在 PR 中说明是否需要后续执行 `pnpm generate-types` 与前端适配。

## 安全与配置提示

### 多租户与 `tenant-id`

#### HTTP 入口规则

启用 `TENANT_ENABLED` 时：

- `/client/*`
- `/lbs/region/*`
- `POST /store/distribution/commission/preview`
- 登录前白名单、`/auth/*`、`/health/*`、`/metrics`、Swagger、`/resource/*`

以上路径在未带头时允许回落超级租户。

其余后台路径：

- 必须携带 `tenant-id` 或 `tenantId`
- 未携带时返回 `403`

第三方回调若无法固定携带租户头，必须通过 `TENANT_EXEMPT_PATH_PREFIXES` 明确配置，并在 Controller 内自行完成签名、来源校验和安全保护。

### Prisma 与数据源提示

- Prisma CLI 与 Nest 运行时统一使用 `DATABASE_URL`
- `prisma` 与 `@prisma/client` 版本必须保持一致
- 修改 schema、migration、seed 前必须先征得用户确认，并走高风险流程

### 高风险模块

完整高风险触发条件与停手协议见根 `AGENTS.md` §3。backend 独有触发清单：

- `module/finance/`
- `module/payment/`
- `module/admin/auth/`
- `module/client/auth/`
- `module/client/payment/`
- `module/client/finance/`
- Prisma schema / migration / seed
- 多租户隔离边界
- 跨 app 契约变更

任何高风险改动必须带验证证据，禁止顺手做无关重构。

## 架构要点

### 循环依赖规避

后端出现循环依赖，默认先判断是哪一层：

| 类型                   | 典型表现                                                     | 优先处理方式                                   |
| ---------------------- | ------------------------------------------------------------ | ---------------------------------------------- |
| 模块循环依赖           | `Module imports` 互相 `forwardRef`，或子模块反向依赖聚合模块 | 改模块边界，降级为窄模块依赖或端口依赖         |
| Service 循环依赖       | `AService -> BService -> AService`，构造器里互相注入         | 抽查询服务、抽端口、拆编排职责                 |
| 静态 import / 类型循环 | 枚举、Swagger DTO、常量、策略注册互相 import                 | 抽 API 枚举、抽共享常量、改为 registry / token |

硬规则：

1. `forwardRef` 优先用 Port / 事件 / QueryService 解耦；确认存在合法双向语义（如 User↔Role 多对多关联实体管理）才允许保留，且必须在 `forwardRef(() => XxxModule)` 上方加 `// @reason: <为什么不能解耦>` 单行注释。新增 `forwardRef` 前，先判断是不是依赖方向错了。
2. 聚合模块只负责聚合，不允许成为下游业务模块的常规依赖。比如 `MarketingModule`、`FinanceModule` 这类大模块，不应被子玩法或 C 端业务模块反向依赖。
3. 依赖方向必须单向：`controller/client/admin -> 能力域 service -> repository/adapter`。禁止能力域再回依赖 `client/*`、`admin/*` 控制面模块。
4. 跨模块只需要“查数据”时，优先抽 `QueryService` 或 `Port + Adapter`，不要直接注入对方完整 Service。
5. 一个 Service 同时承担“编排 + 查询 + 状态更新 + 外部副作用”时，最容易形成环；优先拆成：编排服务、查询服务、领域规则服务、外部适配器。
6. 模块默认只导出 Service 或 Port；导出 Repository 需在 `xxx.module.ts` 注释说明用途（审计 / 投影 / 内部跨域只读 / BaseRepository 复用基线）。`BaseRepository` / `SoftDeleteRepository` 作为框架基础设施可继续导出，业务读写仍须经 Service / Port。
7. 后置动作优先用事件或任务解耦，不要用同步回调把两个域互相绑死。
8. DTO、Swagger、枚举、常量不要直接 import 会反向拖入业务模块的对象；必要时单独定义 API 层枚举或共享常量，避免静态类型环。
9. 如果你准备在 `A` 模块里 import `B`，必须先反向核对 `B` 是否已经直接或间接依赖 `A`：① **当前默认走** 用 `rg "from.*\b<A>\b"` 在 B 模块路径下搜索；命中则先停手，改成端口、查询服务或事件。② **Phase 4 = dependency-cruiser 接入**完成后再补跑 `pnpm verify:deps`（脚本目前未在 `package.json` 注册，未接入前不要执行该命令）。

优先推荐的避环方式：

- 读依赖：抽 `XxxQueryService`
- 写依赖：抽 `XxxCommandService` 或 `Port`
- 跨域通知：用 `EventEmitter` / job / domain event
- 策略注册：用 registry、token、discovery，而不是静态互相 import
- 类型共享：放 API enum、shared constants、plain DTO，避免直接牵 Prisma 或重业务类

已有正向案例：

- `UserRoleQueryService` 从认证/角色链路里提出来，专门承接纯查询，避免 `UserService ↔ RoleService ↔ MenuService` 互相缠绕。
- `PlayStrategyFactory` 使用 discovery/registry 扫描策略，避免策略类静态 import 形成玩法模块环。
- `OrderQueryPort`、`MemberQueryPort` 这类端口模式，比直接跨域注入整套 Service 更稳。

新增或改模块前，至少做这 4 个自检：

1. 我现在加的依赖，是不是让依赖方向反了？
2. 这是“查数据”还是“做编排”？如果只是查数据，为什么不是 QueryService？
3. 这个模块是不是已经在导出过多实现细节，导致别人很容易回依赖它？
4. 如果必须加 `forwardRef`，退出方案是什么？后续要抽哪一层把它去掉？

### 定时任务约定

新增业务定时任务必须同时使用：

- `@CodeManagedJob`
- `@Task`

#### 任务定义字段检查表

| 字段         | 要求                                     |
| ------------ | ---------------------------------------- |
| `key`        | 全局唯一且稳定，格式 `{业务域}.{方法名}` |
| `@Task.name` | 必须与 `key` 一致                        |
| `name`       | 中文任务名称                             |
| `group`      | 明确分组                                 |
| `cron`       | 明确调度表达式                           |
| `guardMode`  | `platform-lock` 或 `self-managed`        |

#### 执行要求

1. 必须具备幂等与并发保护
2. 必须有失败日志
3. 必须可在后台任务管理页查看与手动触发
4. 单条失败不得无故中断整批可恢复任务

开发环境默认关闭自动调度；联调时显式启用 `SCHEDULER_ENABLED=true`。

### 事务与外部副作用

数据库事务内**禁止**调用以下副作用：

- 第三方支付网关、短信、邮件、推送
- 外部 HTTP / RPC
- 跨域同步写入

事务外协调外部副作用，优先级如下：

1. 已落地：`EventEmitter2` + `@OnEvent` 异步监听（参考 `OrderDomainEventPublisher` / `FinanceEventEmitter`），事务 commit 后由 listener 触发副作用。
2. 已落地：`OrderOutboxWriter` + `OrderOutboxDispatcher`（dispatcher 以 Redis leader 锁单实例驱动，失败自动 backoff，达 maxAttempts 转 FAILED 并以 error 级别上报；运维可用 `replayFailedRows` 手动重投）。
3. 队列后置：Bull job 承接重试、幂等、补偿。
4. 暂未落地：跨模块 saga 协调器。引入前需经设计评审，不在普通改动里临时造一套。

营销侧的 `MarketingEventEmitter` 已彻底删除（P1-08 / PR #23 review H5）：业务事件统计与触点编排统一通过 `MessageTouchpointDispatcher`，订单领域事件走上述 outbox 链路。

同步链路确实无法解耦时，必须给出**补偿或重试设计**，不允许只 `catch` 忽略；交付说明里要单列补偿点位与重试上限。
