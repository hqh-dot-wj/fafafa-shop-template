# miniapp-client H5（子路径 /h5/，API 同源 /api）
# 构建：docker build -f deploy/docker/h5.Dockerfile .（上下文为仓库根目录）

FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/miniapp-client/package.json apps/miniapp-client/
COPY libs/common-utils/package.json libs/common-utils/
COPY libs/common-constants/package.json libs/common-constants/
COPY libs/common-types/package.json libs/common-types/

RUN pnpm install --frozen-lockfile

COPY libs libs
COPY apps/backend apps/backend
COPY apps/miniapp-client apps/miniapp-client

RUN pnpm install --frozen-lockfile --filter @apps/miniapp-client...

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

COPY apps/miniapp-client/.env.production apps/miniapp-client/.env.production

ARG VITE_SERVER_BASEURL=/api
ARG VITE_APP_PUBLIC_BASE=/h5/

ENV UNI_PLATFORM=h5 \
    VITE_SERVER_BASEURL=$VITE_SERVER_BASEURL \
    VITE_APP_PUBLIC_BASE=$VITE_APP_PUBLIC_BASE

RUN pnpm --filter @apps/miniapp-client init-baseFiles \
  && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @apps/miniapp-client build:h5:prod

# uni-app H5 默认输出目录（若升级 CLI 后路径变化，改此处 COPY）
RUN test -d apps/miniapp-client/dist/build/h5

# -----------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

COPY deploy/nginx/h5.conf /etc/nginx/conf.d/default.conf
# 构建 base=/h5/：产物在 dist/build/h5 根目录，须挂到 html/h5/ 才能匹配 h5.conf 的 /h5/index.html
COPY --from=builder /app/apps/miniapp-client/dist/build/h5 /usr/share/nginx/html/h5

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/h5/ || exit 1
