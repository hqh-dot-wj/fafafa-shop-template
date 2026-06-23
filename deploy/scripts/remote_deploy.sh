#!/bin/sh
# 在部署服务器上执行：拉取镜像、迁移、滚动更新 Compose 服务
# 由 GitHub Actions 通过 SSH 注入环境变量后调用

set -e

ENVIRONMENT=${1:-prod}
DEPLOY_PATH="${DEPLOY_DIR:-$DEPLOY_PATH}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
CLEANUP_SCRIPT="${DEPLOY_PATH}/scripts/cleanup-images.sh"

echo "🚀 Nest-Admin 远程部署 ($ENVIRONMENT)"

if [ -z "$DEPLOY_PATH" ]; then
  echo "❌ 缺少 DEPLOY_DIR 或 DEPLOY_PATH"
  exit 1
fi

cd "$DEPLOY_PATH" || exit 1

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ 未找到 $DEPLOY_PATH/$COMPOSE_FILE，请先由 CI 同步 deploy/ 部署文件"
  exit 1
fi

if [ ! -f .env ]; then
  echo "❌ 未找到 $DEPLOY_PATH/.env"
  echo "   请从 deploy/env.production.example 复制并填写后再部署"
  exit 1
fi

# shellcheck disable=SC1091
set -a
. ./.env
set +a

export IMAGE_TAG="${IMAGE_TAG:-latest}"
export REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:?REGISTRY_NAMESPACE required}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# compose run 时 PATH 可能为空，统一在此设置工作目录与 PATH
api_sh() {
  compose run --rm --no-deps api \
    sh -c "export PATH=/app/node_modules/.bin:\$PATH; cd /app/apps/backend && $*"
}

redis_flush() {
  echo "🧹 清空 Redis (db ${REDIS_DB:-2})..."
  compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n "${REDIS_DB:-2}" FLUSHDB \
    || echo "⚠️  Redis FLUSHDB 失败（可忽略若 Redis 未启动）"
}

echo "📦 镜像: ${REGISTRY_NAMESPACE}/backend:${IMAGE_TAG}"
echo "📦 镜像: ${REGISTRY_NAMESPACE}/admin:${IMAGE_TAG}"
echo "📦 镜像: ${REGISTRY_NAMESPACE}/h5:${IMAGE_TAG}"
echo "📦 镜像: ${REGISTRY_NAMESPACE}/landing:${IMAGE_TAG}"

echo "🔐 登录容器仓库..."
if [ -n "$REGISTRY_USER" ] && [ -n "$REGISTRY_PASSWORD" ]; then
  echo "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USER" --password-stdin "$CI_REGISTRY" 2>/dev/null \
    || echo "$REGISTRY_PASSWORD" | docker login -u "$REGISTRY_USER" --password-stdin ghcr.io
elif [ -n "$CI_JOB_TOKEN" ] && [ -n "$CI_REGISTRY" ]; then
  echo "$CI_JOB_TOKEN" | docker login -u gitlab-ci-token --password-stdin "$CI_REGISTRY" || true
fi

echo "🐳 拉取镜像..."
compose pull api admin h5 landing || true

echo "🗄️  启动数据层（若尚未运行）..."
compose up -d postgres redis

echo "⏳ 等待 Postgres / Redis..."
sleep 5

if [ "${RUN_DB_RESET:-false}" = "true" ]; then
  echo "⚠️  RUN_DB_RESET=true：migrate reset（清库并应用全部 migration，与本地 Path A 一致；仅测试/演示环境）..."
  api_sh '/app/node_modules/.bin/prisma migrate reset --force --skip-seed --schema prisma' \
    || {
      echo "❌ 数据库 migrate reset 失败"
      exit 1
    }
  echo "🗄️  补齐 partial_refund_sn（兼容旧版 PG）..."
  compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nest-admin-soybean}" -v ON_ERROR_STOP=1 -c \
    "ALTER TABLE oms_order ADD COLUMN IF NOT EXISTS partial_refund_sn VARCHAR(100) NULL;" \
    || {
      echo "❌ partial_refund_sn 列补齐失败"
      exit 1
    }
  api_sh '/app/node_modules/.bin/prisma generate --schema prisma' || true
  redis_flush
elif [ "${RUN_MIGRATE:-true}" = "true" ]; then
  echo "🗄️  执行 Prisma migrate deploy..."
  api_sh '/app/node_modules/.bin/prisma migrate deploy --schema prisma' \
    || {
      echo "❌ 数据库迁移失败"
      exit 1
    }
fi

# 湖南完整演示种子（商品/营销场景/拼课团等；含平台骨架覆写）
if [ "${RUN_HUNAN_SEED:-false}" = "true" ]; then
  echo "🌱 执行湖南完整演示种子..."
  api_sh '/app/node_modules/.bin/ts-node -r tsconfig-paths/register --transpile-only prisma/seeds/run-bootstrap-then-hunan-overrides.ts' \
    || {
      echo "❌ 湖南演示种子失败"
      exit 1
    }
  redis_flush
# 补平台首页 Tab 场景 + H5 密码联调会员（与 seed-pipeline 对齐，幂等）
elif [ "${RUN_H5_SUPPLEMENT:-false}" = "true" ]; then
  echo "🌱 补灌首页 Tab 场景与 H5 联调账号..."
  api_sh '/app/node_modules/.bin/ts-node -r tsconfig-paths/register --transpile-only prisma/seeds/run-deploy-h5-supplement.ts' \
    || {
      echo "❌ H5 部署补种失败"
      exit 1
    }
  redis_flush
# 首次部署：平台骨架 + admin 用户 + play_definition（可登录后台）
# 已有 admin 时脚本内会跳过骨架、仅补齐 play_definition
elif [ "${RUN_BOOTSTRAP:-false}" = "true" ]; then
  echo "🌱 执行生产首次引导（平台基础数据）..."
  api_sh '/app/node_modules/.bin/ts-node --transpile-only --project prisma/tsconfig.seed.json prisma/seeds/run-prod-bootstrap.ts' \
    || {
      echo "❌ 生产引导种子失败"
      exit 1
    }
elif [ "${RUN_SEED:-false}" = "true" ]; then
  # 仅 play_definition 最小 SQL（无租户/用户；不能单独用于首次登录）
  SEED_SQL="${DEPLOY_PATH}/scripts/seed-play-definition-minimal.sql"
  if [ -f "$SEED_SQL" ]; then
    echo "🌱 执行最小种子（仅 play_definition）..."
    compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nest-admin-soybean}" < "$SEED_SQL" \
      || {
        echo "❌ 最小种子执行失败"
        exit 1
      }
  else
    echo "⚠️  未找到 $SEED_SQL，跳过种子"
  fi
fi

echo "🔄 滚动更新 API..."
compose up -d --no-deps --force-recreate api

MAX_WAIT=120
WAIT_COUNT=0
API_HEALTHY=false

while [ "$WAIT_COUNT" -lt "$MAX_WAIT" ]; do
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' nest-admin-api-prod 2>/dev/null || echo "starting")
  if [ "$HEALTH_STATUS" = "healthy" ]; then
    API_HEALTHY=true
    break
  fi
  echo "⏳ API 启动中... ($WAIT_COUNT/${MAX_WAIT}s) [${HEALTH_STATUS}]"
  sleep 5
  WAIT_COUNT=$((WAIT_COUNT + 5))
done

if [ "$API_HEALTHY" != "true" ]; then
  echo "❌ API 健康检查超时"
  compose logs --tail=80 api
  exit 1
fi

echo "🔄 更新静态站点与 Gateway..."
if ! compose up -d --force-recreate landing h5 admin gateway; then
  echo "❌ 静态站点或 Gateway 启动失败"
  compose ps
  compose logs --tail=60 admin h5 gateway 2>/dev/null || true
  exit 1
fi

sleep 5
compose ps

for svc in admin h5 landing; do
  CNAME="nest-admin-${svc}-prod"
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$CNAME" 2>/dev/null || echo "unknown")
  if [ "$HEALTH_STATUS" != "healthy" ]; then
    echo "❌ ${svc} 健康检查未通过: ${HEALTH_STATUS}"
    compose logs --tail=60 "$svc" 2>/dev/null || true
    exit 1
  fi
done

echo ""
echo "✅ 部署完成"
echo "   宣传页: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${HTTP_PORT:-80}/"
echo "   H5:     http://$(hostname -I 2>/dev/null | awk '{print $1}'):${HTTP_PORT:-80}/h5/"
echo "   后台:   http://$(hostname -I 2>/dev/null | awk '{print $1}'):${HTTP_PORT:-80}/admin/"
echo "   API:    http://$(hostname -I 2>/dev/null | awk '{print $1}'):${HTTP_PORT:-80}/api/"

if [ "${RUN_IMAGE_PRUNE:-true}" = "true" ] && [ -x "$CLEANUP_SCRIPT" ]; then
  sh "$CLEANUP_SCRIPT" || true
fi
