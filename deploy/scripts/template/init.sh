#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 2：init
# =============================================================================
# 在 SERVER_IP 上准备部署目录、同步配置（compose 模板 + nginx 配置 + scripts）、
# 创建 shared_net（若不存在）、登录镜像仓库。
# 不做 docker compose up，那是 deploy.sh 的事。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

callback_step init running '准备部署目录与配置'

require_var SERVER_IP DEPLOY_USERS DEPLOY_PATHS DEPLOY_PORTS PROJECT_NAMES EXTERNAL_NETWORK_NAME

SSH_TARGET="${DEPLOY_USERS}@${SERVER_IP}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$DEPLOY_PORTS")

# ---------------------------------------------------------------------------
# 1) 在远端创建部署目录骨架
# ---------------------------------------------------------------------------
log "在 ${SSH_TARGET}:${DEPLOY_PATHS} 创建部署目录骨架"
if ! ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p '${DEPLOY_PATHS}/nginx' '${DEPLOY_PATHS}/scripts/template/lib'"; then
  die_step init "无法在 ${SSH_TARGET} 创建部署目录"
fi

# ---------------------------------------------------------------------------
# 2) scp 同步：compose 模板 + nginx 配置 + 部署脚本 + 远端 healthcheck/callback
# ---------------------------------------------------------------------------
SCP_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -P "$DEPLOY_PORTS")

# 仓库根（CI runner 的 $CI_PROJECT_DIR）
REPO_ROOT=${CI_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}

log "同步 docker-compose.tpl.yml / nginx / template scripts"
scp "${SCP_OPTS[@]}" "$REPO_ROOT/deploy/docker-compose.tpl.yml" "$SSH_TARGET:${DEPLOY_PATHS}/docker-compose.yml" \
  || die_step init '同步 docker-compose.tpl.yml 失败'
scp "${SCP_OPTS[@]}" -r "$REPO_ROOT/deploy/nginx/." "$SSH_TARGET:${DEPLOY_PATHS}/nginx/" \
  || die_step init '同步 nginx 配置失败'
scp "${SCP_OPTS[@]}" -r "$REPO_ROOT/deploy/scripts/template/." "$SSH_TARGET:${DEPLOY_PATHS}/scripts/template/" \
  || die_step init '同步 template scripts 失败'

# ---------------------------------------------------------------------------
# 3) 远端确保 shared_net 网络存在（external network，多实例共用）
# ---------------------------------------------------------------------------
log "确保 docker network ${EXTERNAL_NETWORK_NAME} 存在"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "docker network inspect '${EXTERNAL_NETWORK_NAME}' >/dev/null 2>&1 || docker network create '${EXTERNAL_NETWORK_NAME}' --driver bridge" \
  || die_step init "无法创建/检查 docker network ${EXTERNAL_NETWORK_NAME}"

# 检查网络是否为非 internal（fafafa docker-compose.yml 注释强调过）
internal=$(ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "docker network inspect '${EXTERNAL_NETWORK_NAME}' --format='{{.Internal}}'" 2>/dev/null || echo 'unknown')
if [ "$internal" = 'true' ]; then
  die_step init "docker network ${EXTERNAL_NETWORK_NAME} 是 internal，必须重建为非 internal：docker network rm ${EXTERNAL_NETWORK_NAME} && docker network create ${EXTERNAL_NETWORK_NAME} --driver bridge"
fi

# ---------------------------------------------------------------------------
# 4) 远端登录镜像仓库（如果 ci.env 有提供 REGISTRY_USER / REGISTRY_PASSWORD）
# ---------------------------------------------------------------------------
if [ -n "${REGISTRY_USER:-}" ] && [ -n "${REGISTRY_PASSWORD:-}" ]; then
  log "远端登录镜像仓库 ${CI_REGISTRY:-ghcr.io}"
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "echo '${REGISTRY_PASSWORD}' | docker login -u '${REGISTRY_USER}' --password-stdin '${CI_REGISTRY:-ghcr.io}'" \
    || log_warn '远端 docker login 失败（若用公开镜像可忽略）'
fi

log "init 完成：${SSH_TARGET}:${DEPLOY_PATHS}"
callback_step init success "部署目录已准备：${DEPLOY_PATHS}"
