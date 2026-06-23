# Prisma 数据契约指引

## 1. 速览

- 适用范围：`apps/backend/prisma/**`
- 职责定位：Prisma schema、migration、seed 与数据库契约资源。
- 先读顺序：
  1. 根 `AGENTS.md`
  2. `apps/backend/AGENTS.md`
  3. 本文件
  4. `.codex/playbooks/backend-safe-change.md`
  5. 涉及字典或任务时读 `.codex/playbooks/dict-and-job-change.md`
  6. 涉及验证时读 `.codex/playbooks/verification-gates.md`

本目录默认属于高风险区域。任何 schema、migration、seed、数据脚本、批量回填改动，都必须先按根 `AGENTS.md` 高风险流程停手确认。

## 2. 目录职责

```text
apps/backend/prisma/
├── schema.prisma          # Prisma 主 schema，高风险
├── models/                # 分域模型拆分，高风险
├── migrations/            # migration，高风险，禁止直接修改已有 migration
├── seeds/                 # seed 数据，高风险
├── seed.ts                # seed 入口，高风险
├── seed-pipeline.ts       # seed 管线，高风险
└── scripts/               # SQL / 回填 / 修复脚本，高风险
```

## 3. 修改红线

- 禁止未经确认修改已有 migration。
- 禁止未经确认执行删除、批量写入、数据迁移、历史回填脚本。
- 禁止用手改数据库结构绕过 Prisma schema / migration 链路。
- 禁止在 seed 中混入生产敏感数据、真实密钥、真实租户隐私信息。
- 字典 seed、初始化 SQL、治理注册必须保持一致，不能只改其中一处。

## 4. 常见改动判断

| 改动类型            | 默认动作                                                               |
| ------------------- | ---------------------------------------------------------------------- |
| 新增 / 修改模型字段 | 先列影响表、字段、索引、历史数据与前后端契约影响，确认后新建 migration |
| 修改已有 migration  | 默认禁止；除非用户明确确认且说明原因                                   |
| seed 新增数据       | 先确认是否受版本治理、是否影响字典/菜单/租户初始化                     |
| SQL 回填 / 修复脚本 | 先说明执行条件、影响范围、回滚方案                                     |
| 字典相关数据        | 同步检查治理注册、seed、前端消费、历史文案影响                         |

## 5. 数据与租户语义

- 多租户表字段、租户过滤、租户豁免和跨租户查询属于高风险语义。
- 前端传入的 `tenantId` 不得作为可信写入来源；租户来源应由后端上下文或明确授权路径提供。
- 软删除语义与审计字段不得随意混用；涉及删除路径时先确认 `delFlag`、`deleteTime` 与现有 middleware / extension 行为。
- 新增索引、唯一约束、外键或枚举前，先检查历史数据兼容性和线上迁移成本。

## 6. 验证建议

按实际改动选择，不能用局部验证替代高风险完整链路：

- Prisma 生成 / schema 检查：在 `apps/backend` 内执行对应 Prisma 命令。
- 后端类型验证：`pnpm typecheck:backend`
- 影响 OpenAPI 契约：`pnpm generate-types`
- 影响前端消费：受影响前端的 typecheck 与 lint。
- 字典治理：`pnpm verify:dict-governance`、`pnpm verify-monorepo`

如果本轮只是修改本文件这类规则文档，不需要执行 Prisma 命令或数据库验证；交付说明中应明确未触碰 schema、migration、seed 与数据。
