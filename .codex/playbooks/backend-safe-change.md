# Backend Safe Change

## 目标

为 backend 改动提供完整的安全执行手册，重点防止以下重复错误：

1. 租户条件漏写或被前端 `tenantId` 误导
2. 绕过 Repository 或统一异常语义
3. 同模型批量写操作退化为逐条 N 次访问
4. 把 `Promise.all` 当成事务内性能优化
5. 契约变更未同步到共享类型与前端链路
6. 测试只覆盖 happy path，遗漏权限、租户、失败与幂等

## 进入本手册前

先读根 `AGENTS.md` + `apps/backend/AGENTS.md`，再读本手册。涉及字典/任务再读 `.codex/playbooks/dict-and-job-change.md`；涉及验证再读 `.codex/playbooks/verification-gates.md`。本手册只补 backend 安全改动判断流程，不重复仓库总规则。

## backend 改动分类

先判断当前属于哪类：

- 普通 Controller / Service / Repository 改动
- 多租户语义改动
- Prisma / 数据结构改动
- 字典改动
- 定时任务改动
- 高风险模块改动
- 跨 app 契约改动

## 默认顺序

1. 先确认改动落点、影响模块和高风险级别
2. 明确输入、输出、错误语义与租户语义
3. 确认类型来源、DTO/VO/返回体变化和前端传播范围
4. 判断是否存在批量读写、删除、排序、导入、事务或 N+1 风险
5. 再进入实现与测试

## 输出协议与分析要求

按 `docs/governance/AGENT_OUTPUT_PROTOCOL.md` 输出。backend 场景额外覆盖：

- `Controller -> DTO -> Service -> Repository/Prisma -> 返回` 的真实链路
- 权限、租户、事务、批量语义与副作用

## 必查事项

### 多租户边界

必须确认：

- 当前能力属于 `TenantScoped`、`PlatformOnly` 还是 `TenantAgnostic`
- 租户信息是否来自后端上下文，而不是直接信任前端传入
- 自定义查询是否显式补齐租户过滤与软删语义
- 跨租户或平台级能力是否有明确的权限保护

禁止：

- 直接把前端传入的 `tenantId` 当作最终写库字段
- 手写 Prisma 查询时默认假设 middleware 会自动补齐所有边界

### Repository、Prisma 与契约层次

优先顺序：

1. 优先复用既有 Repository 或统一服务边界
2. 只有现有仓储无法表达需求时，才手写 Prisma 查询
3. 手写查询时，必须显式说明租户、软删、排序、分页、锁或事务语义

禁止：

- 在 Controller 里堆业务编排与数据访问
- 在 Service 中混合无边界的查询、权限、转换与日志副作用
- backend 契约已变化，却不评估 `pnpm generate-types` 与前端影响

### 跨 app 契约与 OpenAPI 刷新

完整契约链路与跨 app 默认顺序见根 `AGENTS.md` §1.2 + §2.2。本节补 backend 视角的 OpenAPI 源产物刷新执行细节：

Controller / DTO / VO 改动会影响前端契约时，先确认 OpenAPI 源产物是否已经刷新，再生成共享类型：

1. 完成 backend 源码和行为测试后，运行或重启 `pnpm dev:backend`。
2. 等 `apps/backend/public/openApi.json` 更新后，直接检查目标接口 path、method、response schema。
3. OpenAPI 源产物正确后，优先执行 `pnpm --filter @libs/common-types contracts:generate`；也可执行仓库级 `pnpm generate-types`，但要知道它可能按 Turbo 依赖图执行 `@apps/backend:build`。
4. 若生成类型没有变化，先回查 `openApi.json` 是否仍是旧 schema；只有确认源产物已刷新但任务被缓存命中时，才处理 Turborepo / pnpm 任务缓存。
5. 最后按影响范围适配 admin-web / miniapp-client，并执行对应前端验证。

Windows 自动化注意：

- 人工终端直接执行 `pnpm dev:backend` 即可。
- 脚本里用 `Start-Process` 启动时，`-FilePath` 应写 `pnpm.cmd`；写 `pnpm` 可能命中 shim 并报“不是有效的 Win32 应用程序”。

禁止：

- 为了刷新 OpenAPI 契约而先跑 `pnpm build:backend`；build 只用于产物验证或定位打包问题，不是契约源产物刷新入口。
- 把 `pnpm generate-types` 输出中的 `@apps/backend:build` 当成 OpenAPI 刷新机制；OpenAPI 是否正确只看 `pnpm dev:backend` 后的 `apps/backend/public/openApi.json`。
- 在 `openApi.json` 仍是旧 schema 时反复跑 `pnpm generate-types`，或把“绕过 Turbo cache”当成主要修复手段。
- 手工改 `apps/backend/public/openApi.json` 或 `libs/common-types/src/api.d.ts` 来掩盖 backend Swagger / DTO / VO 未正确出数。
- 只看生成后的 `api.d.ts`，不检查 OpenAPI 里目标接口的真实 schema。

### 用户可见语义与返回体稳定性

必须确认：

- 新增或修改的 code、status、type、stage、role、payStatus 是否为稳定业务语义
- 若返回 `xxxText` 字段，是否明确这是“已本地化且可直接展示”的契约，而不是临时拼接文本
- 若返回 code 而不返回 text，admin-web / miniapp 是否有统一映射来源
- 同一语义是否会同时出现在列表、详情、导出、日志、任务页、统计卡等多个面

禁止：

- 将未经治理的英文枚举、数据库原始值或临时拼接文本直接透传给用户界面
- 只改一个返回体字段，却不评估上下游对同一语义的显示一致性

### 批量读写、删除与事务语义

默认原则：

1. 同模型独立写操作，优先评估 `createMany`、`updateMany`、`deleteMany` 或既有批量 Repository 方法
2. 选中多条记录的删除、启停、导入、重排、同步，不要默认写成逐条循环
3. 逐条处理只在以下场景允许：
   - 每条有独立业务校验
   - 每条有外部副作用或审计要求
   - 每条失败需要独立恢复或独立反馈
   - 现有数据模型无法用单次批量表达
4. 只要使用逐条循环，必须在实现前明确理由，并在测试中覆盖逐条失败语义

重点约束：

- 事务中的 `Promise.all` 不得被当作真实并行性能优化理由
- 删除前的存在性检查、关联检查、统计检查，应优先评估批量预取、批量 count、groupBy 或一次性查询
- 排序、导入、同步等批量写操作，不要无脑 N 次 `update`
- 删除 10 条默认应先评估“1 次批量接口/批量仓储”是否可行，而不是直接 10 次单删

### 字典与定时任务

若涉及以下任一内容，必须切换到专项治理视角：

- `dictType`
- 字典项
- 定时任务定义
- 调度表达式
- 任务并发、幂等、日志或同步语义

这类改动除了本手册，还必须同时满足 `.codex/playbooks/dict-and-job-change.md`。

### 高风险模块

完整触发条件与停手协议见根 `AGENTS.md` §3 + `apps/backend/AGENTS.md` §高风险模块。

高风险改动禁止顺手做无关重构。

## 测试与验证要求

### backend 测试不是只跑命令

至少要回答：

1. happy path 是否被验证
2. 边界条件是否被验证
3. 失败路径是否被验证
4. 租户、权限、幂等或并发语义是否被验证
5. 若是批量操作，逐条失败与部分成功语义是否被验证

### 不足以证明正确的测试

以下测试不足以单独作为完成证据：

- 只断言方法被调用
- 只验证单一成功路径
- 通过 `@ts-nocheck` 关闭测试文件类型约束后继续堆 mock
- 批量写操作只测“全部成功”，不测部分失败、空数组、重复项、非法项

### 建议验证矩阵

普通 Controller / Service / Repository：

```powershell
pnpm --filter @apps/backend typecheck
pnpm --filter @apps/backend test -- <对应模块或文件>
```

多租户、权限、高风险写操作：

- 需要额外覆盖租户隔离、权限拒绝、重复提交或幂等路径

Prisma / 结构变更 / 跨 app 契约：

```powershell
pnpm verify-monorepo
```

字典与任务：

- 参照 `.codex/playbooks/dict-and-job-change.md`

## 交付前自查

- 是否明确当前改动属于哪类 backend 变更
- 是否写清输入、输出、错误、租户与权限语义
- 是否用了正确层级：Controller / Service / Repository
- 是否评估了批量能力、删除语义、事务语义和 N+1 风险
- 是否评估了返回体里的用户可见语义
- 是否说明了 `pnpm generate-types` 与前端传播面
- 是否给出了足够的行为测试与验证建议

## backend 常见返工点

- 手写 Prisma 查询时漏掉租户条件
- 前端传了 `tenantId`，后端就直接信任
- 批量删除、导入、排序写成逐条查询和逐条更新
- 用事务包裹 `Promise.all` 就宣称“已经并行优化”
- 新增状态 code 后，只改数据库或后端，不评估前端显示
- 只测成功路径，没有测权限、失败和幂等
