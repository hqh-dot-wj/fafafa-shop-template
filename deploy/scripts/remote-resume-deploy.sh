#!/usr/bin/env bash
# 断点续部署：漂移列 + 湖南种子 + 滚动更新（migrate reset 已完成时）
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/nest-admin}"
cd "$DEPLOY_DIR"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

set -a
# shellcheck disable=SC1091
. ./.env
set +a

export IMAGE_TAG="${IMAGE_TAG:-manual-20260524-0934}"
export REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-ghcr.io/hqh-dot-wj/o2o-mall-project}"

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

api_sh() {
  compose run --rm --no-deps api \
    sh -c "export PATH=/app/node_modules/.bin:\$PATH; cd /app/apps/backend && $*"
}

echo "🗄️  补齐 partial_refund_sn（兼容旧版 PG，不走 ADD CONSTRAINT IF NOT EXISTS）..."
compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-nest-admin-soybean}" -v ON_ERROR_STOP=1 -c \
  "ALTER TABLE oms_order ADD COLUMN IF NOT EXISTS partial_refund_sn VARCHAR(100) NULL;"

echo "🌱 湖南完整演示种子..."
api_sh '/app/node_modules/.bin/ts-node -r tsconfig-paths/register --transpile-only prisma/seeds/run-bootstrap-then-hunan-overrides.ts'

echo "🧹 Redis FLUSHDB..."
compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n "${REDIS_DB:-2}" FLUSHDB || true

echo "🔄 滚动更新服务..."
compose up -d --no-deps --force-recreate api

MAX_WAIT=120
WAIT_COUNT=0
while [ "$WAIT_COUNT" -lt "$MAX_WAIT" ]; do
  HEALTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' nest-admin-api-prod 2>/dev/null || echo "starting")
  if [ "$HEALTH_STATUS" = "healthy" ]; then
    break
  fi
  echo "⏳ API ($WAIT_COUNT/${MAX_WAIT}s) [$HEALTH_STATUS]"
  sleep 5
  WAIT_COUNT=$((WAIT_COUNT + 5))
done

compose up -d --force-recreate landing h5 admin gateway
sleep 5
compose ps

echo "✅ 续部署完成 IMAGE_TAG=$IMAGE_TAG"
