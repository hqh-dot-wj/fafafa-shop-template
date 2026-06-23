#!/bin/sh
# 清理悬空镜像，释放磁盘（不删除数据卷）

set -e

echo "🧹 Docker 磁盘清理"
docker system df 2>/dev/null || true
echo "清理前镜像数: $(docker images -q 2>/dev/null | wc -l)"

docker image prune -f || true
docker container prune -f || true
docker network prune -f || true

echo "清理后镜像数: $(docker images -q 2>/dev/null | wc -l)"
docker system df 2>/dev/null || true
echo "✅ 完成（未执行 volume prune，数据库卷保留）"
