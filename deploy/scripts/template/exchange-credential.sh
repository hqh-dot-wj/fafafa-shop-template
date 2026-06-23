#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - DB 密码换取
# =============================================================================
# 用 DB_CREDENTIAL_REF 调 fafafa /api/web/provisioning/credentials/exchange
# 拿到 DB_PASSWORD 写入 stdout（调用方通过 export 或 .env 注入），不落明文日志。
#
# 用法：
#   DB_PASSWORD=$(deploy/scripts/template/exchange-credential.sh)
# 失败：exit 非 0；调用方负责 die_step。
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

require_var CALLBACK_URL CALLBACK_TOKEN JOB_NO DB_CREDENTIAL_REF

# 端点从 CALLBACK_URL 推断
exchange_url=${CALLBACK_URL%/callback}/credentials/exchange

payload=$(printf '{"jobNo":"%s","credentialRef":"%s"}' "$JOB_NO" "$DB_CREDENTIAL_REF")

# 调用平台换密码；密码经 stdout 返回，不写入日志或临时文件
resp_file=$(mktemp)
trap 'rm -f "$resp_file"' EXIT

http_code=$(curl -sS -o "$resp_file" -w '%{http_code}' \
  --max-time 15 --retry 3 --retry-delay 2 \
  -X POST "$exchange_url" \
  -H "Authorization: Bearer $CALLBACK_TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$payload" 2>/dev/null || echo '000')

if [ "$http_code" != '200' ]; then
  log_err "credentials/exchange HTTP ${http_code}"
  # 错误响应可能不含密码，整体打印到 stderr 便于排查
  cat "$resp_file" >&2 || true
  exit 1
fi

# fafafa 响应形如 { code: 200, data: { password: "xxx" } } 或 { password: "xxx" }
# 用 node/python 都不一定可用，用 grep + sed 解析最小可用 JSON（仅 password 字段）
password=$(grep -oE '"password"[[:space:]]*:[[:space:]]*"[^"]*"' "$resp_file" | head -n1 | sed -E 's/.*"password"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')

if [ -z "$password" ]; then
  log_err "credentials/exchange 响应中未找到 password 字段"
  exit 1
fi

# 仅密码本身写 stdout（调用方捕获）
printf '%s' "$password"
