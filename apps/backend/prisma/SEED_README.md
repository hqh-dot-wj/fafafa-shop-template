# Prisma Seeds 目录说明

本目录维护 backend 的 Prisma 种子脚本。当前默认种子链路已经切到“湖南科技有限公司”这套初始化流程；旧 `prisma/seed.ts` 仍保留在仓库中，但不再作为日常新增/删减种子的入口。

---

## 当前默认入口

- 编排入口：`apps/backend/prisma/seeds/run-bootstrap-then-hunan-overrides.ts`
- 非重置导入：`pnpm --filter @apps/backend prisma:seed:bootstrap-hunan`
- 重置后导入：`pnpm --filter @apps/backend prisma:seed:reset-hunan-skeleton`
- 别名：`pnpm --filter @apps/backend prisma:reset`

### 默认入口会做什么

1. 平台骨架初始化：租户、客户端、字典、部门、用户、角色、菜单
2. 湖南总平台覆写：公司信息、套餐、角色菜单、岗位
3. 新零售基础数据：分类与属性模板
4. 湖南营销最小集合：demo 商品 2 个、积分规则、优惠券模板、营销玩法模板
5. 数据库序列重置：避免后续 seed 发生主键冲突

---

## 目录结构

```text
prisma/
├── migrations/     # 数据库迁移文件
├── schema.prisma   # Prisma Schema
├── seed.ts         # 历史入口，保留但不再扩写
├── seeds/
│   ├── 00-platform/                         # 平台骨架
│   ├── 01-hq-foundation/                    # 总部基础数据
│   ├── 02-system-config/                    # 系统配置
│   ├── 03-tenants/                          # 租户
│   ├── 04-tenant-selection/                 # 租户业务初始化
│   ├── 05-c-end/                            # C 端演示数据
│   ├── reset/                               # 局部重置脚本
│   ├── setup/                               # 环境准备脚本
│   ├── utils/                               # 工具脚本
│   ├── seed-hunan-platform-overrides.ts     # 湖南总平台覆写
│   ├── hunan-marketing-minimal.ts           # 湖南营销最小集合
│   └── run-bootstrap-then-hunan-overrides.ts # 当前默认种子编排入口
└── SEED_README.md
```

---

## 使用方式

### 1. 开发环境重置并初始化

```bash
pnpm --filter @apps/backend prisma:seed:reset-hunan-skeleton
```

适用：本地重建数据库、重新初始化湖南默认骨架。

### 2. 在现有表结构上补默认种子

```bash
pnpm --filter @apps/backend prisma:seed:bootstrap-hunan
```

适用：数据库结构已经存在，只需要补导湖南骨架和最小业务数据。

### 3. 使用 reset 别名

```bash
pnpm --filter @apps/backend prisma:reset
```

当前等价于 `prisma:seed:reset-hunan-skeleton`。

---

## 局部重置脚本

| 文件                                       | 说明                           |
| ------------------------------------------ | ------------------------------ |
| `seeds/reset/reset-marketing-all.ts`       | 重置所有营销数据               |
| `seeds/reset/reset-marketing-templates.ts` | 仅重置营销模板                 |
| `seeds/reset/clear-business-data.ts`       | 清理业务数据，保留系统基础数据 |

示例：

```bash
npx tsx prisma/seeds/reset/reset-marketing-all.ts
pnpm --filter @apps/backend prisma:clear-business
```

---

## setup / utils / fix

- `seeds/setup/`：环境预置脚本，例如课程初始化
- `seeds/utils/`：辅助脚本，例如 SQL 转 seed、清理门店配置
- `seeds/fix/`：数据库修复脚本

---

## 注意事项

1. 后续新增或删减 seed，请优先修改 `run-bootstrap-then-hunan-overrides.ts` 及其引用的湖南链路文件，不再向旧 `prisma/seed.ts` 追加业务初始化。
2. `prisma:seed:reset-hunan-skeleton` 会清库，执行前确认目标环境。
3. 生产环境如需补种子，只使用 `prisma:seed:bootstrap-hunan`，不要执行重置命令。
4. 局部 reset 脚本会删除对应模块数据，执行前先备份。

---

## 相关文件

- `apps/backend/package.json`
- `apps/backend/prisma/seeds/run-bootstrap-then-hunan-overrides.ts`
- `apps/backend/prisma/seeds/hunan-marketing-minimal.ts`
- `apps/backend/prisma/seeds/seed-hunan-platform-overrides.ts`
- `apps/backend/scripts/deploy/deploy.cjs`
