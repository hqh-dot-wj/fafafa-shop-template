#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 4：deploy
# =============================================================================
# 在远端生成 .env、拉所有镜像、docker compose up -d 启动全栈。
# 不做健康检查（那是 healthcheck.sh 的事）。
# DB 密码再次通过 credentials/exchange 换取并仅写入远端 .env（root only 权限）。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

callback_step deploy running '生成 .env 并启动容器'

require_var SERVER_IP DEPLOY_USERS DEPLOY_PATHS DEPLOY_PORTS \
            PROJECT_NAMES EXTERNAL_NETWORK_NAME \
            DOMAIN DB_HOST DB_NAME DB_USER DB_CREDENTIAL_REF DB_PORT \
            REGISTRY_NAMESPACE IMAGE_TAG \
            JWT_SECRET REDIS_PASSWORD \
            TEMPLATE_BRAND_COMPANY_NAME TEMPLATE_ADMIN_USERNAME TEMPLATE_ADMIN_PASSWORD

SSH_TARGET="${DEPLOY_USERS}@${SERVER_IP}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$DEPLOY_PORTS")

# ---------------------------------------------------------------------------
# 1) 换 DB 密码（migrate 时换过一次，deploy 再换一次：避免依赖 migrate.sh 在同一 CI job）
# ---------------------------------------------------------------------------
log '通过 credentials/exchange 换取 DB 密码'
DB_PASSWORD=$("$SCRIPT_DIR/exchange-credential.sh") \
  || die_step deploy '换取 DB 密码失败'

# ---------------------------------------------------------------------------
# 2) 生成远端 .env（root 写入，0600 权限）
# ---------------------------------------------------------------------------
log "在远端写入 ${DEPLOY_PATHS}/.env（含敏感数据，0600 权限）"

# Heredoc 直接 ssh 注入；shell 变量在本地展开，不写到 stdout 日志
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "umask 077 && cat > '${DEPLOY_PATHS}/.env'" <<EOF
# 由 fafafa GitLab Pipeline 在 deploy 阶段写入，不要手工编辑
PROJECT_NAMES=${PROJECT_NAMES}
EXTERNAL_NETWORK_NAME=${EXTERNAL_NETWORK_NAME}
REGISTRY_NAMESPACE=${REGISTRY_NAMESPACE}
IMAGE_TAG=${IMAGE_TAG}

DOMAIN=${DOMAIN}

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_DB=${REDIS_DB:-2}

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-2h}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN:-7d}

CRYPTO_ENABLED=${CRYPTO_ENABLED:-true}
CRYPTO_RSA_PUBLIC_KEY=${CRYPTO_RSA_PUBLIC_KEY:-}
CRYPTO_RSA_PRIVATE_KEY=${CRYPTO_RSA_PRIVATE_KEY:-}

FILE_IS_LOCAL=${FILE_IS_LOCAL:-true}

MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY=${MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY:-fallback-please-override}

TEMPLATE_BRAND_COMPANY_NAME=${TEMPLATE_BRAND_COMPANY_NAME}
TEMPLATE_BRAND_LOGO_URL=${TEMPLATE_BRAND_LOGO_URL:-}
TEMPLATE_BRAND_CONTACT_PHONE=${TEMPLATE_BRAND_CONTACT_PHONE:-}
TEMPLATE_ADMIN_USERNAME=${TEMPLATE_ADMIN_USERNAME}
TEMPLATE_ADMIN_PASSWORD=${TEMPLATE_ADMIN_PASSWORD}
EOF

if [ $? -ne 0 ]; then
  die_step deploy "无法写入远端 ${DEPLOY_PATHS}/.env"
fi

# ---------------------------------------------------------------------------
# 3) 远端 docker compose pull + up -d
# ---------------------------------------------------------------------------
log '远端 docker compose pull（拉取所有服务镜像）'
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "cd '${DEPLOY_PATHS}' && docker compose --env-file .env pull api admin c-web landing" \
  || die_step deploy 'docker compose pull 失败'

log '远端 docker compose up -d（启动全栈）'
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "cd '${DEPLOY_PATHS}' && docker compose --env-file .env up -d" \
  || die_step deploy 'docker compose up 失败'

log "deploy 完成：${PROJECT_NAMES} on ${SERVER_IP}:${DEPLOY_PATHS}"
callback_step deploy success "容器已启动（${PROJECT_NAMES}）"
