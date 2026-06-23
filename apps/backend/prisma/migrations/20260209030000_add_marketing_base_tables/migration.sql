-- Restore marketing base schema that later migrations depend on.

DO $$ BEGIN CREATE TYPE "MarketingStockMode" AS ENUM ('STRONG_LOCK', 'LAZY_CHECK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CommissionMode" AS ENUM ('NONE', 'FIXED_RATE', 'INHERIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PlayInstanceStatus" AS ENUM ('PENDING_PAY', 'PAID', 'ACTIVE', 'SUCCESS', 'TIMEOUT', 'FAILED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AssetStatus" AS ENUM ('UNUSED', 'USED', 'EXPIRED', 'FROZEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CouponType" AS ENUM ('DISCOUNT', 'PERCENTAGE', 'EXCHANGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CouponStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "UserCouponStatus" AS ENUM ('UNUSED', 'LOCKED', 'USED', 'EXPIRED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CouponValidityType" AS ENUM ('FIXED', 'RELATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CouponDistributionType" AS ENUM ('MANUAL', 'AUTO', 'ACTIVITY', 'ORDER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PointsTransactionType" AS ENUM ('EARN_ORDER', 'EARN_SIGNIN', 'EARN_TASK', 'EARN_ADMIN', 'USE_ORDER', 'USE_COUPON', 'USE_PRODUCT', 'FREEZE', 'UNFREEZE', 'EXPIRE', 'REFUND', 'DEDUCT_ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PointsTransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "mkt_play_template" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rule_schema" JSONB NOT NULL,
  "unit_name" TEXT NOT NULL,
  "ui_component_id" TEXT,
  "product_id" TEXT,
  "sku_id" TEXT,
  "product_name" TEXT,
  "status" "Status" NOT NULL DEFAULT '0',
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_play_template_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_play_template_code_key" ON "mkt_play_template"("code");

CREATE TABLE IF NOT EXISTS "mkt_store_config" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT '000000',
  "service_id" TEXT NOT NULL,
  "service_type" "ProductType" NOT NULL,
  "template_code" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "rules_history" JSONB[] NOT NULL DEFAULT ARRAY[]::JSONB[],
  "stock_mode" "MarketingStockMode" NOT NULL,
  "scope_type" TEXT NOT NULL DEFAULT 'PRODUCT',
  "aggregate_enabled" BOOLEAN NOT NULL DEFAULT true,
  "zone_enabled" BOOLEAN NOT NULL DEFAULT true,
  "display_priority" INTEGER NOT NULL DEFAULT 0,
  "commission_mode" "CommissionMode" NOT NULL DEFAULT 'INHERIT',
  "commission_rate" DECIMAL(5,2),
  "status" "PublishStatus" NOT NULL DEFAULT 'OFF_SHELF',
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_store_config_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "idx_mkt_store_config_tenant_service_status_del" ON "mkt_store_config"("tenant_id", "service_id", "status", "del_flag");
CREATE INDEX IF NOT EXISTS "idx_mkt_store_config_aggregate_scan" ON "mkt_store_config"("tenant_id", "aggregate_enabled", "status", "del_flag", "service_id");
CREATE INDEX IF NOT EXISTS "idx_mkt_store_config_platform_aggregate" ON "mkt_store_config"("status", "del_flag", "aggregate_enabled", "service_id");

CREATE TABLE IF NOT EXISTS "mkt_store_play_target_sku" (
  "id" TEXT NOT NULL,
  "config_id" TEXT NOT NULL,
  "tenant_sku_id" TEXT NOT NULL,
  "global_sku_id" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "is_primary_display" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "mkt_store_play_target_sku_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_store_play_target_sku_config_id_idx" ON "mkt_store_play_target_sku"("config_id");

CREATE TABLE IF NOT EXISTS "mkt_activity_priority_rule" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "activity_type" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "aggregate_enabled" BOOLEAN NOT NULL DEFAULT true,
  "zone_enabled" BOOLEAN NOT NULL DEFAULT true,
  "manual_lock_enabled" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "mkt_activity_priority_rule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_activity_priority_rule_tenant_id_activity_type_key" ON "mkt_activity_priority_rule"("tenant_id", "activity_type");
CREATE INDEX IF NOT EXISTS "mkt_activity_priority_rule_tenant_id_idx" ON "mkt_activity_priority_rule"("tenant_id");

CREATE TABLE IF NOT EXISTS "mkt_resolution_audit" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "scene" TEXT NOT NULL,
  "candidate_snapshot" JSONB NOT NULL,
  "decision_snapshot" JSONB NOT NULL,
  "final_price" DECIMAL(10,2) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_resolution_audit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_resolution_audit_tenant_id_product_id_create_time_idx" ON "mkt_resolution_audit"("tenant_id", "product_id", "create_time");
CREATE INDEX IF NOT EXISTS "mkt_resolution_audit_tenant_id_member_id_create_time_idx" ON "mkt_resolution_audit"("tenant_id", "member_id", "create_time");

CREATE TABLE IF NOT EXISTS "mkt_play_instance" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "config_id" TEXT NOT NULL,
  "template_code" TEXT NOT NULL,
  "order_sn" TEXT,
  "order_id" TEXT,
  "order_item_id" INTEGER,
  "instance_data" JSONB NOT NULL,
  "status" "PlayInstanceStatus" NOT NULL DEFAULT 'PENDING_PAY',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "pay_time" TIMESTAMP(3),
  "end_time" TIMESTAMP(3),
  "update_time" TIMESTAMP(3) NOT NULL,
  "sysDistConfigId" INTEGER,
  CONSTRAINT "mkt_play_instance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_play_instance_order_item_id_key" ON "mkt_play_instance"("order_item_id");
CREATE INDEX IF NOT EXISTS "mkt_play_instance_config_id_idx" ON "mkt_play_instance"("config_id");
CREATE INDEX IF NOT EXISTS "mkt_play_instance_member_id_idx" ON "mkt_play_instance"("member_id");
CREATE INDEX IF NOT EXISTS "mkt_play_instance_order_id_idx" ON "mkt_play_instance"("order_id");

CREATE TABLE IF NOT EXISTS "mkt_user_asset" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "config_id" TEXT NOT NULL,
  "asset_name" TEXT NOT NULL,
  "asset_type" TEXT NOT NULL,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "initial_balance" DECIMAL(12,2) NOT NULL,
  "status" "AssetStatus" NOT NULL DEFAULT 'UNUSED',
  "expire_time" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_user_asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_user_asset_member_id_status_idx" ON "mkt_user_asset"("member_id", "status");
CREATE INDEX IF NOT EXISTS "mkt_user_asset_instance_id_idx" ON "mkt_user_asset"("instance_id");

CREATE TABLE IF NOT EXISTS "mkt_course_group_buy_ext" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "instance_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "total_lessons" INTEGER NOT NULL,
  "completed_lessons" INTEGER NOT NULL DEFAULT 0,
  "class_address" TEXT,
  "class_start_time" TIMESTAMP(3),
  "class_end_time" TIMESTAMP(3),
  "leader_id" TEXT NOT NULL,
  "leader_discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_course_group_buy_ext_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_course_group_buy_ext_instance_id_key" ON "mkt_course_group_buy_ext"("instance_id");
CREATE INDEX IF NOT EXISTS "mkt_course_group_buy_ext_group_id_idx" ON "mkt_course_group_buy_ext"("group_id");
CREATE INDEX IF NOT EXISTS "mkt_course_group_buy_ext_leader_id_idx" ON "mkt_course_group_buy_ext"("leader_id");
CREATE INDEX IF NOT EXISTS "mkt_course_group_buy_ext_tenant_id_idx" ON "mkt_course_group_buy_ext"("tenant_id");

CREATE TABLE IF NOT EXISTS "mkt_course_schedule" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "extension_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "lessons" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "remark" TEXT,
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_course_schedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_course_schedule_extension_id_date_idx" ON "mkt_course_schedule"("extension_id", "date");
CREATE INDEX IF NOT EXISTS "mkt_course_schedule_tenant_id_idx" ON "mkt_course_schedule"("tenant_id");

CREATE TABLE IF NOT EXISTS "mkt_course_attendance" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "extension_id" TEXT NOT NULL,
  "schedule_id" TEXT,
  "member_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "attended" BOOLEAN NOT NULL DEFAULT false,
  "remark" TEXT,
  "del_flag" "DelFlag" NOT NULL DEFAULT '0',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_course_attendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_course_attendance_extension_id_member_id_date_key" ON "mkt_course_attendance"("extension_id", "member_id", "date");
CREATE INDEX IF NOT EXISTS "mkt_course_attendance_member_id_idx" ON "mkt_course_attendance"("member_id");
CREATE INDEX IF NOT EXISTS "mkt_course_attendance_tenant_id_idx" ON "mkt_course_attendance"("tenant_id");

CREATE TABLE IF NOT EXISTS "mkt_coupon_template" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "type" "CouponType" NOT NULL,
  "discount_amount" DECIMAL(10,2),
  "discount_percent" INTEGER,
  "max_discount_amount" DECIMAL(10,2),
  "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "min_actual_pay_amount" DECIMAL(10,2),
  "applicable_products" TEXT[] NOT NULL,
  "applicable_categories" INTEGER[] NOT NULL,
  "member_levels" INTEGER[] NOT NULL,
  "exchange_product_id" TEXT,
  "exchange_sku_id" TEXT,
  "validity_type" "CouponValidityType" NOT NULL,
  "start_time" TIMESTAMP(3),
  "end_time" TIMESTAMP(3),
  "valid_days" INTEGER,
  "total_stock" INTEGER NOT NULL,
  "remaining_stock" INTEGER NOT NULL,
  "limit_per_user" INTEGER NOT NULL DEFAULT 1,
  "status" "CouponStatus" NOT NULL DEFAULT 'ACTIVE',
  "create_by" VARCHAR(64) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64),
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_coupon_template_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_coupon_template_tenant_id_status_idx" ON "mkt_coupon_template"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "mkt_coupon_template_tenant_id_type_idx" ON "mkt_coupon_template"("tenant_id", "type");

CREATE TABLE IF NOT EXISTS "mkt_user_coupon" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "coupon_name" VARCHAR(100) NOT NULL,
  "coupon_type" "CouponType" NOT NULL,
  "discount_amount" DECIMAL(10,2),
  "discount_percent" INTEGER,
  "max_discount_amount" DECIMAL(10,2),
  "min_order_amount" DECIMAL(10,2) NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "status" "UserCouponStatus" NOT NULL DEFAULT 'UNUSED',
  "distribution_type" "CouponDistributionType" NOT NULL,
  "distribution_source" VARCHAR(100),
  "used_time" TIMESTAMP(3),
  "order_id" TEXT,
  "receive_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_user_coupon_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_user_coupon_tenant_id_member_id_status_idx" ON "mkt_user_coupon"("tenant_id", "member_id", "status");
CREATE INDEX IF NOT EXISTS "mkt_user_coupon_template_id_idx" ON "mkt_user_coupon"("template_id");
CREATE INDEX IF NOT EXISTS "mkt_user_coupon_order_id_idx" ON "mkt_user_coupon"("order_id");

CREATE TABLE IF NOT EXISTS "mkt_coupon_usage" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "user_coupon_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "discount_amount" DECIMAL(10,2) NOT NULL,
  "order_amount" DECIMAL(10,2) NOT NULL,
  "used_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_coupon_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_coupon_usage_tenant_id_member_id_idx" ON "mkt_coupon_usage"("tenant_id", "member_id");
CREATE INDEX IF NOT EXISTS "mkt_coupon_usage_order_id_idx" ON "mkt_coupon_usage"("order_id");
CREATE INDEX IF NOT EXISTS "mkt_coupon_usage_user_coupon_id_idx" ON "mkt_coupon_usage"("user_coupon_id");

CREATE TABLE IF NOT EXISTS "mkt_points_rule" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "order_points_enabled" BOOLEAN NOT NULL DEFAULT true,
  "order_points_ratio" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "order_points_base" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "signin_points_enabled" BOOLEAN NOT NULL DEFAULT true,
  "signin_points_amount" INTEGER NOT NULL DEFAULT 10,
  "points_validity_enabled" BOOLEAN NOT NULL DEFAULT false,
  "points_validity_days" INTEGER,
  "points_redemption_enabled" BOOLEAN NOT NULL DEFAULT true,
  "points_redemption_ratio" DECIMAL(10,2) NOT NULL DEFAULT 100,
  "points_redemption_base" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "max_points_per_order" INTEGER,
  "max_discount_percent_order" INTEGER,
  "system_enabled" BOOLEAN NOT NULL DEFAULT true,
  "create_by" VARCHAR(64) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64),
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_points_rule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_points_rule_tenant_id_key" ON "mkt_points_rule"("tenant_id");

CREATE TABLE IF NOT EXISTS "mkt_points_account" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT NOT NULL,
  "total_points" INTEGER NOT NULL DEFAULT 0,
  "available_points" INTEGER NOT NULL DEFAULT 0,
  "frozen_points" INTEGER NOT NULL DEFAULT 0,
  "used_points" INTEGER NOT NULL DEFAULT 0,
  "expired_points" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_points_account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_points_account_tenant_id_member_id_key" ON "mkt_points_account"("tenant_id", "member_id");
CREATE INDEX IF NOT EXISTS "mkt_points_account_tenant_id_available_points_idx" ON "mkt_points_account"("tenant_id", "available_points");

CREATE TABLE IF NOT EXISTS "mkt_points_transaction" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "type" "PointsTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "balance_before" INTEGER NOT NULL,
  "balance_after" INTEGER NOT NULL,
  "related_id" TEXT,
  "related_type" VARCHAR(50),
  "expire_time" TIMESTAMP(3),
  "status" "PointsTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
  "remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_points_transaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_points_transaction_tenant_id_member_id_create_time_idx" ON "mkt_points_transaction"("tenant_id", "member_id", "create_time");
CREATE INDEX IF NOT EXISTS "mkt_points_transaction_account_id_type_idx" ON "mkt_points_transaction"("account_id", "type");
CREATE INDEX IF NOT EXISTS "mkt_points_transaction_related_id_idx" ON "mkt_points_transaction"("related_id");
CREATE INDEX IF NOT EXISTS "mkt_points_transaction_expire_time_idx" ON "mkt_points_transaction"("expire_time");

CREATE TABLE IF NOT EXISTS "mkt_points_task" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "task_key" VARCHAR(50) NOT NULL,
  "task_name" VARCHAR(100) NOT NULL,
  "task_description" VARCHAR(500),
  "points_reward" INTEGER NOT NULL,
  "completion_condition" JSONB NOT NULL,
  "is_repeatable" BOOLEAN NOT NULL DEFAULT false,
  "max_completions" INTEGER,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "create_by" VARCHAR(64) NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64),
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_points_task_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_points_task_tenant_id_task_key_key" ON "mkt_points_task"("tenant_id", "task_key");
CREATE INDEX IF NOT EXISTS "mkt_points_task_tenant_id_is_enabled_idx" ON "mkt_points_task"("tenant_id", "is_enabled");

CREATE TABLE IF NOT EXISTS "mkt_user_task_completion" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "completion_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "points_awarded" INTEGER NOT NULL,
  "transaction_id" TEXT NOT NULL,
  CONSTRAINT "mkt_user_task_completion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_user_task_completion_tenant_id_member_id_task_id_idx" ON "mkt_user_task_completion"("tenant_id", "member_id", "task_id");

CREATE TABLE IF NOT EXISTS "mkt_points_grant_failure" (
  "id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "type" "PointsTransactionType" NOT NULL,
  "related_id" TEXT,
  "remark" VARCHAR(500),
  "expire_time" TIMESTAMP(3),
  "failure_reason" VARCHAR(500) NOT NULL,
  "failure_time" TIMESTAMP(3) NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_retry_time" TIMESTAMP(3),
  "last_error_message" VARCHAR(1000),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_points_grant_failure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "mkt_points_grant_failure_member_id_status_idx" ON "mkt_points_grant_failure"("member_id", "status");
CREATE INDEX IF NOT EXISTS "mkt_points_grant_failure_related_id_idx" ON "mkt_points_grant_failure"("related_id");
CREATE INDEX IF NOT EXISTS "mkt_points_grant_failure_failure_time_idx" ON "mkt_points_grant_failure"("failure_time");

CREATE TABLE IF NOT EXISTS "mkt_activity" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" VARCHAR(500),
  "trigger_condition" JSONB NOT NULL,
  "rules" JSONB NOT NULL,
  "rewards" JSONB NOT NULL,
  "start_time" TIMESTAMP(3),
  "end_time" TIMESTAMP(3),
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "created_by" VARCHAR(64),
  "updated_by" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_activity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_activity_tenant_id_type_key" ON "mkt_activity"("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "mkt_activity_tenant_id_is_enabled_idx" ON "mkt_activity"("tenant_id", "is_enabled");
CREATE INDEX IF NOT EXISTS "mkt_activity_type_idx" ON "mkt_activity"("type");

CREATE TABLE IF NOT EXISTS "mkt_activity_participation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "activity_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "rewards_snapshot" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_activity_participation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_activity_participation_activity_id_member_id_key" ON "mkt_activity_participation"("activity_id", "member_id");
CREATE INDEX IF NOT EXISTS "mkt_activity_participation_tenant_id_member_id_idx" ON "mkt_activity_participation"("tenant_id", "member_id");

ALTER TABLE "mkt_store_play_target_sku" ADD CONSTRAINT "mkt_store_play_target_sku_config_id_fkey"
  FOREIGN KEY ("config_id") REFERENCES "mkt_store_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_play_instance" ADD CONSTRAINT "mkt_play_instance_config_id_fkey"
  FOREIGN KEY ("config_id") REFERENCES "mkt_store_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_course_group_buy_ext" ADD CONSTRAINT "mkt_course_group_buy_ext_instance_id_fkey"
  FOREIGN KEY ("instance_id") REFERENCES "mkt_play_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mkt_course_schedule" ADD CONSTRAINT "mkt_course_schedule_extension_id_fkey"
  FOREIGN KEY ("extension_id") REFERENCES "mkt_course_group_buy_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mkt_course_attendance" ADD CONSTRAINT "mkt_course_attendance_extension_id_fkey"
  FOREIGN KEY ("extension_id") REFERENCES "mkt_course_group_buy_ext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mkt_user_coupon" ADD CONSTRAINT "mkt_user_coupon_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "mkt_coupon_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_coupon_usage" ADD CONSTRAINT "mkt_coupon_usage_user_coupon_id_fkey"
  FOREIGN KEY ("user_coupon_id") REFERENCES "mkt_user_coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_transaction" ADD CONSTRAINT "mkt_points_transaction_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "mkt_points_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_activity_participation" ADD CONSTRAINT "mkt_activity_participation_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "mkt_activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
