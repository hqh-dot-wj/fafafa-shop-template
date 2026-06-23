# 宣传页（纯静态）
# 构建：docker build -f deploy/docker/landing.Dockerfile .（上下文为仓库根目录）

FROM nginx:1.27-alpine AS runner

COPY deploy/nginx/landing.conf /etc/nginx/conf.d/default.conf
COPY deploy/sites/landing /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/ || exit 1
