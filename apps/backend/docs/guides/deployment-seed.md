# 部署种子数据说明

## 当前结论

backend 当前默认 seed 链路已经统一到“湖南科技有限公司”这套初始化流程：

- 非重置导入：`pnpm run prisma:seed:bootstrap-hunan`
- 重置后导入：`pnpm run prisma:seed:reset-hunan-skeleton`
- 别名：`pnpm run prisma:reset`

旧 `prisma:seed` / `prisma:seed:only` 等通用命令已经从 `package.json` 移除，不再作为部署或运维入口。

---

## 适用场景

### 1. 首次部署或空库初始化

如果库表允许重置，使用：

```bash
pnpm run prisma:seed:reset-hunan-skeleton
```

它会：

1. `prisma db push --force-reset`
2. 导入平台骨架
3. 应用湖南总平台覆写
4. 导入湖南营销最小集合和相关基础数据
5. 刷新 Redis

### 2. 已有表结构，仅补默认数据

如果数据库结构已存在，不希望清库，使用：

```bash
pnpm run prisma:seed:bootstrap-hunan
```

它会在现有 schema 上补导湖南默认骨架，不执行数据库重置。

---

## 部署脚本行为

当 `scripts/deploy.config.cjs` 中开启 `runSeed: true` 时，部署脚本会执行：

```bash
pnpm run prisma:seed:bootstrap-hunan
```

也就是“补导湖南默认骨架，不重置数据库”的安全路径。

---

## 手动执行

### 从本地通过 SSH 执行

```bash
ssh root@your-server-ip "cd /your/project/path && pnpm run prisma:seed:bootstrap-hunan"
```

### 登录服务器后执行

```bash
ssh root@your-server-ip
cd /your/project/path
pnpm run prisma:seed:bootstrap-hunan
```

---

## 当前 seed 内容

默认湖南链路会导入：

- 平台骨架：租户、客户端、字典、部门、用户、角色、菜单
- 湖南总平台覆写：公司信息、套餐、角色菜单、岗位
- 新零售基础数据：分类与属性模板
- 湖南营销最小集合：积分规则、优惠券模板、营销玩法模板

对应入口文件：`apps/backend/prisma/seeds/run-bootstrap-then-hunan-overrides.ts`

---

## 部署建议

### 首次部署

1. 配好 `.env.production`
2. 完成迁移或 `db push`
3. 按环境确认是否允许清库
4. 空库或可重置环境使用 `prisma:seed:reset-hunan-skeleton`
5. 不可清库环境使用 `prisma:seed:bootstrap-hunan`

### 日常更新

- 默认保持 `runSeed: false`
- 只有明确需要补导菜单、角色或湖南默认业务数据时，才手动执行 `prisma:seed:bootstrap-hunan`

---

## 注意事项

1. `prisma:seed:reset-hunan-skeleton` 会删除现有数据，只能在允许清库的环境使用。
2. 生产环境补种子只使用 `prisma:seed:bootstrap-hunan`。
3. 旧 `prisma:seed` / `prisma:seed:only` 命令已经移除，文档和脚本都应改用湖南链路。
4. 如果数据已存在导致冲突，优先核对是否已经完成过初始化，而不是恢复旧命令。

---

## 故障排查

### 菜单不显示

通常表示默认骨架未导入。执行：

```bash
ssh root@your-server "cd /path/to/project && pnpm run prisma:seed:bootstrap-hunan"
```

### Seed 执行失败

常见原因：

- 数据已存在，发生主键或唯一键冲突
- 数据库连接配置错误
- Prisma Client 未生成

排查命令：

```bash
pnpm exec prisma generate
pnpm run prisma:seed:bootstrap-hunan
```

---

## 相关文件

- `apps/backend/package.json`
- `apps/backend/prisma/seeds/run-bootstrap-then-hunan-overrides.ts`
- `apps/backend/scripts/deploy/deploy.cjs`
- `apps/backend/scripts/deploy.config.cjs`
