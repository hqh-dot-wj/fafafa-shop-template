#!/usr/bin/env bash
# 手动发布第 2 步：在 ECS 上执行（本机已 docker push 之后）
# 用法：
#   export IMAGE_TAG=manual-20260524-1530
#   export REGISTRY_NAMESPACE=ghcr.io/hqh-dot-wj/o2o-mall-project
#   export REGISTRY_USER=你的GitHub用户名
#   export REGISTRY_PASSWORD=ghp_xxx   # PAT: read:packages + write:packages
#   # 首次全量对齐库（会清库）：
#   export RUN_MIGRATE=false RUN_DB_RESET=true RUN_HUNAN_SEED=true
#   # 日常增量：
#   # export RUN_MIGRATE=true RUN_DB_RESET=false RUN_HUNAN_SEED=false
#   sh /opt/nest-admin/scripts/manual-server-deploy.sh

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/nest-admin}"
cd "$DEPLOY_DIR"

if [ ! -f scripts/remote_deploy.sh ]; then
  echo "缺少 $DEPLOY_DIR/scripts/remote_deploy.sh，请先从本机 scp deploy/scripts/*"
  exit 1
fi

chmod +x scripts/remote_deploy.sh scripts/cleanup-images.sh 2>/dev/null || true

export CI_REGISTRY="${CI_REGISTRY:-ghcr.io}"
export RUN_IMAGE_PRUNE="${RUN_IMAGE_PRUNE:-true}"
export RUN_MIGRATE="${RUN_MIGRATE:-true}"
export RUN_DB_RESET="${RUN_DB_RESET:-false}"
export RUN_HUNAN_SEED="${RUN_HUNAN_SEED:-false}"
export RUN_H5_SUPPLEMENT="${RUN_H5_SUPPLEMENT:-false}"
export RUN_BOOTSTRAP="${RUN_BOOTSTRAP:-false}"
export RUN_SEED="${RUN_SEED:-false}"
export HTTP_PORT="${HTTP_PORT:-80}"

: "${IMAGE_TAG:?请设置 IMAGE_TAG（与 manual-build-push.ps1 输出一致）}"
: "${REGISTRY_NAMESPACE:?请设置 REGISTRY_NAMESPACE}"

sh scripts/remote_deploy.sh prod
