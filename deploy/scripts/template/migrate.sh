#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 3：migrate
# =============================================================================
# 在远端拉取 backend 镜像、用一次性容器跑 prisma migrate deploy + seed pipeline
# （含品牌覆写）。本步骤完成后，DB 结构与初始数据均就绪，但服务尚未起。
#
# DB 密码经 credentials/exchange 实时换取，仅在远端 docker run 进程内传递；
# 不写入 .env 文件，不在日志中明文出现。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

callback_step migrate running '执行 Prisma migration 与 seed'

require_var SERVER_IP DEPLOY_USERS DEPLOY_PATHS DEPLOY_PORTS \
            DB_HOST DB_NAME DB_USER DB_CREDENTIAL_REF \
            REGISTRY_NAMESPACE IMAGE_TAG \
            TEMPLATE_BRAND_COMPANY_NAME TEMPLATE_ADMIN_USERNAME TEMPLATE_ADMIN_PASSWORD

SSH_TARGET="${DEPLOY_USERS}@${SERVER_IP}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$DEPLOY_PORTS")

# ---------------------------------------------------------------------------
# 1) 换 DB 密码（CI runner 本地换，避免远端再 curl fafafa）
# ---------------------------------------------------------------------------
log '通过 credentials/exchange 换取 DB 密码'
DB_PASSWORD=$("$SCRIPT_DIR/exchange-credential.sh") \
  || die_step migrate '换取 DB 密码失败'

if [ -z "$DB_PASSWORD" ]; then
  die_step migrate 'DB_PASSWORD 为空'
fi

# ---------------------------------------------------------------------------
# 2) 远端拉取 backend 镜像
# ---------------------------------------------------------------------------
BACKEND_IMAGE="${REGISTRY_NAMESPACE}/backend:${IMAGE_TAG}"
log "远端拉取镜像 ${BACKEND_IMAGE}"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "docker pull '${BACKEND_IMAGE}'" \
  || die_step migrate "远端拉取镜像失败: ${BACKEND_IMAGE}"

# ---------------------------------------------------------------------------
# 3) 一次性容器跑 prisma migrate deploy
# ---------------------------------------------------------------------------
DB_PORT_VAL=${DB_PORT:-5432}
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT_VAL}/${DB_NAME}?schema=public"

log "执行 prisma migrate deploy（外部 DB ${DB_HOST}:${DB_PORT_VAL}/${DB_NAME}）"
# DATABASE_URL 通过 stdin 注入，避免出现在 ps / shell history
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
  "DATABASE_URL='${DATABASE_URL}' docker run --rm -e DATABASE_URL '${BACKEND_IMAGE}' /app/node_modules/.bin/prisma migrate deploy --schema prisma" \
  || die_step migrate 'prisma migrate deploy 失败'

# ---------------------------------------------------------------------------
# 4) 一次性容器跑 seed pipeline（含 apply-template-branding，覆写品牌/管理员）
# ---------------------------------------------------------------------------
log '执行 seed pipeline 与品牌覆写'
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "DATABASE_URL='${DATABASE_URL}' \
  TEMPLATE_BRAND_COMPANY_NAME='${TEMPLATE_BRAND_COMPANY_NAME}' \
  TEMPLATE_BRAND_LOGO_URL='${TEMPLATE_BRAND_LOGO_URL:-}' \
  TEMPLATE_BRAND_CONTACT_PHONE='${TEMPLATE_BRAND_CONTACT_PHONE:-}' \
  TEMPLATE_BRAND_DOMAIN='${DOMAIN}' \
  TEMPLATE_ADMIN_USERNAME='${TEMPLATE_ADMIN_USERNAME}' \
  TEMPLATE_ADMIN_PASSWORD='${TEMPLATE_ADMIN_PASSWORD}' \
  docker run --rm \
    -e DATABASE_URL \
    -e TEMPLATE_BRAND_COMPANY_NAME -e TEMPLATE_BRAND_LOGO_URL \
    -e TEMPLATE_BRAND_CONTACT_PHONE -e TEMPLATE_BRAND_DOMAIN \
    -e TEMPLATE_ADMIN_USERNAME -e TEMPLATE_ADMIN_PASSWORD \
    '${BACKEND_IMAGE}' \
    /app/node_modules/.bin/ts-node --transpile-only --project prisma/tsconfig.seed.json prisma/seeds/run-prod-bootstrap.ts" \
  || die_step migrate 'seed pipeline 失败'

log 'migrate + seed 完成'
callback_step migrate success 'Prisma migration 与 seed 已应用，含品牌覆写'
