---
title: Quality Attribute Governance 质量属性治理
status: active
doc_type: governance
last_verified: 2026-05-11
---

# Quality Attribute Governance

本文档定义本项目的质量属性治理体系。核心问题只有一个：

> 这次改动影响了哪些质量属性？对应等级的证据是什么？

## 0. 使用定位

| 角色                            | 用途                                                              |
| ------------------------------- | ----------------------------------------------------------------- |
| **PR 作者**                     | 根据"影响范围"查 `matrix.yml`，填写 PR 模板中的质量属性证据       |
| **AI reviewer（Codex/Claude）** | 对照 diff 验证作者声明与代码实现的一致性；参考 §2 协议            |
| **脚本层**                      | `check:slice` 根据变更路径路由到对应检查；路由规则见 `matrix.yml` |

与现有文档的关系：

| 文档                     | 关注点                                                 |
| ------------------------ | ------------------------------------------------------ |
| `AGENTS.md`              | 任务处理决策树、执行顺序、验证门禁矩阵                 |
| `HARNESS_ENGINEERING.md` | Node.js 事件循环风险、Harness 能力清单与架构空白       |
| 本文档                   | 质量属性定义、可验证标准、AI review 协议、门禁升级路线 |

## 1. 7 个质量属性

### 1.1 业务正确性（Correctness）

**适用范围**：金融、订单、支付、钱包、营销、库存模块

| 方面     | 硬性要求                        | 检查方式  |
| -------- | ------------------------------- | --------- |
| 状态机   | 状态转换单向，无跳过            | AI review |
| 金额     | 非负约束 + Decimal 精度声明     | AI review |
| 幂等     | 写操作有幂等键或 DB 唯一约束    | AI review |
| 并发     | 乐观锁 / 悲观锁 / DB 约束三选一 | AI review |
| 事务     | 回滚路径有测试覆盖              | test gate |
| 租户隔离 | 跨租户读写有测试证明拒绝        | test gate |

**门禁级别**：Hard — PR 涉及上述模块时 AI reviewer 必须核查，无法绕过。

### 1.2 数据库查询安全（DB Query）

**适用范围**：所有新增或改动的查询路径

| 方面     | 要求                                               | 检查方式                       |
| -------- | -------------------------------------------------- | ------------------------------ |
| 分页上限 | `findMany` 必须有 `take`，最大值在 PR 中声明       | warn-only（升级计划见 §3）     |
| 索引声明 | 排序/过滤字段有 `@@index` 或说明理由               | AI review                      |
| N+1      | 关联关系用 `include`/`select` 合并，不在循环内查询 | `check-node-blocking-patterns` |
| 循环写库 | 禁止循环内 `await prisma.*` 写操作                 | `check-node-blocking-patterns` |

**技术债**：`apps/backend/src/prisma/prisma-soft-delete.middleware.ts` 使用已废弃的
`$use` API（Prisma 4.16.0 deprecated，6.14.0 removed）。当前版本 6.7.0 可运行但须在
升级到 6.14+ 前迁移到 `$extends`，参照已有的 `prisma-soft-delete.extension.ts` 写法。

待建工件：`prisma-pagination.extension.ts`——用 `$extends.$allModels.findMany` 在开发
环境 warn 无 `take` 的查询，无需安装额外包。

### 1.3 弹性与兜底（Resilience）

**适用范围**：缓存层、Redis 操作、第三方接口、定时任务

| 方面          | 要求                                                                  |
| ------------- | --------------------------------------------------------------------- |
| 缓存改动      | 必须覆盖命中 / 未命中 / 失效 3 条路径的测试                           |
| Fallback 语义 | 不是静默返回空或无限 retry；有明确用户可见错误或 stale 标记           |
| Redis 断开    | 有明确错误降级，不卡死                                                |
| 队列失败      | 有 `@OnQueueFailed` 或 try/catch + 日志；`check-queue-contracts` 扫描 |

### 1.4 后端接口性能（Backend Performance）

**适用范围**：新增接口、改动查询路径、导出/下载接口

| 方面         | 要求                                                               | 检查方式                                   |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| 无阻塞主链路 | CPU 密集 / 文件 I/O / 批量操作 → 队列或 Worker，不放 HTTP 响应链路 | AI review + `check-node-blocking-patterns` |
| 导出限制     | 导出接口有 limit/count 保护或走异步任务路径                        | `check-export-limits`                      |

详细原则见 `HARNESS_ENGINEERING.md` §2。

### 1.5 前端包体积（Frontend Bundle）

**适用范围**：admin-web / miniapp-client 新增路由或依赖

| 方面       | 要求                                                                      | 状态                                |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------- |
| 禁止名单   | `echarts` / `monaco-editor` / `xlsx` / `@umoteam/editor` 不得进首屏 chunk | ⬜ 待建 `check-admin-bundle-budget` |
| 路由懒加载 | 新增路由必须使用动态 import                                               | AI review                           |
| 重依赖声明 | 新增压缩后 > 50KB 的依赖必须在 PR 中说明理由                              | AI review                           |

**安装说明**：如需精确 chunk 分析，可安装 `rollup-plugin-visualizer` 为 dev
dependency。暂不强制，`check-admin-bundle-budget` 先用脚本扫描 dist 实现。

### 1.6 前端 UX 状态（UX States）

**适用范围**：新增或改动的页面/列表组件

| 状态    | 要求                                                |
| ------- | --------------------------------------------------- |
| Loading | 有 loading 态（`v-loading` / Spin / Skeleton 均可） |
| Empty   | 数据为空时有 empty 态                               |
| Error   | 接口失败时有 error 提示 + 可操作动作（重试/返回）   |
| 防重复  | 提交按钮有 `loading`/`disabled` 防重复提交          |

**注意**：此属性无法机械扫描，依赖 AI review + E2E 测试。长期方向是通过统一的
`<AppTable>` / `<AppList>` 组件内置这 4 种状态，收敛表达方式后再下沉脚本检查。

### 1.7 安全与权限（Security）

**适用范围**：所有 PR（必填）

| 方面           | 要求                                               | 检查方式               |
| -------------- | -------------------------------------------------- | ---------------------- |
| SQL 注入 / XSS | 无原始字符串拼接 SQL；无未消毒 `v-html`            | AI review              |
| 权限校验       | 接口有 `@RequirePermission` 或等效守卫；多租户隔离 | AI review              |
| 敏感字段       | 日志/响应中无明文密码/token                        | `pre-write-guard` hook |
| 硬编码密钥     | 无硬编码 tenantId / secret / 凭证                  | `pre-write-guard` hook |

## 2. AI Review 协议

Codex/Claude 作为 PR reviewer 时按以下流程执行：

```
Step 1  读取 PR 模板"影响范围"勾选项
Step 2  查 matrix.yml routes，确定本 PR 需核查的质量属性集合
Step 3  对照 diff 逐一验证"质量属性证据"区块中的每条声明：
          声明"有幂等键"     → diff 中找到对应字段或 DB 唯一约束
          声明"findMany 有 take" → diff 中找到 take 参数
          声明"有 loading 态"  → diff 中找到相关变量或组件
Step 4  声明与 diff 不一致 → 标注文件:行号，要求作者补充或修正
Step 5  diff 中看不到的声明  → 标注"无法从 diff 验证，需人工确认"
```

**AI reviewer 边界**：

- 能验证：声明与 diff 的文本一致性
- 不能验证：运行时行为（缓存命中率、实际响应时间、测试是否真正通过）
- 不能验证：测试命令输出（只能检查是否有粘贴，不能执行）

## 3. 门禁升级路线

所有 `check-*.mjs` 当前为 warn-only。升级策略：**对新增行严格，对存量代码宽松**。

| 脚本                           | 当前状态  | 升级条件                             | 目标          |
| ------------------------------ | --------- | ------------------------------------ | ------------- |
| `check-node-blocking-patterns` | warn-only | 新增行 violations = 0，持续 10 次 CI | 新增行 fail   |
| `check-redis-blocking`         | warn-only | 同上                                 | 新增行 fail   |
| `check-export-limits`          | warn-only | 新增路由覆盖率 100%                  | 新增路由 fail |
| `check-queue-contracts`        | warn-only | 所有新 processor 合规                | 新增文件 fail |
| `check-admin-bundle-budget`    | ⬜ 待建   | 建立禁止名单基线                     | 禁止名单 fail |

升级进度记录在 `HARNESS_ENGINEERING.md` §6。

## 4. 待建工件

| 工件                                                     | 类型      | 优先级 | 说明                                                             |
| -------------------------------------------------------- | --------- | ------ | ---------------------------------------------------------------- |
| `scripts/check-admin-bundle-budget.mjs`                  | 脚本      | P1     | 扫描 dist/assets/\*.js，禁止名单包进首屏 chunk                   |
| `apps/backend/src/prisma/prisma-pagination.extension.ts` | 代码      | P1     | `$extends.$allModels.findMany`，开发环境 warn 无 `take`          |
| `prisma-soft-delete.middleware.ts` → Extension 迁移      | 代码      | P2     | 迁移 `$use` 写侧到 `$extends`，升级 Prisma 6.14+ 前必须完成      |
| `web-vitals` 接入 admin-web                              | 安装+代码 | P2     | `pnpm add web-vitals --filter @apps/admin-web`，接入已有上报链路 |

## 5. 参考文档

- `docs/quality-attributes/matrix.yml` — 文件路径 → 质量属性路由矩阵
- `docs/governance/HARNESS_ENGINEERING.md` — Node.js 阻塞风险与 Harness 能力
- `docs/governance/TEST_SPEC_PROTOCOL.md` — 测试规格生成协议
- `scripts/AGENTS.md` — 脚本新增规范
- Prisma Client Extensions（query）: https://www.prisma.io/docs/orm/prisma-client/client-extensions/query
- Prisma `$use` 弃用 issue: https://github.com/prisma/prisma/issues/27891
