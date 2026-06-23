# Nest-Admin-Soybean backend
# 构建：docker build -f deploy/docker/backend.Dockerfile .（上下文为仓库根目录）

FROM node:20-bookworm-slim AS builder

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.json ./
COPY apps/backend/package.json apps/backend/
COPY libs/common-utils/package.json libs/common-utils/
COPY libs/common-constants/package.json libs/common-constants/

RUN pnpm install --frozen-lockfile \
  --filter @apps/backend... \
  --filter @libs/common-utils... \
  --filter @libs/common-constants...

COPY libs/common-utils libs/common-utils
COPY libs/common-constants libs/common-constants
COPY apps/backend apps/backend

# 静态资源目录（apply-app-bootstrap 挂载 /public/）；仓库可能仅有 .gitkeep
RUN mkdir -p apps/backend/public

RUN pnpm --filter @libs/common-utils build \
  && pnpm --filter @libs/common-constants build \
  && pnpm --filter @apps/backend prisma:generate \
  && pnpm --filter @apps/backend build:prod

# -----------------------------------------------------------------------------

FROM node:20-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.5.0 --activate

WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/backend/package.json apps/backend/
COPY libs/common-utils/package.json libs/common-utils/
COPY libs/common-constants/package.json libs/common-constants/

COPY --from=builder /app/libs/common-utils/dist libs/common-utils/dist
COPY --from=builder /app/libs/common-constants/dist libs/common-constants/dist
COPY --from=builder /app/apps/backend/dist apps/backend/dist
COPY --from=builder /app/apps/backend/src apps/backend/src
COPY --from=builder /app/apps/backend/prisma apps/backend/prisma
COPY --from=builder /app/apps/backend/public apps/backend/public
COPY --from=builder /app/apps/backend/tsconfig.json apps/backend/tsconfig.json
COPY --from=builder /app/tsconfig.base.json tsconfig.base.json

# 复用 builder 已安装依赖（含 prisma generate 产物），避免 runner 再跑 prepare / prisma install
COPY --from=builder /app/node_modules ./node_modules

ENV PATH="/app/node_modules/.bin:${PATH}"

WORKDIR /app/apps/backend

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -q -O- "http://127.0.0.1:${APP_PORT:-8080}/api/health" || exit 1

CMD ["node", "dist/main.js"]
