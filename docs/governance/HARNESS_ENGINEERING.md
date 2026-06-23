---
title: Harness Engineering 工程指南
status: active
doc_type: governance
last_verified: 2026-05-18
---

# Harness Engineering 工程指南

本文档是本仓库 Harness Engineering 的主说明。它不替代根 `AGENTS.md`、各子目录
`AGENTS.md` 或 `.codex/playbooks/**`，而是把这些规则和可执行脚本串成一个工程闭环：

- 让智能体和开发者先知道应该读哪些上下文、跑哪些低成本检查。
- 把接口主链路、队列、Worker/独立服务、OpenAPI 契约刷新和前端验证放进可执行路径。
- 将暂时不能机械化的经验沉淀成清晰 checklist，后续再逐步下沉到 `scripts/**`。

## 0. 使用定位

本文是长期治理文档，不是一次性开发记录。`docs/development/` 中的过程稿可能在交付后收敛或删除；本文保留在 `docs/governance/`，作为 AI 与开发者处理 Harness Engineering、后端阻塞风险和验证门禁时的主入口。

本文的核心目的不是单独罗列 CPU 密集场景，而是提醒 AI 和开发者：写接口或设计解决方案时，不能默认把所有任务都放在同一个 HTTP 请求链路、同一个 Node.js 主事件循环或同一个 backend 进程里完成。

本文中的示例不是完整清单。遇到相似但未列出的耗时任务、CPU 密集任务、阻塞 API、批量任务、后台任务或跨 app 契约链路时，先按本文原则判断任务应该放在哪里执行，再补充到本文或下沉到 `scripts/**`。如果缺少业务阈值，不要自行假设，应在交付说明中标出需要维护者补充的行数、文件大小、超时、队列并发、进程拆分、部署拓扑或告警阈值。

AI 开发涉及以下任一场景时，应同时参考本文、根 `AGENTS.md`、对应子目录 `AGENTS.md` 与相关 playbook：

- NestJS 后端接口、队列、定时任务、批量任务、导入导出。
- OpenAPI / `@libs/common-types` 契约刷新与前端适配。
- Redis 扫描、缓存失效、批量删除、大 keyspace 操作。
- admin-web / miniapp-client 对任务状态、进度、下载结果的展示。

## 1. 当前 Harness 能力

仓库已有的 Harness 入口集中在根 `package.json` 与 `scripts/**`：

| 命令                         | 作用                                                      | 失败/警告语义                                               |
| ---------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm harness:doctor`        | 检查运行时版本、根脚本、必需上下文文档、关键测试/配置工件 | 缺少必需上下文或根脚本为 fail；缺少可选 E2E/监控工件为 warn |
| `pnpm harness:docs`          | 只检查必需上下文文档                                      | 文档地图缺失为 fail                                         |
| `pnpm harness:smoke`         | 对已启动的 backend、admin-web、H5 做低成本可达性检查      | 服务不可达或 HTTP 4xx/5xx 为 warn；加 `--strict` 后阻塞     |
| `pnpm harness:smoke:backend` | 只检查 backend liveness                                   | 未启动或 HTTP 4xx/5xx 为 warn                               |
| `pnpm harness:smoke:admin`   | 只检查 admin-web 登录路由                                 | 未启动或 HTTP 4xx/5xx 为 warn                               |
| `pnpm harness:smoke:h5`      | 只检查 miniapp-client H5 根路径                           | 未启动或 HTTP 4xx/5xx 为 warn                               |
| `pnpm harness:maps`          | 从 OpenAPI、admin 路由与页面源码生成 agent 项目地图       | 生成失败为 fail；产物在 `docs/generated/`                   |
| `pnpm fix:changed`           | 只修 Git 变更文件的 Prettier 与 ESLint 安全 fix           | Micro Gate；不扫描全仓                                      |
| `pnpm check:slice`           | 按变更路径路由到受影响 app / scripts 验证                 | Slice Gate；不替代 PR full gate                             |
| `pnpm report:strict`         | admin-web / miniapp-client strict 非阻塞报告              | 只报告，不改变默认 typecheck，不进 hook / 默认 CI           |
| `pnpm verify:scripts`        | 检查 root package scripts 公共 API 边界                   | root scripts 扩张违规为 fail                                |
| `pnpm test:scripts`          | 验证治理脚本自身行为                                      | 脚本行为变更必须优先补跑                                    |

对应实现：

- `scripts/harness-doctor.mjs`
- `scripts/harness-smoke.mjs`
- `scripts/tasks/changed-files.mjs`
- `scripts/tasks/strict-report.mjs`
- `scripts/tasks/package-scripts-governance.mjs`
- `scripts/tasks/test-scripts.mjs`
- `scripts/check-required-docs.mjs`
- `scripts/harness-doctor.spec.mjs`
- `scripts/harness-smoke.spec.mjs`

`scripts/AGENTS.md` 明确了定位：`scripts/` 是 Harness Engineering 的可执行规则层，不是一次性命令收纳处。新增规则前优先扩展已有脚本，并补对应脚本测试。

## 2. 接口设计时的核心提醒

后端是 NestJS + Prisma + Bull + Redis + 多租户。NestJS 运行在 Node.js 上，普通 HTTP 请求处理仍受 Node 事件循环模型约束。

结论不是“不能用 NestJS 做商城后端”，也不是“所有任务都必须拆服务”。真正要避免的是：

> 把接口受理、权限校验、数据库读写、批量处理、文件生成、队列消费、定时任务和重计算都压在同一个请求链路或同一个 Node.js 主事件循环里。

更准确的设计原则是：

```text
接口主链路只做受理、校验、短事务和状态查询
耗时 I/O 和批量任务进入队列或后台任务
CPU 密集和阻塞型任务进入 Worker Thread、Worker 进程或独立服务
API 进程、Worker 进程、Scheduler 进程按任务重量逐步拆分
前端通过 taskId/jobId 查询进度、结果和失败明细
```

严格说，Node.js 运行时并不是“只有一个线程”：它有 libuv 线程池，也可以使用 `worker_threads`、cluster、多进程和多副本。本文里说“不能放在一个线程里”，指的是不能让 NestJS API 进程的 JavaScript 主事件循环承担所有业务工作。队列、线程、进程和独立服务都是把任务从主请求链路中拆出去的工具，选择哪一种取决于耗时、CPU、数据量、可靠性和部署成本。

本仓库已经有一些正确方向：

- `apps/backend/src/app.module.ts` 全局注册 `BullModule`，默认重试 3 次、指数退避，并接入 Redis。
- `apps/backend/src/module/finance/finance.module.ts` 注册 `CALC_COMMISSION`、`WALLET_OPERATIONS` 队列。
- `apps/backend/src/module/store/product/product.module.ts` 注册 `PRODUCT_SYNC_QUEUE`、`STORE_PRODUCT_IMPORT_QUEUE`。
- `apps/backend/src/module/store/product/store-product-import.queue.constants.ts` 已定义导入行数、文件大小、队列积压和 worker 并发上限。
- `apps/backend/src/module/store/product/product.service.ts` 的 `importExcel` 已返回 `jobId`，并通过 Bull 队列异步处理导入。
- `apps/backend/src/module/common/redis/redis.service.ts` 已有 `scanAndDeleteByMatch`、`scanKeysByMatch`，用于替代大 keyspace 下的阻塞式 `KEYS`。
- `apps/backend/src/module/admin/monitor/metrics/**` 与 `HttpMetricsInterceptor` 已经给 HTTP 指标留出观测入口。

也有需要持续管控的点：

- 多个导出入口仍使用 ExcelJS 生成整块 buffer，再一次性 `res.end`。
- 部分密码处理使用 `bcrypt.hashSync` / `bcryptjs.hashSync`，低频账号操作可以接受，高频批处理不得照搬。
- `readFileSync`、大 JSON `JSON.parse`、Excel/PDF/图片处理、批量导出和报表统计必须按数据规模判断是否迁出主请求链路。

典型高风险示例包括：

- 大批量 Excel 导入导出、账单导出、商品/SKU/订单批处理。
- 复杂报表统计、经营分析、财务对账、商户结算、退款核算。
- 大 JSON 解析/序列化、同步文件读写、同步压缩/解压。
- 图片、视频、PDF、海报、发票等文件生成或处理。
- 高频加密解密、签名验签、密码哈希、复杂价格/库存/促销计算。
- 推荐算法、风控规则计算、历史数据回填、跨租户批量同步。

## 3. 方案拆分标准

写接口或设计方案时，先按“是否必须同步返回 + 耗时 + 触发频率 + 数据规模 + 是否占 CPU + 是否阻塞事件循环”分级，而不是先写 Controller 再补救。

| 分级     | 可留在 HTTP 主链路               | 需要设计保护                    | 默认拆到后台/隔离执行                  |
| -------- | -------------------------------- | ------------------------------- | -------------------------------------- |
| 同步性   | 必须立即返回结果                 | 可以返回部分结果或状态          | 返回 `taskId` / `jobId`                |
| 耗时     | 几十毫秒到几百毫秒               | 超过 1 秒且可能频繁触发         | 几秒到几十秒                           |
| 数据规模 | 单页查询、有限列表、小 DTO       | 上千行转换、复杂聚合、较大 JSON | 大文件、十万级数据、跨租户批处理       |
| CPU      | 少量格式化、轻量校验             | 密码哈希、复杂规则、Excel 生成  | 图片/视频/PDF、压缩解压、推荐/风控算法 |
| I/O      | Prisma/Redis/第三方 API 异步调用 | 串行外部调用、慢接口聚合        | 批量写库、对账、结算、同步任务         |
| 运行位置 | API 进程                         | 队列 + 有上限的同进程 Processor | Worker 进程、Worker Thread、独立服务   |

默认判断：

- `商品列表`、`订单查询`、`购物车`、`登录态校验`、`普通后台 CRUD`：同步处理。
- `商品 Excel 导入`、`批量库存同步`、`订单/账单导出`、`对账结算`、`营销报表`：异步任务。
- `图片压缩`、`PDF 生成`、`海报生成`、`视频处理`、`复杂推荐/风控计算`：Worker Thread 或独立服务。

接口方案必须先回答：

- 这个接口是否真的需要等所有任务完成后才返回？
- 如果任务失败，用户如何看到失败状态和失败明细？
- 任务是否会阻塞 Node.js 主事件循环？
- 队列消费者和 API 是否运行在同一个进程里？如果是，是否只是临时过渡？
- 后续并发上来后，能否独立扩容 Worker，而不是只扩 API 副本？

## 4. 后端实现约束

### 4.1 HTTP 主链路

HTTP Controller 是任务受理入口，不是所有业务工作的执行器。它应只做：

- 参数校验、租户解析、权限校验。
- 小规模读写或短事务。
- 创建任务记录并返回 `taskId` / `jobId`。
- 返回当前任务状态、失败原因、回执或下载地址。

HTTP Controller 不应直接做：

- 解析几十 MB Excel。
- 查询几十万行后生成文件。
- 在循环中逐行同步写库且等待全部完成。
- 同步压缩、同步文件读写、同步大 JSON 转换。
- 长时间 CPU 计算或无上限循环。
- 等待导入、导出、报表、对账、文件生成等后台任务全部完成后才返回。

### 4.2 队列任务

使用 Bull 队列时，必须补齐以下内容。注意：队列解决的是“请求不必等待”和“任务可排队”，不等于天然完成线程/进程隔离。

- **任务边界**：Controller 返回任务 ID，不把用户请求挂到任务完成。
- **幂等键**：能从业务主键推导的任务用稳定 `jobId`，例如订单佣金可用 `calc:commission:${orderId}`。
- **租户隔离**：payload 必须带 `tenantId`；查询任务状态时校验任务租户与当前租户一致。
- **入队前限流**：检查文件大小、行数、批量数量和队列积压。
- **worker 并发**：并发通过环境变量或常量上限控制，不能无限制消费。
- **失败语义**：区分可重试错误、业务校验失败和不可重试错误。
- **回执模型**：批量任务返回 `successCount`、`failCount`、失败明细、完成时间。
- **可观测性**：记录 jobId、tenantId、耗时、成功失败数量、失败原因摘要。

`STORE_PRODUCT_IMPORT_QUEUE` 是当前较完整的样板：它有 `jobId`、行数限制、文件大小限制、队列积压保护、worker 并发、任务状态查询和结果回执。

如果 Processor 与 API 运行在同一个 NestJS 进程，轻中量任务可以先接受，但方案说明必须写清这是同进程消费。重任务要继续拆到独立 Worker 进程、Worker Thread 或独立服务，不能只因为“已经入队”就认为不会影响 API。

### 4.3 Worker Thread

Bull 解决的是“异步”和“削峰”，不自动解决 CPU 占用，也不自动改变进程拓扑。若队列消费者仍在同一个 Node 进程里做重 CPU 或阻塞型任务，API 进程仍可能被抢占 CPU，事件循环仍可能被拖慢。

适合 Worker Thread 的任务：

- 大规模纯计算。
- 大 JSON 转换或规则引擎计算。
- 加密、签名、哈希的高频批量任务。
- 图片/PDF/压缩等短到中等耗时的本机 CPU 任务。

Worker Thread 使用原则：

- 只传可序列化数据，不把 Nest Provider 直接传进 worker。
- worker 内部做纯计算或文件处理，数据库和 Redis 写入仍由 service/processor 编排。
- 任务过大时不要把完整文件内容在主线程和 worker 间来回复制；优先传文件路径、对象存储 key 或分片引用。
- worker 失败要回到队列失败语义，而不是吞掉错误。

### 4.4 独立服务

以下任务优先考虑独立服务，而不是继续塞进 NestJS API：

- 长时间图片/视频处理。
- 大规模报表与 BI 预聚合。
- 搜索、推荐、风控模型。
- 对账、清结算、历史数据回填。
- AI 内容生成的批量生产链路。

独立服务的边界：

- NestJS 负责 API、权限、租户、任务受理和状态查询。
- Worker/Java/Go/Python 服务负责重计算或文件生产。
- Redis/MQ/数据库作为任务与结果交换层。
- 前端只感知任务状态、进度、错误明细和下载地址。

### 4.5 多进程与多副本

PM2 cluster、Node cluster、Docker 多副本和 K8s 横向扩容可以提升整体吞吐，但不能修复“一个请求把所有任务都做完再返回”或“一个 backend 进程同时承担所有重任务”的设计问题。

本仓库当前 Bull Processor 随 backend module 启动，意味着“API 实例”和“队列消费者实例”默认在同类进程中运行。轻中量任务可以接受；重任务应演进为：

- API 进程：只接请求、入队、查状态。
- Worker 进程：只消费指定队列。
- Scheduler 进程：只跑定时任务或 CodeManagedJob。

如果暂时不拆进程，至少要做：

- worker 并发上限。
- 队列积压保护。
- 单任务数据量上限。
- 超时与失败回执。
- Prometheus/日志观测。

方案设计时要写清当前采用哪一种拓扑：

- **同进程过渡**：API 与 Processor 同进程，必须有限流、积压保护和明确上限。
- **独立 Worker 进程**：API 只入队和查状态，Worker 消费队列。
- **独立服务**：重计算、文件处理、搜索、推荐、对账等由专门服务处理。
- **多副本扩容**：只解决容量，不替代任务拆分。

## 5. 模块级风险清单

| 模块/场景               | 当前项目信号                                 | Harness 要求                                                         |
| ----------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| 商品 Excel 导入         | `STORE_PRODUCT_IMPORT_QUEUE` 已队列化        | 保持 `jobId + 状态查询 + 回执 + 积压保护`；新增导入照此模式          |
| 商品/订单/库存/会员导出 | 多处 ExcelJS buffer 导出                     | 同步导出必须先 count 并限制行数；超限走异步导出任务                  |
| 财务佣金                | `CALC_COMMISSION` 队列                       | 支付成功只入队，不同步重复计算；测试等待队列空闲后断言               |
| 钱包操作                | `WALLET_OPERATIONS` 队列                     | 钱包写入要幂等、可重试、可观测，失败不得悄悄吞掉                     |
| 通知                    | `NOTIFICATION_QUEUE`、订单延迟通知           | 通知失败不阻塞订单主流程，但要有失败记录或重试                       |
| Redis 缓存失效          | 已有 SCAN 工具；仍存在 `keys()` 包装         | 业务代码禁用大范围 `KEYS`；需要按模式删除时使用分批 SCAN             |
| 定时任务                | `@nestjs/schedule` + `SchedulerGuardService` | Cron 不做大批量同步循环；分批、加锁、可重复执行                      |
| OpenAPI 类型链路        | `harness-doctor` 已提示刷新路径              | backend 契约变更后先刷新 `openApi.json`，再生成 `@libs/common-types` |
| admin-web views         | `verify:admin-view-types` 单独检查           | 改 `src/views/**` 后不能只跑 `typecheck:admin`                       |
| H5/小程序接口消费       | `@libs/common-types` 是契约源头              | 不手写同义 DTO/VO 类型绕过生成链路                                   |

### 5.1 后端启动与迁移开发禁忌

2026-05-18 本地启动排障暴露了几类开发错误。它们不是“环境偶发”，而是会让后端无法启动、migration 链断裂或业务模块形成隐性死锁的工程缺陷。

禁止事项：

- 禁止把 `forwardRef + require(...)` 当作模块边界方案。订单、优惠券、营销、积分、玩法这类高风险域出现循环依赖时，必须抽 `ContractModule`、Port、QueryService 或事件边界；聚合模块不得反向被子模块依赖。
- 禁止把完整业务 Service 暴露给反向域作为 token 实现。例如营销只需要订单查询和积分写回契约时，不得注入完整 `OrderService`，否则会把订单创建、营销计算、优惠券、积分链路重新串成启动期循环。
- 禁止提交只建表不补运行时必需 seed 的 migration。若启动 fail-fast 依赖某张配置表有 active 行，migration / seed / bootstrap 入口必须同 PR 闭环，并用启动级验证证明空库部署后可启动。
- 禁止 seed 文件存在但未接入 seed pipeline 或 bootstrap 入口。新增 `prisma/seeds/**` 时，必须确认它被 `seed-pipeline.ts`、对应 `index.ts` 或明确命名脚本调用；不能只把文件放在目录里。
- 禁止编写假定旧列必然存在的 raw SQL migration。对历史列做 `ALTER COLUMN`、`DROP NOT NULL`、`DROP COLUMN` 前，必须先用 `information_schema` 或 `DO $$ ... IF EXISTS` 包住；否则本地、staging、生产只要有一次 schema 漂移，就会触发 P3018/P3009 并阻断后续 migration。
- 禁止只跑 `prisma generate`、`tsc` 或 Nest 容器创建就声明数据库链路完成。Prisma schema、migration 和 runtime seed 是三条不同证据：至少要跑 `prisma migrate status`，有 schema 变更时还要在目标库执行 `migrate deploy`，并对关键表/种子行做 smoke query。
- 禁止让开发 watch 默认执行高成本 Swagger metadata typecheck 到 OOM。开发启动可以关闭 watch typecheck，但 build/CI 必须显式保留 `--type-check` 或等价门禁，不能用“启动变快”换掉类型检查。

复盘证据入口：

- 设计来源：`docs/design/marketing-revamp/P1-06-merge-play-strategy-handler.md` 要求 `play_definition` 表和 6 行初始定义，并要求 `PlayDispatcher` 启动 fail-fast。
- 迁移入口：`apps/backend/prisma/migrations/20260517113000_add_play_definition/migration.sql` 创建 `play_definition`，但运行时行由 seed 维护。
- seed 入口：`apps/backend/prisma/seeds/01-hq-foundation/play-definitions.ts` 定义 `seedPlayDefinitions`；新增 seed 后必须核对它是否被实际调用。
- 失败模式：`play_definition` 表缺失会报 relation does not exist；表存在但 active 行为空会报 `play_definition active rows is empty`；历史列漂移会让 Prisma migration 进入 failed 状态并阻止后续 migration。

## 6. 导入导出策略

### 6.1 同步导出

同步导出只适合小数据量：

- 先执行 count 或使用已知分页上限。
- 明确单次最大行数。
- 输出文件体积可控。
- 接口超时可控。
- 不影响主 API 进程响应。

已有 process spec 示例：

- `apps/backend/docs/process-specs/coupon/export-limit.process-spec.md`
- `apps/backend/docs/process-specs/points/export-limit.process-spec.md`

导出超过上限时，接口应拒绝同步导出，并提示用户缩小筛选条件或创建异步导出任务。

### 6.2 异步导出

异步导出推荐协议：

1. 前端提交筛选条件。
2. backend 校验权限、租户、导出规模。
3. backend 创建导出任务并返回 `taskId`。
4. worker 分批读取数据库、生成文件、上传对象存储或落本地受控目录。
5. 前端轮询任务状态。
6. 完成后返回下载链接、过期时间、成功/失败摘要。

异步导出任务必须保存：

- 发起人、租户、筛选条件摘要。
- 任务状态。
- 总数、已处理数。
- 文件地址或失败原因。
- 创建时间、完成时间。

## 7. Redis 与缓存 Harness

Redis 的风险不是“用了 Redis”，而是大 keyspace 下使用阻塞命令。

禁止在业务链路中引入：

- `KEYS *`
- 大范围 `keys(pattern)`
- 无上限 `LRANGE 0 -1`
- 无上限批量 `DEL`

推荐：

- 使用 `scanAndDeleteByMatch` 分批删除。
- 使用 `scanKeysByMatch` 分批扫描并加 `maxKeys`。
- 复杂缓存失效维护索引 key，不靠全库扫描。
- 缓存失败默认不阻塞主业务，但要记录 warn 日志。

后续可把以下检查下沉到 `scripts/check-quality-gates.mjs` 或独立 harness：

- 扫描新增 `redis.keys(`、`client.keys(`。
- 扫描无上限 `lrange(key, 0, -1)`。
- 扫描大范围删除脚本，要求高风险确认与回滚说明。

## 8. API、队列和前端的契约

涉及任务化接口时，契约应表达真实状态，而不是让前端猜：

```text
POST /xxx/export-tasks
-> { taskId, status: "PENDING" }

GET /xxx/export-tasks/:taskId
-> { status, progress, successCount, failCount, reason?, downloadUrl? }
```

前端要求：

- admin-web 页面使用 OpenAPI 生成类型或 `@libs/common-types` 暴露类型。
- 不为任务状态手写一套与 backend 同义的 DTO/VO。
- 任务状态页或弹窗要能展示排队、运行、完成、失败。
- 失败明细可下载或可分页查看，避免一次性塞回超大 JSON。

backend 契约变更后的顺序：

1. 修改 backend DTO/VO/Controller。
2. 启动 `pnpm dev:backend` 刷新 `apps/backend/public/openApi.json`。
3. 检查目标 schema 是否符合预期。
4. 执行 `pnpm generate-types`。
5. 修改 admin-web / miniapp-client。
6. 执行受影响 app 的 typecheck/lint/view gate。

## 9. 验证策略

文档类变更：

- 检查路径、命令、脚本名是否真实存在。
- 可执行 `pnpm harness:docs` 验证必需上下文地图。

脚本行为变更：

- `node scripts/<script-name>.mjs`
- `pnpm test:scripts`

backend-only 普通改动：

- `pnpm typecheck:backend`
- 需要时补对应 Jest 单测。

队列/任务改动：

- Processor/service 单测覆盖入队、失败、重试、幂等、租户隔离。
- `pnpm typecheck:backend`
- 如果改管理端任务状态页，再补 `pnpm typecheck:admin` 与 `pnpm verify:admin-view-types`。

导入导出性能改动：

- 单测覆盖数量上限、超限拒绝、部分成功回执。
- 必要时使用现有 loadtest 入口，例如 `apps/backend/scripts/loadtests/store-product-import-excel-spike.k6.js`。
- 不用 `pnpm build` 代替开发期自检；只有验证产物或定位打包问题时再 build。

跨 app 契约变更：

- `pnpm typecheck:backend`
- `pnpm generate-types`
- 受影响前端 typecheck/lint
- 涉及 admin-web views 时补 `pnpm verify:admin-view-types`

### 9.1 测试文件与测试质量约定

根 `AGENTS.md`、各子目录 `AGENTS.md` 与 `.codex/playbooks/verification-gates.md` 决定“什么时候跑哪些验证”。本节只保留长期测试组织约定；`.cursor/rules/testing.mdc` 是 IDE 兼容层，不是最高权威。

测试命名与放置：

- Backend 单元测试使用 `*.spec.ts`，优先与源文件同目录。
- Backend 集成测试集中放在 `apps/backend/test/integration/`，命名为 `*.integration.spec.ts`。
- Backend E2E 测试放在 `apps/backend/test/`，命名为 `*.e2e-spec.ts`。
- Admin-Web 单元或组件测试使用 `*.spec.ts`，优先与源文件同目录；Playwright E2E 放在 `apps/admin-web/e2e/*.spec.ts`。
- Miniapp-Client 在未建立 package-local test 脚本前不强制纳入 `pnpm test`，有测试需求时先补 runner、mock 与 package script。

Mock 与 fixture：

- Backend 共享 mock 优先放在 `apps/backend/src/test-utils/mocks/`，例如 Prisma、Redis、ClsService、常用 provider mock。
- Backend 集成或 E2E fixture 优先放在 `apps/backend/test/fixtures/`，通过 factory 生成租户、成员、SKU、订单等最小测试实体。
- Admin-Web 后续引入组件测试时，应集中维护 `$message`、`$t`、router、Pinia 等全局 mock，避免在各 spec 内重复手写。
- Mock helper 应尽量保留真实接口形状；不要用 `as any` 掩盖 provider 合约漂移。

覆盖率与测试质量：

- coverage 报告只作为辅助信号；没有阈值、没有行为断言质量时，不能单独证明变更安全。
- smoke / URL 配置测试只证明基础可达性，不能替代业务行为测试。
- 业务逻辑、队列、任务、租户隔离、资金和结算路径需要覆盖成功、失败、边界、重试或幂等语义。
- 迁移旧 `test/unit/` 或 `src/**/*.integration.spec.ts` 属于独立测试结构治理，不应混入普通功能修改。

## 10. PR Review Checklist

新增或修改后端耗时任务时，Review 至少问完这些问题：

- 这个接口是否把所有任务都做完才返回？
- 这个任务是 I/O 型、CPU 型，还是混合型？
- 是否可能超过 1 秒？是否可能被高频触发？
- HTTP 请求是否等待任务完全结束？
- 是否有行数、文件大小、批量数量、队列积压限制？
- 是否有 `tenantId`，状态查询是否校验租户？
- 是否有稳定 `jobId` 或业务幂等键？
- 失败后是重试、回执失败，还是补偿？
- 是否记录 jobId、tenantId、耗时、数量和失败原因？
- 是否会一次性把大数据读入内存？
- 是否用了同步阻塞 API？
- 是否会在 Redis 大 keyspace 下阻塞？
- 是否需要 Worker Thread 或独立服务？
- 队列消费者与 API 是否同进程？同进程时是否有明确上限和演进路径？
- 是否影响 OpenAPI / `@libs/common-types` / 前端任务状态展示？
- 验证命令是否覆盖了实际改动路径？

## 11. 后续可机械化项目

| 候选 harness                   | 目标                                                                             | 状态      |
| ------------------------------ | -------------------------------------------------------------------------------- | --------- |
| `check-node-blocking-patterns` | 扫描业务代码中的 `readFileSync`、`hashSync`、`pbkdf2Sync`、`execSync`            | ✅ 已实现 |
| `check-redis-blocking`         | 阻止新增业务链路 `KEYS`、无上限 `LRANGE`、KEYS 命令字符串                        | ✅ 已实现 |
| `check-export-limits`          | 检查 Excel 导出接口是否有 count/limit 或异步任务协议                             | ✅ 已实现 |
| `check-queue-contracts`        | 检查队列任务是否包含 jobId、tenantId、失败回执                                   | ✅ 已实现 |
| `check-test-spec-coverage`     | 检查 spec 文件是否包含 describe('invariants') 和 describe('boundary conditions') | ✅ 已实现 |
| `worker-topology-doctor`       | 检查 API/worker/scheduler 进程拓扑是否符合部署约定                               | ✅ 已实现 |
| `event-loop-smoke`             | 在 smoke 阶段采集 event loop delay，用于发现明显阻塞                             | ⬜ 待实现 |

**升级策略（FAIL_RULE_IDS 机制已实现）**：

1. `redis-keys`（check-redis-blocking）和 `hashSync`（check-node-blocking-patterns）已升级为 fail。
2. 其余规则继续 warn-only，观察期 ~1 个月积累误报样本。
3. 后续候选升级为 fail：`execSync`（业务代码中极少合法场景）、`lrange-unlimited`（全量读取在大列表下无合法用途）。
4. 每次升级都同步更新对应 spec 测试和 fix 提示文案。

## 12. 逻辑矫正

需要避免两个误判：

- NestJS 不是“不能做商城系统”；问题在于不能让接口主链路或同一个 Node.js 主事件循环承载所有任务。
- 本文不是只讨论 CPU 密集任务；长耗时 I/O、批量写库、文件生成、同步阻塞、大 JSON、定时任务和队列消费同样需要拆分位置。
- 队列不是“性能万能药”；如果重任务仍在同一个 Node 进程消费，它只是把阻塞从 HTTP 请求挪到队列消费者，仍可能抢占 API 资源。
- 多副本不是“任务拆分”；它能增加总容量，但不能修正单个请求或单个进程承担过多工作的方案错误。

本仓库的正确方向是：

```text
轻任务同步处理
耗时任务队列化
CPU 密集任务 Worker/独立服务隔离
大文件和大导出流式/异步化
API/Worker/Scheduler 按任务重量拆分进程
多进程/多副本只做容量扩展，不替代任务拆分
Harness 先提示，再逐步机械化阻塞规则
```

## 13. 注释审查与注释方案

代码注释应解释“为什么异步/为什么限流/为什么不能同步”，而不是重复代码动作。

推荐注释位置：

- 队列常量文件：说明并发、积压、行数和文件大小上限的业务含义。
- Controller：说明接口只受理任务，不等待任务完成。
- Processor：说明重试、幂等和失败回执策略。
- 导出 service：说明同步导出上限和超限后的异步路径。
- Redis 工具：说明为什么使用 SCAN 而不是 KEYS。

不推荐：

- 在每个 `await queue.add` 上写“加入队列”这类重复注释。
- 把未来计划写成 TODO 留在业务代码里。
- 用注释掩盖没有实现的限流、回执、租户校验或失败处理。

## 14. Harness 已知债务（供 AI Agent 读取）

> 本节专为 AI Agent 编写。如果你正在为本仓库实现新功能或修复 Bug，读完本节再开始——这里列出的是 harness 当前已知的覆盖盲区，你需要知道哪些验证目前是缺失的，以及后续任务是什么。

### 14.1 TEST_SPEC_PROTOCOL 缺乏执行约束 ✅ 已完成

`docs/governance/TEST_SPEC_PROTOCOL.md` 定义了 Phase 0–5 的规格驱动测试协议。

**当前状态（已完成）**：`scripts/check-test-spec-coverage.mjs` 已实现，扫描 `*.spec.ts` 文件检查是否包含 `describe('invariants')` 和 `describe('boundary conditions')` 块（短于 30 行的文件自动豁免）。已接入 `pnpm check:slice` 的 backend 路径（warn-only）。测试覆盖在 `scripts/check-test-spec-coverage.spec.mjs`（9 条测试）。

### 14.2 安全扫描脚本升级为 fail ✅ 已完成

`scripts/check-node-blocking-patterns.mjs`、`scripts/check-redis-blocking.mjs` 已为高置信度规则引入 `FAIL_RULE_IDS`：

- `check-redis-blocking`：`redis-keys` 规则升为 fail（`redis.keys()` 在业务代码中无合法使用场景）
- `check-node-blocking-patterns`：`hashSync` 规则升为 fail（密码散列应始终异步）
- `readFileSync`、`pbkdf2Sync`、`execSync`、`lrange-unlimited`、`keys-command-string` 仍为 warn

对应 spec 文件已补充 `FAIL_RULE_IDS` 测试用例。

### 14.3 Playwright E2E smoke ✅ 已存在

`apps/admin-web/e2e/smoke.spec.ts` 已存在，包含 2 条测试用例。`apps/admin-web/playwright.config.ts` 已配置（含 `globalSetup`、auth `setup` 项目、chromium 项目）。harness-doctor 检查两个文件路径均通过。

此债务项已关闭。如需扩展 smoke 覆盖范围，直接向该文件追加用例即可。

### 14.4 event-loop-smoke 未实现

`scripts/harness-smoke.mjs` 有框架，但 event loop delay 采集逻辑缺失。`check-node-blocking-patterns` 只做静态扫描，覆盖不了通过变量间接调用、第三方库内部阻塞、CPU 密集型业务逻辑这三类场景。

**后续任务**：在 `harness-smoke.mjs` 中，向 backend smoke 端点发请求前后用 `perf_hooks.monitorEventLoopDelay` 或 `--prof` 记录 delay，发现超过阈值（如 200ms）则输出 warn。阈值写进 `scripts/harness-smoke.mjs` 顶部常量，方便调整。

### 14.5 多租户隔离无自动化测试

AGENTS.md §4 把多租户隔离列为最高风险，但整个 backend 测试套件里**没有专门验证租户隔离边界的测试**。当前测试用例都在同一个测试租户下运行，不验证"tenantA 的请求看不到 tenantB 的数据"。

**后续任务**：在涉及租户隔离的核心 service（如 `resolution`、`scene`、`member`）的 spec 文件里，补充至少一条跨租户越权用例，断言结果为空或抛出 `ForbiddenException`。

### 14.6 独立评估者（开发阶段）缺失

**PR 级别**：已有（`/ultrareview` 或 Codex review，见分支工作流）。

**开发阶段**：Agent 生成代码后，没有任何自动化机制独立验证输出是否符合 AGENTS.md 规则、是否遗漏了高风险确认、是否跳过了 TEST_SPEC_PROTOCOL。所有验证仍是 Agent 自评，存在系统性高估偏差。

**当前缓解措施**：pre-write-guard hook 拦截受保护路径和危险内容；post-edit-chain hook 注入契约链提醒；harness-doctor 提供静态快照。这些合在一起只是 Evaluator 的粗糙近似，不是真正的独立验证。

**后续方向（与路线图对齐）**：

- **程序性 Evaluator（优先）**：`pnpm eval:phase` 须**重跑** exec-plan 中 DoD 命令并核对 exit code；仅审计 plan Markdown 内手写数字不算证据。见 `docs/governance/HARNESS_ROADMAP.md` §0.2–§0.3、§6.4。
- **会话型 Evaluator（可选）**：新对话 + 不同 system 指令 + 禁止改代码；不能单独证明 Phase 完成。
- Claude `PostToolUse` prompt hook 可作为会话型补充，不替代 `eval:phase` 重跑。

### 14.6.1 合格谓词（勿与 slice 混用）

```text
SliceOK(diff)     ⇔ pnpm check:slice 对当前 diff exit 0
PhaseDone(plan,p) ⇔ pnpm eval:phase 对 plan 的 Phase p exit 0（含 DoD 重跑）
TaskComplete      ⇔ PhaseDone ∧ SliceOK
```

完整定义、exec-plan 强制触发器与 manifest 边界见 `docs/governance/HARNESS_ROADMAP.md` §0。

### 14.7 backend 变更后没有强制启动 smoke

2026-05-18 marketing-revamp 启动排障暴露：`pnpm typecheck:backend` + 单测全绿，但 `pnpm dev:backend` 启动直接 fail-fast（`play_definition active rows is empty`）。根因是 `prisma/seeds/01-hq-foundation/play-definitions.ts` 写了 `seedPlayDefinitions` 但没接入 `01-hq-foundation/index.ts`，typecheck 看不到 seed 是否被 bootstrap 调用。

**盲区**：当前 backend 变更门禁链路 `pnpm fix:changed → pnpm check:slice → pnpm typecheck:backend` 全程不启动 NestApplication，以下错误全部静态可过、运行必爆：

- seed 函数存在但 bootstrap 未调用（文件孤立）。
- 模块循环依赖（`forwardRef` 在 TS 层合法，DI 解析期才死锁）。
- ConfigService 校验缺 key、Prisma client 单例顺序问题、启动期 fail-fast 校验失败。
- 模块 import 漂移导致 NestApplication 创建失败但单元测试因 mock 仍绿。

**最低要求（先人工，后机械化）**：backend 任何写入（命中 `apps/backend/src/**`、`apps/backend/prisma/**`）后，交付前必须在本地执行一次 `pnpm dev:backend`，等到 `Nest application successfully started` 或等价日志才能声明完成。typecheck 通过不等于能启动；现有 `pnpm harness:smoke:backend` 假设服务已启动，仍需手工 dev。

**后续任务**：

- 实现 `pnpm harness:boot:backend`：spawn `pnpm dev:backend`，等到 `Nest application successfully started` 或固定健康端点 200，N 秒超时即 fail，结束后 kill 子进程；接入 `pnpm check:slice` backend 路径。
- 在 `.claude/hooks/post-edit-format.mjs` 或新增 `post-edit-boot-reminder.mjs` 中：当变更命中 `apps/backend/src/module/**/*.module.ts`、`apps/backend/prisma/seeds/**`、`bootstrap*.ts` 等启动关键文件时，stop-summary 必须强制提示"未跑 boot smoke 不算完成"。
- `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 交付说明模板的"已验证"小节，对 backend 变更要求填入启动 smoke 日志摘要，不允许只写 typecheck/lint。

### 14.8 migration 不做历史漂移防御

2026-05-18 暴露 `20260508130000_repair_member_distribution_schema` 用 `ALTER COLUMN ... DROP NOT NULL` 假定旧列存在；本地干净库可过，但任何按更早 migration 迭代过的库（含 staging / 生产镜像）跑到这条 migration 会触发 P3018 并阻断后续所有 migration。§5.1 已列入禁止事项，但没有机械化拦截。

**盲区**：开发者全部依赖 `prisma migrate reset` + 干净库走通，没有"对带历史漂移的镜像库 dry-run migration"的脚本，所以这类错误必定要等到 staging / 生产首次部署才暴露。

**后续任务**：

- CI 增加 `migration-driftcheck` job：拉一份代表"长期演进"形态的 schema-only baseline（来源可以是 staging dump 或一份手工维护的历史 schema 快照），对当前分支跑 `prisma migrate deploy` 并捕获 P3018/P3009。
- `pnpm check:slice` 检测到 `prisma/migrations/**` 新增且 SQL 含 `ALTER COLUMN | DROP COLUMN | DROP NOT NULL | DROP CONSTRAINT` 时，强制要求文件内出现 `information_schema` 查询或 `DO $$ ... IF EXISTS` 包裹；否则 fail。
- `docs/governance/TEST_SPEC_PROTOCOL.md` Phase 4 对涉及历史列的 migration 要求写一条"对漂移库可幂等"的断言。

### 14.9 跨模块改造缺模块依赖图

2026-05-18 启动期 DI 死锁（`ClientOrderModule ↔ MarketingModule/Coupon/Integration/Play ↔ OrderService`）属于事后才暴露的设计错误：每个 PR 单独看都合理，但合到一起就成环。事前没有任何产物表达这些模块的依赖关系。

**盲区**：cross-app / 跨模块改造没有"先出模块依赖图、再写代码"的强制要求。`backend-safe-change.md`、`AGENT_OUTPUT_PROTOCOL.md` 都没把"依赖图"列为产物，typecheck 不报 `forwardRef` 循环。

**后续任务**：

- 写 `scripts/check-module-import-cycles.mjs`：扫描 `apps/backend/src/module/**/*.module.ts`，构建 import 图并检测环；含 `forwardRef` 的边强制标红并要求 PR 描述写明拆分计划（Port / ContractModule / 事件边界）。
- `apps/backend/AGENTS.md` 高风险域章节追加一条：order / marketing（coupon / integration / play）/ finance 跨模块改动前必须在 PR 描述贴模块依赖关系图（mermaid 文本即可），review 中比对环路。

### 14.10 dev watch 缺容量基线

2026-05-18 backend SWC watch 因 `typeCheck: true` + Swagger metadata 在 marketing 改造后文件量与 decorator 元数据增长触发 OOM。改 dev 配置可缓解，但根因是没有"开发模式容量基线"，文件量增长曲线上没有任何节点会主动告警，必须等真出 OOM 才被发现。

**盲区**：`nest-cli.json` 的 dev watch 默认开 typeCheck + plugins；`harness-doctor` 只检查命令存在，不采样实际内存占用。

**后续任务**：

- `nest-cli.json` 拆 `dev`（轻 watch，关 typeCheck 和 Swagger metadata plugin）和 `build`（保留全量类型检查 + plugin），用 `BUILD_MODE` / 独立配置文件区分；PR / CI 路径必须显式走 build 配置。
- `scripts/harness-doctor.mjs` 增加 backend 启动内存采样：spawn `pnpm dev:backend`，等 30s 后采 RSS，超过阈值输出 warn。阈值初始值由维护者基于一次实测后填入（参见 §15）。

## 15. 需要维护者后续补充

以下内容需要结合真实业务规模与部署环境补齐，不能由 AI 在没有证据时硬编码：

- 各导出/导入场景的同步行数上限、文件大小上限、接口超时和异步化阈值。
- API 进程、Worker 进程、Scheduler 进程是否拆分，以及各队列的默认并发、重试和积压阈值。
- 报表、对账、结算、清分、风控等高风险任务的 process spec 与失败回执模型。
- event loop delay、队列积压、job 失败率、导出耗时、Redis 慢命令等告警阈值。
- 前端任务状态展示的统一组件或页面模式，例如排队、运行中、完成、失败、可下载、失败明细。
- backend dev watch 启动 30s 后的 RSS 内存基线（用于 §14.10 告警阈值）；migration drift baseline schema 的来源与刷新频率（用于 §14.8 CI job）；`harness:boot:backend` 启动成功判定的日志字符串或健康端点路径与超时秒数（用于 §14.7）。
