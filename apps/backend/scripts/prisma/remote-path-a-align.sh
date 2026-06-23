#!/usr/bin/env bash
# 路径 A：空库 + 全量 prisma migrate deploy + 湖南 seed（与本地 Path A 一致）
# 用法（在 apps/backend 目录，且已配置 .env 的 DATABASE_URL）：
#   bash scripts/prisma/remote-path-a-align.sh
# 警告：会 DROP 当前 DATABASE_URL 指向的库并重建，所有业务数据丢失。仅用于 dev/test 或可清库环境。

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> 停止 PM2 backend（若存在）..."
pm2 stop nest_admin_soybean_server 2>/dev/null || pm2 stop nest_admin_server_dev 2>/dev/null || true

echo "==> prisma migrate reset（清库并应用全部 migration，跳过默认 seed）..."
pnpm exec prisma migrate reset --force --skip-seed --schema prisma

echo "==> 补齐 schema 漂移列（partial_refund_sn 等，migration 未收录时）..."
pnpm exec prisma db execute --schema prisma --file prisma/scripts/add-partial-refund-sn-and-transaction-unique.sql 2>/dev/null || true

echo "==> prisma generate ..."
pnpm prisma:generate

echo "==> 湖南 seed ..."
pnpm run prisma:seed:bootstrap-hunan

echo "==> migrate status ..."
pnpm exec prisma migrate status --schema prisma

echo "==> 完成。请 pm2 reload 后端并视情况 flush Redis。"
