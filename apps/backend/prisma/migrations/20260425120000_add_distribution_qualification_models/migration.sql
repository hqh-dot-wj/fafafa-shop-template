DO $$
BEGIN
  CREATE TYPE "DistServicePolicyTargetType" AS ENUM ('PRODUCT', 'SKU', 'CATEGORY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistLv0RewardMode" AS ENUM ('NONE', 'PENDING');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistQualificationEvidenceStatus" AS ENUM ('PENDING_DELIVERY', 'ELIGIBLE', 'USED', 'INVALID', 'REFUNDED', 'LEGACY_IMPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistQualificationApplicationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistDistributorProfileStatus" AS ENUM ('ACTIVE', 'FROZEN', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistAttributionBindStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REPLACED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistRelationStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DistPendingRewardStatus" AS ENUM ('FROZEN', 'ELIGIBLE', 'RELEASED', 'VOIDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "sys_dist_service_policy" (
  "id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "target_type" "DistServicePolicyTargetType" NOT NULL,
  "target_id" VARCHAR(64) NOT NULL,
  "commission_eligible" BOOLEAN NOT NULL DEFAULT false,
  "qualification_eligible" BOOLEAN NOT NULL DEFAULT false,
  "allow_lv0_share" BOOLEAN NOT NULL DEFAULT false,
  "lv0_reward_mode" "DistLv0RewardMode" NOT NULL DEFAULT 'NONE',
  "require_risk_confirm" BOOLEAN NOT NULL DEFAULT false,
  "risk_confirmed_at" TIMESTAMP(3),
  "risk_confirmed_by" VARCHAR(64),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "create_by" VARCHAR(64) NOT NULL DEFAULT '',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64) NOT NULL DEFAULT '',
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_service_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_service_policy_target"
  ON "sys_dist_service_policy"("tenant_id", "target_type", "target_id");

CREATE INDEX IF NOT EXISTS "idx_dist_service_policy_active"
  ON "sys_dist_service_policy"("tenant_id", "is_active");

CREATE INDEX IF NOT EXISTS "idx_dist_service_policy_qual"
  ON "sys_dist_service_policy"("tenant_id", "qualification_eligible");

CREATE TABLE IF NOT EXISTS "sys_dist_qualification_rule" (
  "id" SERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "target_level_id" INTEGER NOT NULL,
  "required_evidence_count" INTEGER NOT NULL DEFAULT 1,
  "required_service_policy_ids" JSONB,
  "require_manual_review" BOOLEAN NOT NULL DEFAULT true,
  "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "min_register_days" INTEGER NOT NULL DEFAULT 0,
  "require_real_name" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "create_by" VARCHAR(64) NOT NULL DEFAULT '',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_by" VARCHAR(64) NOT NULL DEFAULT '',
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_qualification_rule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_qualification_rule_level"
  ON "sys_dist_qualification_rule"("tenant_id", "target_level_id");

CREATE INDEX IF NOT EXISTS "idx_dist_qualification_rule_active"
  ON "sys_dist_qualification_rule"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "sys_dist_qualification_evidence" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" VARCHAR(64) NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" INTEGER,
  "product_id" VARCHAR(64),
  "sku_id" VARCHAR(64),
  "service_policy_id" INTEGER,
  "source_share_user_id" VARCHAR(64),
  "evidence_status" "DistQualificationEvidenceStatus" NOT NULL DEFAULT 'PENDING_DELIVERY',
  "verified_at" TIMESTAMP(3),
  "used_application_id" TEXT,
  "invalid_reason" VARCHAR(255),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_qualification_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_evidence_order_item"
  ON "sys_dist_qualification_evidence"("tenant_id", "order_id", "order_item_id");

CREATE INDEX IF NOT EXISTS "idx_dist_evidence_member_status"
  ON "sys_dist_qualification_evidence"("tenant_id", "member_id", "evidence_status");

CREATE INDEX IF NOT EXISTS "idx_dist_evidence_share_user"
  ON "sys_dist_qualification_evidence"("tenant_id", "source_share_user_id");

CREATE INDEX IF NOT EXISTS "idx_dist_evidence_verified_at"
  ON "sys_dist_qualification_evidence"("verified_at");

CREATE TABLE IF NOT EXISTS "sys_dist_qualification_application" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" VARCHAR(64) NOT NULL,
  "target_level_id" INTEGER NOT NULL,
  "evidence_ids" JSONB,
  "status" "DistQualificationApplicationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewer_id" VARCHAR(64),
  "review_time" TIMESTAMP(3),
  "review_remark" VARCHAR(500),
  "approved_profile_id" TEXT,
  "apply_reason" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_qualification_application_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_dist_application_member_status"
  ON "sys_dist_qualification_application"("tenant_id", "member_id", "status");

CREATE INDEX IF NOT EXISTS "idx_dist_application_status_time"
  ON "sys_dist_qualification_application"("tenant_id", "status", "create_time");

CREATE TABLE IF NOT EXISTS "sys_dist_distributor_profile" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" VARCHAR(64) NOT NULL,
  "status" "DistDistributorProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "level_id" INTEGER NOT NULL,
  "qualified_at" TIMESTAMP(3) NOT NULL,
  "source_application_id" TEXT,
  "can_withdraw" BOOLEAN NOT NULL DEFAULT true,
  "can_bind_relation" BOOLEAN NOT NULL DEFAULT true,
  "can_earn_l2" BOOLEAN NOT NULL DEFAULT false,
  "frozen_reason" VARCHAR(255),
  "revoked_reason" VARCHAR(255),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_distributor_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_profile_member"
  ON "sys_dist_distributor_profile"("tenant_id", "member_id");

CREATE INDEX IF NOT EXISTS "idx_dist_profile_status_level"
  ON "sys_dist_distributor_profile"("tenant_id", "status", "level_id");

CREATE INDEX IF NOT EXISTS "idx_dist_profile_qualified_at"
  ON "sys_dist_distributor_profile"("qualified_at");

CREATE TABLE IF NOT EXISTS "sys_dist_attribution_bind" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" VARCHAR(64) NOT NULL,
  "share_user_id" VARCHAR(64) NOT NULL,
  "source_sid" VARCHAR(64),
  "bind_mode" "DistShareAttributionMode" NOT NULL DEFAULT 'LAST_TOUCH',
  "expire_at" TIMESTAMP(3),
  "status" "DistAttributionBindStatus" NOT NULL DEFAULT 'ACTIVE',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_attribution_bind_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_dist_attr_bind_member_status"
  ON "sys_dist_attribution_bind"("tenant_id", "member_id", "status");

CREATE INDEX IF NOT EXISTS "idx_dist_attr_bind_share_status"
  ON "sys_dist_attribution_bind"("tenant_id", "share_user_id", "status");

CREATE INDEX IF NOT EXISTS "idx_dist_attr_bind_expire_at"
  ON "sys_dist_attribution_bind"("expire_at");

CREATE TABLE IF NOT EXISTS "sys_dist_relation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "distributor_member_id" VARCHAR(64) NOT NULL,
  "team_owner_member_id" VARCHAR(64),
  "inviter_member_id" VARCHAR(64),
  "source_application_id" TEXT,
  "status" "DistRelationStatus" NOT NULL DEFAULT 'ACTIVE',
  "effective_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_relation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_relation_distributor"
  ON "sys_dist_relation"("tenant_id", "distributor_member_id");

CREATE INDEX IF NOT EXISTS "idx_dist_relation_team_owner"
  ON "sys_dist_relation"("tenant_id", "team_owner_member_id", "status");

CREATE INDEX IF NOT EXISTS "idx_dist_relation_inviter"
  ON "sys_dist_relation"("tenant_id", "inviter_member_id", "status");

CREATE TABLE IF NOT EXISTS "sys_dist_relation_log" (
  "id" BIGSERIAL NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "relation_id" TEXT,
  "distributor_member_id" VARCHAR(64) NOT NULL,
  "from_team_owner_member_id" VARCHAR(64),
  "to_team_owner_member_id" VARCHAR(64),
  "from_status" VARCHAR(30),
  "to_status" VARCHAR(30),
  "change_type" VARCHAR(30) NOT NULL,
  "reason" VARCHAR(255),
  "operator" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sys_dist_relation_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_dist_relation_log_member"
  ON "sys_dist_relation_log"("tenant_id", "distributor_member_id");

CREATE INDEX IF NOT EXISTS "idx_dist_relation_log_time"
  ON "sys_dist_relation_log"("create_time");

CREATE TABLE IF NOT EXISTS "sys_dist_pending_reward" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "member_id" VARCHAR(64) NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" INTEGER,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "DistPendingRewardStatus" NOT NULL DEFAULT 'FROZEN',
  "release_profile_id" TEXT,
  "void_reason" VARCHAR(255),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sys_dist_pending_reward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_dist_pending_reward_order"
  ON "sys_dist_pending_reward"("tenant_id", "member_id", "order_id", "order_item_id");

CREATE INDEX IF NOT EXISTS "idx_dist_pending_reward_member"
  ON "sys_dist_pending_reward"("tenant_id", "member_id", "status");

CREATE INDEX IF NOT EXISTS "idx_dist_pending_reward_order"
  ON "sys_dist_pending_reward"("order_id");
