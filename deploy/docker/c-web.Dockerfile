# c-web（Vite 7 SPA，子路径 /shop/）
# 构建：docker build -f deploy/docker/c-web.Dockerfile .（上下文为仓库根目录）

FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/c-web/package.json apps/c-web/
COPY libs/common-utils/package.json libs/common-utils/
COPY libs/common-constants/package.json libs/common-constants/
COPY libs/common-types/package.json libs/common-types/

RUN pnpm install --frozen-lockfile

COPY libs libs
COPY apps/backend apps/backend
COPY apps/c-web apps/c-web

RUN pnpm install --frozen-lockfile --filter @apps/c-web...

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

COPY apps/c-web/.env.production apps/c-web/.env.production

ARG VITE_BASE_URL=/shop/
ARG VITE_API_BASE=/api
ARG VITE_TENANT_ID=000000
ARG VITE_FEATURE_O2O=false
ARG VITE_FEATURE_DISTRIBUTION=false
ARG VITE_FEATURE_LBS=false
ARG VITE_FEATURE_WALLET=false
ARG VITE_FEATURE_FINANCE_SETTLEMENT=false

ENV VITE_BASE_URL=$VITE_BASE_URL \
    VITE_API_BASE=$VITE_API_BASE \
    VITE_TENANT_ID=$VITE_TENANT_ID \
    VITE_FEATURE_O2O=$VITE_FEATURE_O2O \
    VITE_FEATURE_DISTRIBUTION=$VITE_FEATURE_DISTRIBUTION \
    VITE_FEATURE_LBS=$VITE_FEATURE_LBS \
    VITE_FEATURE_WALLET=$VITE_FEATURE_WALLET \
    VITE_FEATURE_FINANCE_SETTLEMENT=$VITE_FEATURE_FINANCE_SETTLEMENT

RUN pnpm --filter @apps/c-web build

RUN test -d apps/c-web/dist

# -----------------------------------------------------------------------------

FROM nginx:1.27-alpine AS runner

COPY deploy/nginx/c-web.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/c-web/dist /usr/share/nginx/html/shop

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1/shop/ || exit 1
