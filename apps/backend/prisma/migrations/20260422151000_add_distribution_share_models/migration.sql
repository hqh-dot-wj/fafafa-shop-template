DO $$
BEGIN
  CREATE TYPE "DistShareBizType" AS ENUM ('PRODUCT', 'ACTIVITY', 'PAGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistShareBindingMode" AS ENUM ('RECOMMEND_CODE', 'RELATION', 'BOTH');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistShareAttributionMode" AS ENUM ('FIRST_TOUCH', 'LAST_TOUCH', 'FIRST_BIND_LOCK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistShareTokenStatus" AS ENUM ('ACTIVE', 'DISABLED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistShareEventType" AS ENUM ('CLICK', 'BIND', 'ORDER_ATTRIBUTED', 'EXPIRED_HIT', 'LIMIT_HIT', 'INVALID_HIT', 'MANUAL_DISABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sys_dist_share_policy" (
  "id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "link_expire_minutes" INTEGER NOT NULL DEFAULT 1440,
  "max_click_count" INTEGER NOT NULL DEFAULT 100,
  "max_bind_count" INTEGER NOT NULL DEFAULT 20,
  "max_order_count" INTEGER NOT NULL DEFAULT 20,
  "binding_mode" "DistShareBindingMode" NOT NULL DEFAULT 'BOTH',
  "attribution_mode" "DistShareAttributionMode" NOT NULL DEFAULT 'LAST_TOUCH',
  "enable_cross_tenant_bind" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "create_by" VARCHAR(64) NOT NULL DEFAULT '',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64) NOT NULL DEFAULT '',
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_share_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sys_dist_share_policy_tenant_id_key"
  ON "sys_dist_share_policy"("tenant_id");

CREATE TABLE IF NOT EXISTS "sys_dist_share_token" (
  "id" TEXT NOT NULL,
  "sid" VARCHAR(64) NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "share_user_id" VARCHAR(64) NOT NULL,
  "biz_type" "DistShareBizType" NOT NULL,
  "biz_id" VARCHAR(64) NOT NULL,
  "expire_at" TIMESTAMP(3) NOT NULL,
  "max_click_count" INTEGER NOT NULL,
  "max_bind_count" INTEGER NOT NULL,
  "max_order_count" INTEGER NOT NULL,
  "click_count" INTEGER NOT NULL DEFAULT 0,
  "bind_count" INTEGER NOT NULL DEFAULT 0,
  "order_count" INTEGER NOT NULL DEFAULT 0,
  "status" "DistShareTokenStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "create_by" VARCHAR(64) NOT NULL DEFAULT '',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64) NOT NULL DEFAULT '',
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_share_token_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sys_dist_share_token_sid_key"
  ON "sys_dist_share_token"("sid");

CREATE INDEX IF NOT EXISTS "sys_dist_share_token_tenant_id_status_idx"
  ON "sys_dist_share_token"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "sys_dist_share_token_sid_status_idx"
  ON "sys_dist_share_token"("sid", "status");

CREATE INDEX IF NOT EXISTS "sys_dist_share_token_share_user_id_create_time_idx"
  ON "sys_dist_share_token"("share_user_id", "create_time");

CREATE INDEX IF NOT EXISTS "sys_dist_share_token_expire_at_idx"
  ON "sys_dist_share_token"("expire_at");

CREATE TABLE IF NOT EXISTS "sys_dist_share_event" (
  "id" TEXT NOT NULL,
  "sid" VARCHAR(64) NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "share_user_id" VARCHAR(64),
  "member_id" VARCHAR(64),
  "event_type" "DistShareEventType" NOT NULL,
  "biz_type" "DistShareBizType",
  "biz_id" VARCHAR(64),
  "event_code" VARCHAR(64),
  "event_message" VARCHAR(255),
  "order_id" VARCHAR(64),
  "metadata" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_dist_share_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sys_dist_share_event_sid_event_type_member_id_create_time_idx"
  ON "sys_dist_share_event"("sid", "event_type", "member_id", "create_time");

CREATE INDEX IF NOT EXISTS "sys_dist_share_event_tenant_id_event_type_create_time_idx"
  ON "sys_dist_share_event"("tenant_id", "event_type", "create_time");
