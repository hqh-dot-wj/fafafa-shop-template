-- P1-06: single play dispatch definition table.
-- Runtime definitions are maintained by Prisma migration/seed, not admin writes.

CREATE TABLE IF NOT EXISTS "play_definition" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "has_instance" BOOLEAN NOT NULL DEFAULT false,
  "has_state" BOOLEAN NOT NULL DEFAULT false,
  "can_fail" BOOLEAN NOT NULL DEFAULT false,
  "can_parallel" BOOLEAN NOT NULL DEFAULT true,
  "default_stock_mode" "MarketingStockMode" NOT NULL DEFAULT 'LAZY_CHECK',
  "handler_class_name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "play_definition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "play_definition_code_key" ON "play_definition"("code");
CREATE INDEX IF NOT EXISTS "play_definition_is_active_idx" ON "play_definition"("is_active");
