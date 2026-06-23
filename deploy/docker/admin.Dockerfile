# Nest-Admin-Soybean admin-web
# 构建：docker build -f deploy/docker/admin.Dockerfile .（上下文为仓库根目录）

FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/admin-web/package.json apps/admin-web/
COPY libs/common-utils/package.json libs/common-utils/
COPY libs/common-constants/package.json libs/common-constants/
COPY libs/common-types/package.json libs/common-types/

RUN pnpm install --frozen-lockfile

COPY libs libs
COPY apps/backend apps/backend
COPY apps/admin-web apps/admin-web

# 同步 workspace 内 packages（如 @sa/utils）依赖链接
RUN pnpm install --frozen-lockfile --filter @apps/admin-web...

RUN pnpm --filter @libs/common-utils build \
  && pnpm --filter @libs/common-constants build \
  && pnpm --filter @apps/backend prisma:generate \
  && pnpm --filter @apps/backend build:prod \
  && cd apps/backend \
  && NODE_ENV=production \
     DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
     JWT_SECRET=build-openapi-only-placeholder-secret-min-32 \
     REDIS_HOST=127.0.0.1 REDIS_PASSWORD=build REDIS_DB=0 \
     OPENAPI_ONLY=true node dist/main.js \
  && cd /app \
  && pnpm --filter @libs/common-types generate-types \
  && pnpm --filter @libs/common-types build

# loadEnv(production) 依赖 .env.production；Docker 构建须纳入（见根 .dockerignore 白名单）
COPY apps/admin-web/.env.production apps/admin-web/.env.production

ARG VITE_BASE_URL=/admin/
ARG VITE_SERVICE_BASE_URL=
ARG VITE_APP_BASE_API=/api
ARG VITE_HTTP_PROXY=N

ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_SERVICE_BASE_URL=$VITE_SERVICE_BASE_URL \
    VITE_APP_BASE_API=$VITE_APP_BASE_API \
    VITE_HTTP_PROXY=$VITE_HTTP_PROXY

RUN NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @apps/admin-web build

# -----------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

COPY deploy/nginx/admin.conf /etc/nginx/conf.d/default.conf
# 构建 base=/admin/：产物在 dist 根目录，须挂到 html/admin/ 才能匹配 admin.conf 的 /admin/index.html
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html/admin

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/admin/ || exit 1
