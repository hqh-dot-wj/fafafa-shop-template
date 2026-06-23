-- 补齐会员分销字段与升级申请表，保持迁移链与当前 Prisma schema 一致。
ALTER TABLE "ums_member"
  ADD COLUMN IF NOT EXISTS "parent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "indirect_parent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "referral_code" TEXT,
  ADD COLUMN IF NOT EXISTS "upgraded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "upgrade_order_id" TEXT;

UPDATE "ums_member" SET "level_id" = 0 WHERE "level_id" IS NULL;
ALTER TABLE "ums_member" ALTER COLUMN "level_id" SET DEFAULT 0;
ALTER TABLE "ums_member" ALTER COLUMN "level_id" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ums_member_referral_code_key" ON "ums_member"("referral_code");
CREATE INDEX IF NOT EXISTS "ums_member_parent_id_idx" ON "ums_member"("parent_id");
CREATE INDEX IF NOT EXISTS "ums_member_indirect_parent_id_idx" ON "ums_member"("indirect_parent_id");
CREATE INDEX IF NOT EXISTS "ums_member_tenant_id_level_id_idx" ON "ums_member"("tenant_id", "level_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ums_member_parent_id_fkey'
  ) THEN
    ALTER TABLE "ums_member"
      ADD CONSTRAINT "ums_member_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "ums_member"("member_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ums_member_indirect_parent_id_fkey'
  ) THEN
    ALTER TABLE "ums_member"
      ADD CONSTRAINT "ums_member_indirect_parent_id_fkey"
      FOREIGN KEY ("indirect_parent_id") REFERENCES "ums_member"("member_id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ums_upgrade_apply" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT NOT NULL,
  "from_level" INTEGER NOT NULL,
  "to_level" INTEGER NOT NULL,
  "apply_type" TEXT NOT NULL,
  "referral_code" TEXT,
  "order_id" TEXT,
  "referrer_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "review_by" TEXT,
  "review_time" TIMESTAMP(3),
  "review_remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ums_upgrade_apply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ums_upgrade_apply_tenant_id_member_id_idx"
  ON "ums_upgrade_apply"("tenant_id", "member_id");
CREATE INDEX IF NOT EXISTS "ums_upgrade_apply_status_idx"
  ON "ums_upgrade_apply"("status");

CREATE TABLE IF NOT EXISTS "ums_referral_code" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "qr_code_url" VARCHAR(500),
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ums_referral_code_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ums_referral_code_code_key" ON "ums_referral_code"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ums_referral_code_tenant_id_member_id_key"
  ON "ums_referral_code"("tenant_id", "member_id");
CREATE INDEX IF NOT EXISTS "ums_referral_code_code_idx" ON "ums_referral_code"("code");

CREATE TABLE IF NOT EXISTS "sys_dist_blacklist" (
  "id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "user_id" VARCHAR(20) NOT NULL,
  "reason" VARCHAR(255),
  "create_by" VARCHAR(64) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_dist_blacklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sys_dist_blacklist_tenant_id_user_id_key"
  ON "sys_dist_blacklist"("tenant_id", "user_id");

ALTER TABLE "fin_commission"
  ADD COLUMN IF NOT EXISTS "order_item_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "activity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_config_id" TEXT,
  ADD COLUMN IF NOT EXISTS "play_instance_id" TEXT,
  ADD COLUMN IF NOT EXISTS "commission_rule_source" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_commission_rate_snapshot" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "commission_pool_snapshot" DECIMAL(10, 2);
CREATE INDEX IF NOT EXISTS "fin_commission_order_item_id_idx" ON "fin_commission"("order_item_id");

CREATE TABLE IF NOT EXISTS "fin_user_daily_quota" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "beneficiary_id" TEXT NOT NULL,
  "quota_date" DATE NOT NULL,
  "used_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "limit_amount" DECIMAL(10, 2) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fin_user_daily_quota_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fin_user_daily_quota_tenant_id_beneficiary_id_quota_date_idx"
  ON "fin_user_daily_quota"("tenant_id", "beneficiary_id", "quota_date");
CREATE UNIQUE INDEX IF NOT EXISTS "fin_user_daily_quota_tenant_id_beneficiary_id_quota_date_key"
  ON "fin_user_daily_quota"("tenant_id", "beneficiary_id", "quota_date");

CREATE TABLE IF NOT EXISTS "fin_settlement_log" (
  "id" BIGSERIAL NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "settled_count" INTEGER NOT NULL,
  "failed_count" INTEGER NOT NULL,
  "total_amount" DECIMAL(12, 2) NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "error_details" TEXT,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fin_settlement_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fin_settlement_log_tenant_id_create_time_idx"
  ON "fin_settlement_log"("tenant_id", "create_time");
CREATE INDEX IF NOT EXISTS "fin_settlement_log_batch_id_idx" ON "fin_settlement_log"("batch_id");

ALTER TABLE "oms_cart_item"
  ADD COLUMN IF NOT EXISTS "activity_context_key" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_source" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_config_id" TEXT,
  ADD COLUMN IF NOT EXISTS "play_instance_id" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "display_price_snapshot" DECIMAL(10, 2);
CREATE UNIQUE INDEX IF NOT EXISTS "oms_cart_item_member_id_tenant_id_sku_id_activity_context_k_key"
  ON "oms_cart_item"("member_id", "tenant_id", "sku_id", "activity_context_key");

ALTER TABLE "oms_order"
  ADD COLUMN IF NOT EXISTS "user_coupon_id" TEXT,
  ADD COLUMN IF NOT EXISTS "coupon_discount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "points_used" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "points_discount" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "points_earned" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "idx_oms_order_member_status_ctime" ON "oms_order"("member_id", "status", "create_time");

ALTER TABLE "oms_order_item"
  ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "activity_context_key" TEXT,
  ADD COLUMN IF NOT EXISTS "entry_source" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_config_id" TEXT,
  ADD COLUMN IF NOT EXISTS "play_instance_id" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_price_snapshot" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "activity_status_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_commission_mode_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "activity_commission_rate_snapshot" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "commission_rule_source" TEXT,
  ADD COLUMN IF NOT EXISTS "commission_pool_snapshot" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "l1_weight_snapshot" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "l2_weight_snapshot" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "order_item_original_amount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "order_item_discount_allocated" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "order_item_final_paid" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "resolution_snapshot" JSONB;

ALTER TABLE "mkt_resolution_audit"
  ADD COLUMN IF NOT EXISTS "filtered_snapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "selected_activity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "selected_config_id" TEXT;
ALTER TABLE "mkt_resolution_audit" ALTER COLUMN "decision_snapshot" DROP NOT NULL;
ALTER TABLE "mkt_resolution_audit" ALTER COLUMN "final_price" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "mkt_resolution_audit_tenant_id_product_id_idx"
  ON "mkt_resolution_audit"("tenant_id", "product_id");
CREATE INDEX IF NOT EXISTS "mkt_resolution_audit_member_id_create_time_idx"
  ON "mkt_resolution_audit"("member_id", "create_time");

ALTER TABLE "sys_dist_config_log"
  ADD COLUMN IF NOT EXISTS "commission_base_type" "CommissionBaseType",
  ADD COLUMN IF NOT EXISTS "cross_max_daily" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "cross_tenant_rate" DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS "enable_cross_tenant" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "max_commission_rate" DECIMAL(5, 2);

ALTER TABLE "sys_region_agent"
  ADD COLUMN IF NOT EXISTS "tenant_id" VARCHAR(20) NOT NULL DEFAULT '000000';
CREATE UNIQUE INDEX IF NOT EXISTS "sys_region_agent_tenant_id_region_code_key"
  ON "sys_region_agent"("tenant_id", "region_code");

CREATE TABLE IF NOT EXISTS "sys_message" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(100) NOT NULL,
  "content" TEXT,
  "type" VARCHAR(50) NOT NULL,
  "receiver_id" TEXT NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "tenant_id" VARCHAR(20) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sys_message_receiver_id_idx" ON "sys_message"("receiver_id");
CREATE INDEX IF NOT EXISTS "sys_message_tenant_id_idx" ON "sys_message"("tenant_id");

CREATE TABLE IF NOT EXISTS "sys_tenant_audit_log" (
  "id" TEXT NOT NULL,
  "user_id" VARCHAR(64),
  "user_name" VARCHAR(50),
  "user_type" VARCHAR(20) NOT NULL,
  "request_tenant_id" VARCHAR(20),
  "access_tenant_id" VARCHAR(20),
  "action" VARCHAR(50) NOT NULL,
  "model_name" VARCHAR(100) NOT NULL,
  "operation" VARCHAR(20) NOT NULL,
  "is_super_tenant" BOOLEAN NOT NULL DEFAULT false,
  "is_ignore_tenant" BOOLEAN NOT NULL DEFAULT false,
  "is_cross_tenant" BOOLEAN NOT NULL DEFAULT false,
  "ip" VARCHAR(50),
  "user_agent" VARCHAR(500),
  "request_path" VARCHAR(500),
  "request_method" VARCHAR(10),
  "trace_id" VARCHAR(100),
  "duration" INTEGER,
  "status" VARCHAR(20) NOT NULL,
  "error_message" TEXT,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_tenant_audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_request_tenant_id_create_time_idx"
  ON "sys_tenant_audit_log"("request_tenant_id", "create_time");
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_access_tenant_id_create_time_idx"
  ON "sys_tenant_audit_log"("access_tenant_id", "create_time");
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_user_id_create_time_idx"
  ON "sys_tenant_audit_log"("user_id", "create_time");
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_is_cross_tenant_create_time_idx"
  ON "sys_tenant_audit_log"("is_cross_tenant", "create_time");
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_status_create_time_idx"
  ON "sys_tenant_audit_log"("status", "create_time");
CREATE INDEX IF NOT EXISTS "sys_tenant_audit_log_trace_id_idx" ON "sys_tenant_audit_log"("trace_id");

CREATE TABLE IF NOT EXISTS "sys_dept_leader_log" (
  "id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "dept_id" INTEGER NOT NULL,
  "dept_name" VARCHAR(30) NOT NULL,
  "old_leader" VARCHAR(20) NOT NULL,
  "new_leader" VARCHAR(20) NOT NULL,
  "change_reason" VARCHAR(200),
  "operator" VARCHAR(64) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_dept_leader_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sys_dept_leader_log_tenant_id_dept_id_idx"
  ON "sys_dept_leader_log"("tenant_id", "dept_id");
CREATE INDEX IF NOT EXISTS "sys_dept_leader_log_tenant_id_create_time_idx"
  ON "sys_dept_leader_log"("tenant_id", "create_time");

CREATE TABLE IF NOT EXISTS "sys_user_social" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL DEFAULT '000000',
  "source" VARCHAR(32) NOT NULL,
  "openid" VARCHAR(128) NOT NULL,
  "unionid" VARCHAR(128),
  "nickname" VARCHAR(64),
  "avatar" VARCHAR(512),
  "create_time" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_user_social_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sys_user_social_source_openid_tenant_id_key"
  ON "sys_user_social"("source", "openid", "tenant_id");
CREATE INDEX IF NOT EXISTS "sys_user_social_user_id_idx" ON "sys_user_social"("user_id");
CREATE INDEX IF NOT EXISTS "sys_user_social_tenant_id_source_openid_idx"
  ON "sys_user_social"("tenant_id", "source", "openid");

CREATE TABLE IF NOT EXISTS "ai_platform_prompt" (
  "id" TEXT NOT NULL,
  "platform_code" VARCHAR(50) NOT NULL,
  "platform_name" VARCHAR(100) NOT NULL,
  "icon" VARCHAR(500),
  "system_prompt" TEXT NOT NULL,
  "output_schema" JSONB NOT NULL,
  "max_length" INTEGER,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "status" SMALLINT NOT NULL DEFAULT 1,
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "tenant_id" VARCHAR(20) NOT NULL DEFAULT '000000',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_platform_prompt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_platform_prompt_tenant_id_platform_code_key"
  ON "ai_platform_prompt"("tenant_id", "platform_code");
CREATE INDEX IF NOT EXISTS "ai_platform_prompt_tenant_id_status_idx"
  ON "ai_platform_prompt"("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "ai_content_record" (
  "id" TEXT NOT NULL,
  "member_id" VARCHAR(50) NOT NULL,
  "platform_code" VARCHAR(50) NOT NULL,
  "user_input" TEXT NOT NULL,
  "generated_content" JSONB NOT NULL,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "tenant_id" VARCHAR(20) NOT NULL DEFAULT '000000',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_content_record_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ai_content_record_member_id_idx" ON "ai_content_record"("member_id");
CREATE INDEX IF NOT EXISTS "ai_content_record_tenant_id_create_time_idx"
  ON "ai_content_record"("tenant_id", "create_time");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oms_order_tenant_id_fkey'
  ) THEN
    ALTER TABLE "oms_order"
      ADD CONSTRAINT "oms_order_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "sys_tenant"("tenant_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_content_record_member_id_fkey'
  ) THEN
    ALTER TABLE "ai_content_record"
      ADD CONSTRAINT "ai_content_record_member_id_fkey"
      FOREIGN KEY ("member_id") REFERENCES "ums_member"("member_id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
