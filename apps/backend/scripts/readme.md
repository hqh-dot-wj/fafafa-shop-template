# Backend Scripts 目录说明

本目录包含后端项目的各类脚本工具，按功能分类组织。

---

## 📁 目录结构

```
scripts/
├── debug/          # 调试脚本
├── data/           # 数据修复与历史回填脚本
├── seed/           # 数据种子脚本
├── setup/          # 环境设置脚本
├── verify/         # 验证测试脚本
├── test/           # 测试脚本
├── deploy/         # 部署相关脚本
├── utils/          # 工具脚本
└── README.md       # 本文件
```

---

## 🔄 data/ - 数据修复与历史回填脚本

用于可重复执行的数据修复、历史数据回填或迁移后补偿。

| 文件                             | 说明                                               |
| -------------------------------- | -------------------------------------------------- |
| `backfill-oms-order-del-flag.ts` | 对齐 `oms_order.delete_time` 与 `del_flag`         |
| `backfill-fulfillment-orders.ts` | 历史订单履约单回填；默认 dry-run，`--apply` 才写库 |

**履约回填 dry-run**：

```bash
pnpm fulfillment:backfill -- --tenant-id=000000 --limit=50
```

**履约回填写入**：

```bash
pnpm fulfillment:backfill -- --apply --tenant-id=000000 --confirm-apply=FULFILLMENT_BACKFILL --run-id=fulfillment-backfill-20260425-000000
```

写入模式必须先部署履约 migration，并指定租户和确认短语；`CANCELLED/REFUNDED` 需要额外传 `--allow-terminal-status`。

---

## 🔍 debug/ - 调试脚本

用于调试和排查问题的脚本。

| 文件                     | 说明                  |
| ------------------------ | --------------------- |
| `debug-aggregation.ts`   | 检查产品-活动聚合数据 |
| `debug-products.ts`      | 调试产品数据          |
| `debug-templates.ts`     | 调试营销模板数据      |
| `debug-captcha-issue.ts` | 调试验证码问题        |
| `debug-prisma.ts`        | 调试 Prisma 相关问题  |

**使用方式**：

```bash
npx tsx scripts/debug/debug-aggregation.ts
```

---

## 🌱 seed/ - 数据种子脚本

用于初始化测试数据的脚本。

| 文件                         | 说明             |
| ---------------------------- | ---------------- |
| `seed-marketing-activity.ts` | 种子营销活动数据 |
| `seed-courses.cjs`           | 种子课程数据     |

**使用方式**：

```bash
npx tsx scripts/seed/seed-marketing-activity.ts
```

---

## ⚙️ setup/ - 环境设置脚本

用于设置开发/生产环境的脚本。

| 文件               | 说明               |
| ------------------ | ------------------ |
| `setup-postgis.ts` | 设置 PostGIS 扩展  |
| `setup-tenant.cjs` | 设置租户环境       |
| `init-regions.ts`  | 初始化行政区划数据 |

**使用方式**：

```bash
npx tsx scripts/setup/setup-postgis.ts
```

---

## ✅ verify/ - 验证测试脚本

用于验证系统功能的脚本。

| 文件                | 说明              |
| ------------------- | ----------------- |
| `verify-lbs.ts`     | 验证 LBS 模块功能 |
| `verify-schema.sql` | 验证数据库 Schema |

**使用方式**：

```bash
npx tsx scripts/verify/verify-lbs.ts
```

---

## 🧪 test/ - 测试脚本

用于测试特定功能的脚本。

| 文件                           | 说明             |
| ------------------------------ | ---------------- |
| `test-auto-cancel.ts`          | 测试自动取消订单 |
| `test-commission-matrix.ts`    | 测试佣金矩阵     |
| `test-risks.ts`                | 测试风控功能     |
| `test-system-config.cjs`       | 测试系统配置     |
| `test-system-config-direct.ts` | 直接测试系统配置 |
| `test-e2e.cjs`                 | 端到端测试       |

**使用方式**：

```bash
npx tsx scripts/test/test-auto-cancel.ts
```

---

## 🚀 deploy/ - 部署脚本

用于部署应用的脚本。

| 文件                        | 说明         |
| --------------------------- | ------------ |
| `deploy.cjs`                | 部署脚本     |
| `deploy-config-example.cjs` | 部署配置示例 |
| `ecosystem-config.cjs`      | PM2 生态配置 |

**使用方式**：

```bash
node scripts/deploy/deploy.cjs
```

---

## 🛠️ utils/ - 工具脚本

通用工具脚本。

| 文件                       | 说明            |
| -------------------------- | --------------- |
| `generate-rsa-keys.cjs`    | 生成 RSA 密钥对 |
| `generate-test-data.ts`    | 生成测试数据    |
| `clear-config-cache.ts`    | 清理配置缓存    |
| `clear-configs.cjs`        | 清理配置        |
| `check-captcha-config.ts`  | 检查验证码配置  |
| `migrate-system-config.ts` | 迁移系统配置    |

**使用方式**：

```bash
node scripts/utils/generate-rsa-keys.cjs
```

---

## 🔄 reset/ - 重置脚本

用于重置数据的脚本。

| 文件                       | 说明             |
| -------------------------- | ---------------- |
| `reset-marketing-full.cjs` | 完全重置营销数据 |
| `reset-templates-only.cjs` | 仅重置模板数据   |

**使用方式**：

```bash
node scripts/reset/reset-marketing-full.cjs
```

---

## 🎭 simulate/ - 模拟脚本

用于模拟业务流程的脚本。

| 文件                    | 说明             |
| ----------------------- | ---------------- |
| `simulate-flow.ts`      | 模拟业务流程     |
| `simulate-full-flow.ts` | 模拟完整业务流程 |
| `simulation-report.txt` | 模拟报告         |

**使用方式**：

```bash
npx tsx scripts/simulate/simulate-flow.ts
```

---

## 📝 注意事项

1. **TypeScript 脚本**：使用 `npx tsx` 运行
2. **CommonJS 脚本**：使用 `node` 运行
3. **环境变量**：确保 `.env` 文件配置正确
4. **数据库连接**：确保数据库服务正常运行
5. **权限问题**：某些脚本可能需要管理员权限

---

## 🔗 相关文档

- [项目文档](../docs/)
- [API 文档](../docs/references/api-reference.md)
- [部署指南](../docs/guides/deployment-guide.md)

---

**最后更新**：2026-05-10
**维护者**：Backend Team
