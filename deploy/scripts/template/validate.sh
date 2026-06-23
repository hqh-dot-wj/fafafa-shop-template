#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 1：validate
# =============================================================================
# 校验 fafafa 注入的必需变量、镜像与目标主机连通性。
# 失败立刻 callback failed 并退出，避免后续步骤继续白跑。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

callback_step validate running '开始校验部署变量'

require_var \
  JOB_NO \
  INSTANCE_ID \
  ORDER_NO \
  TEMPLATE_ID \
  PROJECT_NAMES \
  DOMAIN \
  SERVER_IP \
  REGION \
  DEPLOY_HOSTS \
  DEPLOY_USERS \
  DEPLOY_PATHS \
  DEPLOY_PORTS \
  EXTERNAL_NETWORK_NAME \
  CALLBACK_URL \
  CALLBACK_TOKEN \
  DB_HOST \
  DB_NAME \
  DB_USER \
  DB_CREDENTIAL_REF \
  REGISTRY_NAMESPACE \
  IMAGE_TAG \
  TEMPLATE_BRAND_COMPANY_NAME \
  TEMPLATE_ADMIN_USERNAME \
  TEMPLATE_ADMIN_PASSWORD \
  JWT_SECRET \
  REDIS_PASSWORD \
  || die_step validate '必需环境变量缺失，无法部署'

# 域名格式宽松校验（fafafa 已校验过，但本地再做一道，防止意外）
if ! printf '%s' "$DOMAIN" | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$'; then
  die_step validate "DOMAIN 格式非法: $DOMAIN"
fi

# PROJECT_NAMES：fafafa buildOrderDeploySlug 已规范化为 [a-z0-9-]{1,63}
if ! printf '%s' "$PROJECT_NAMES" | grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$'; then
  die_step validate "PROJECT_NAMES 格式非法: $PROJECT_NAMES"
fi

# SSH 端口与用户基本格式
if ! printf '%s' "$DEPLOY_PORTS" | grep -Eq '^[0-9]{1,5}$'; then
  die_step validate "DEPLOY_PORTS 必须是端口号: $DEPLOY_PORTS"
fi

# 检查必要工具是否在 CI runner 上可用
for cmd in curl ssh docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    die_step validate "CI runner 缺少命令: $cmd"
  fi
done

log "变量校验通过 project=${PROJECT_NAMES} domain=${DOMAIN} server=${SERVER_IP}"
callback_step validate success '部署变量校验通过'
