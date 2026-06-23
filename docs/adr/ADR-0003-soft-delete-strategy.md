# ADR-0003: 软删语义（delFlag / deleteTime / Prisma 中间件）

**日期**：2026-03-27  
**状态**：accepted

## 背景

1. **Schema**

   - 业务表统一使用 `DelFlag`（`NORMAL` / `DELETE`，库内枚举值 `'0'` / `'1'`）表达**软删语义**。
   - `OmsOrder` 同时具有 `delFlag` 与可空 `deleteTime`：**是否已删以 `delFlag` 为准**；`deleteTime` 仅作**删除发生时间**的审计字段（与状态机并存）。

2. **Prisma 全局中间件（`PrismaService`）**

   - `delete` / `deleteMany` 对带 `delFlag` 的模型统一改写为 `update` / `updateMany`，写 `delFlag: DELETE`。
   - `OmsOrder` 在上述基础上**同时**写入 `deleteTime: now()`（审计）。
   - `SysMessage` 等列入 `MODELS_PASSTHROUGH_PHYSICAL_DELETE` 的模型保持物理删除。

3. **READ 扩展（`prisma-soft-delete.extension.ts`）**

   - 对 DMMF 中带 `delFlag` 的模型，在 `findMany` / `findFirst` / `findUnique` / `count` / `aggregate` / `groupBy` 等读路径默认合并 `delFlag: NORMAL`（**全局**，不按 C 端/后台分开关）。
   - 调用方已在 `where` 中含 `delFlag` 时不覆盖（便于回收站等）。
   - `OmsOrder`：若 `where` 中**仅有** `deleteTime` 条件而无 `delFlag`，视为显式条件，不叠加 `delFlag`（兼容旧查询）；常规路径依赖 `delFlag`。
   - **超级租户**与 **`ignoreTenant`** 时不加 READ 过滤（与租户扩展一致）。

4. **仓储**
   - `SoftDeleteRepository` 默认 `getDefaultWhere()` 为 `delFlag: NORMAL`。
   - `OrderRepository.softDelete` / `softDeleteBatch` 写 `delFlag: DELETE` 与 `deleteTime`。

## 决策

### 1. 语义分层（必须遵守）

| 类型           | 适用对象                      | 查询默认条件（Prisma 扩展 + 仓储） | 「删除」写法                                                               |
| -------------- | ----------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| **delFlag 族** | 带 `delFlag` 的模型（含订单） | `delFlag: NORMAL`                  | 中间件改写 `delete` 或仓储 `softDelete` / 显式 `update`                    |
| **硬删**       | 无软删字段或明确物理删模型    | 不适用                             | 仅在有明确合规/运维理由时执行；`MODELS_PASSTHROUGH_PHYSICAL_DELETE` 内登记 |

### 2. 订单域（OmsOrder）

- **软删判定以 `delFlag` 为准**；`deleteTime` 不单独决定可见性。
- 订单业务状态仍以 `OrderStatus` / `PayStatus` 等状态机为主。

### 3. 新表/新模型约定

- 默认：`delFlag` + `SoftDeleteRepository` 模式。
- 若需「删除时间」审计，可增 `deletedAt` / `deleteTime` 等字段，但须在 PR 中说明与 `delFlag` 的同步规则，避免双真源。

## 实施记录（运行时 · 增量）

- **2026-03-27：** 首版中间件 + READ 扩展（订单曾单独 `deleteTime`）。
- **2026-03-27（修订）：** `OmsOrder` 增加 `del_flag`；中间件对订单写 `delFlag` + `deleteTime`；READ 对订单按 `delFlag` 合并；迁移 `20260327150000_oms_order_del_flag`；幂等修复脚本 `scripts/data/backfill-oms-order-del-flag.ts`。

## 附录：deleteTime 仅审计（非独立软删族）

当前 **无**「仅以 `deleteTime` 表示软删」的模型；`OmsOrder.deleteTime` 为审计时间戳。

（新增模型时由 PR 作者更新本节与 `apps/backend/AGENTS.md` 如有必要。）
