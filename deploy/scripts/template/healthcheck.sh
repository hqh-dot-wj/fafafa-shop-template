#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 5：healthcheck
# =============================================================================
# 远端轮询所有容器健康状态，超时则报失败。
# 默认最长等待 5 分钟。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

callback_step health_check running '开始等待容器健康'

require_var SERVER_IP DEPLOY_USERS DEPLOY_PORTS PROJECT_NAMES

SSH_TARGET="${DEPLOY_USERS}@${SERVER_IP}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 -p "$DEPLOY_PORTS")

MAX_WAIT=${HEALTHCHECK_MAX_WAIT_SECONDS:-300}
INTERVAL=5

services=(api admin c-web landing web redis)
all_healthy=false
elapsed=0

while [ "$elapsed" -lt "$MAX_WAIT" ]; do
  all_ok=true
  failing=""
  for svc in "${services[@]}"; do
    container_name="${PROJECT_NAMES}-${svc}-prod"
    status=$(ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
      "docker inspect --format='{{.State.Health.Status}}' '${container_name}' 2>/dev/null || echo 'missing'")
    if [ "$status" != 'healthy' ]; then
      all_ok=false
      failing+="${svc}=${status} "
    fi
  done

  if [ "$all_ok" = 'true' ]; then
    all_healthy=true
    break
  fi

  log "等待容器健康... ${elapsed}/${MAX_WAIT}s [${failing}]"
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

if [ "$all_healthy" != 'true' ]; then
  # 拉一段日志便于排查
  log_err "健康检查超时（${MAX_WAIT}s）"
  for svc in api admin c-web landing web; do
    log_warn "===== ${svc} 最近日志 ====="
    ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "docker logs --tail=60 '${PROJECT_NAMES}-${svc}-prod' 2>&1 || true"
  done
  die_step health_check "容器健康检查超时（${MAX_WAIT}s）"
fi

log "全部容器健康：${services[*]}"
callback_step health_check success "全部 ${#services[@]} 个容器健康"
