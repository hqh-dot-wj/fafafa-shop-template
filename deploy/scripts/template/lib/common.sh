#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 公共工具库
# =============================================================================
# 所有 deploy/scripts/template/*.sh 都 source 本文件。提供：
#   - 日志格式
#   - 必备变量校验（fail-fast）
#   - fafafa callback / deploy-result HTTP 调用封装
#   - JSON 转义工具（避免 message 含双引号破坏 payload）
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# 日志
# ---------------------------------------------------------------------------
log()      { printf '[%(%Y-%m-%dT%H:%M:%S%z)T] [INFO ] %s\n' -1 "$*"; }
log_warn() { printf '[%(%Y-%m-%dT%H:%M:%S%z)T] [WARN ] %s\n' -1 "$*" >&2; }
log_err()  { printf '[%(%Y-%m-%dT%H:%M:%S%z)T] [ERROR] %s\n' -1 "$*" >&2; }

# ---------------------------------------------------------------------------
# 必需变量校验：require_var VAR_NAME [VAR_NAME ...]
# ---------------------------------------------------------------------------
require_var() {
  local missing=()
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      missing+=("$var")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    log_err "缺少必需环境变量: ${missing[*]}"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# JSON 字符串转义（防止 message 含 " 或 \ 破坏 callback payload）
# 仅处理基本 JSON 安全转义；不处理控制字符（fafafa 上限 2000 字符）
# ---------------------------------------------------------------------------
json_escape() {
  local s=${1:-}
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/\\r}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

# ---------------------------------------------------------------------------
# fafafa 流水线步骤状态回调
#   callback_step <stepCode> <status: pending|running|success|failed> [message]
# 失败时仅 warn，不阻塞主流程（callback 本身故障不应让部署回退）
# ---------------------------------------------------------------------------
callback_step() {
  local step_code=${1:?step_code required}
  local status=${2:?status required}
  local message=${3:-}

  require_var CALLBACK_URL CALLBACK_TOKEN JOB_NO || return 0

  local msg_escaped
  msg_escaped=$(json_escape "$message")
  local payload
  printf -v payload '{"jobNo":"%s","stepCode":"%s","status":"%s","message":"%s"}' \
    "$JOB_NO" "$step_code" "$status" "$msg_escaped"

  log "callback step=${step_code} status=${status}"
  local http_code
  http_code=$(curl -sS -o /tmp/callback-resp.$$ -w '%{http_code}' \
    --max-time 15 --retry 2 --retry-delay 3 \
    -X POST "$CALLBACK_URL" \
    -H "Authorization: Bearer $CALLBACK_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$payload" 2>/dev/null || echo '000')
  if [ "$http_code" != '200' ] && [ "$http_code" != '204' ]; then
    log_warn "callback ${step_code} HTTP ${http_code}: $(cat /tmp/callback-resp.$$ 2>/dev/null || true)"
  fi
  rm -f /tmp/callback-resp.$$
}

# ---------------------------------------------------------------------------
# fafafa C1 部署回写（容器/端口/镜像 tag 落 ContainerInstance 台账，触发 nginx 自动下发）
#   report_deploy_result <result: success|failed> [message]
# 期望调用方已 export：
#   PROJECT_NAMES（决定容器名）
#   IMAGE_TAG（用于回写 imageTag）
#   SERVER_IP（host 字段）
# ---------------------------------------------------------------------------
report_deploy_result() {
  local result=${1:?result required: success|failed}
  local message=${2:-}

  require_var CALLBACK_URL CALLBACK_TOKEN JOB_NO PROJECT_NAMES || return 0

  # 端点是 /api/web/provisioning/deploy-result，从 CALLBACK_URL 推断 base
  # CALLBACK_URL 形如 https://fafafa.example.com/api/web/provisioning/callback
  local deploy_result_url=${CALLBACK_URL%/callback}/deploy-result

  local msg_escaped
  msg_escaped=$(json_escape "$message")
  local image_tag=${IMAGE_TAG:-latest}
  local server_ip=${SERVER_IP:-}

  # 容器命名约定（与 docker-compose.tpl.yml 一致）
  # web 是对外入口（task-nginx 直接 upstream 到这里）；其余容器 ports 信息也回写，方便排查
  local payload
  printf -v payload '{"jobNo":"%s","result":"%s","imageTag":"%s","containerNames":["%s-web-prod","%s-api-prod","%s-admin-prod","%s-c-web-prod","%s-landing-prod","%s-redis-prod"],"ports":{"web":80,"api":8080,"admin":80,"c-web":80,"landing":80,"redis":6379},"host":"%s","message":"%s"}' \
    "$JOB_NO" "$result" "$image_tag" \
    "$PROJECT_NAMES" "$PROJECT_NAMES" "$PROJECT_NAMES" "$PROJECT_NAMES" "$PROJECT_NAMES" "$PROJECT_NAMES" \
    "$server_ip" "$msg_escaped"

  log "deploy-result result=${result} project=${PROJECT_NAMES}"
  local http_code
  http_code=$(curl -sS -o /tmp/deploy-resp.$$ -w '%{http_code}' \
    --max-time 30 --retry 2 --retry-delay 3 \
    -X POST "$deploy_result_url" \
    -H "Authorization: Bearer $CALLBACK_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "$payload" 2>/dev/null || echo '000')
  if [ "$http_code" != '200' ] && [ "$http_code" != '204' ]; then
    log_warn "deploy-result HTTP ${http_code}: $(cat /tmp/deploy-resp.$$ 2>/dev/null || true)"
  fi
  rm -f /tmp/deploy-resp.$$
}

# ---------------------------------------------------------------------------
# 致命错误：报告失败后退出（用于 step 内部）
#   die_step <stepCode> <message> [exit_code]
# ---------------------------------------------------------------------------
die_step() {
  local step_code=${1:?step_code required}
  local message=${2:?message required}
  local code=${3:-1}
  log_err "$message"
  callback_step "$step_code" 'failed' "$message"
  exit "$code"
}

# ---------------------------------------------------------------------------
# 切到部署目录（${DEPLOY_PATHS} 由 fafafa 注入，形如 /opt/<slug>）
# ---------------------------------------------------------------------------
cd_deploy_path() {
  require_var DEPLOY_PATHS
  if [ ! -d "$DEPLOY_PATHS" ]; then
    log_err "DEPLOY_PATHS 目录不存在: $DEPLOY_PATHS"
    return 1
  fi
  cd "$DEPLOY_PATHS"
}
