#!/usr/bin/env bash
# =============================================================================
# fafafa.app 模板部署 - 步骤 6：callback（终态）
# =============================================================================
# 健康检查通过后：
#   1) 调 /api/web/provisioning/deploy-result 把容器/端口/镜像 tag 落到平台
#      ContainerInstance 台账（C1，触发 task-nginx 自动反代）
#   2) 调 /api/web/provisioning/callback 标记 complete 步骤 success
# =============================================================================

set -euo pipefail
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/common.sh"

require_var JOB_NO PROJECT_NAMES SERVER_IP CALLBACK_URL CALLBACK_TOKEN

log '回写部署结果（C1 + complete）'

# 1) C1 deploy-result（容器台账落库 → nginx 自动下发的数据前提）
report_deploy_result success "部署完成 domain=${DOMAIN} project=${PROJECT_NAMES}"

# 2) 最终 complete callback（让 Provisioning Job 终态变为 success → WebsiteService=active）
callback_step complete success "实例已部署完成：https://${DOMAIN}/"

log '全部回写完成。fafafa 端将自动触发 task-nginx 反代下发。'
