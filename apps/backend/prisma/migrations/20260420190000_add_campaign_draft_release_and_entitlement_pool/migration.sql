DO $$
BEGIN
  CREATE TYPE "MktCampaignDraftStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MktCampaignReleaseStatus" AS ENUM ('PENDING', 'PUBLISHED', 'ROLLED_BACK', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MktEntitlementPoolType" AS ENUM ('PRODUCT', 'COUPON', 'POINTS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MktEntitlementPoolStatus" AS ENUM ('DRAFT', 'COMPILED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "mkt_campaign_draft" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "description" VARCHAR(500),
  "status" "MktCampaignDraftStatus" NOT NULL DEFAULT 'DRAFT',
  "foundation_json" JSONB,
  "audience_json" JSONB,
  "rights_json" JSONB,
  "stages_json" JSONB,
  "delivery_json" JSONB,
  "constraints_json" JSONB,
  "owner_user_id" VARCHAR(64),
  "source_activity_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" VARCHAR(64),
  "updated_by" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_campaign_draft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mkt_campaign_release" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "draft_id" TEXT NOT NULL,
  "release_no" INTEGER NOT NULL DEFAULT 1,
  "status" "MktCampaignReleaseStatus" NOT NULL DEFAULT 'PENDING',
  "snapshot_json" JSONB NOT NULL,
  "entitlement_snapshot" JSONB,
  "published_at" TIMESTAMP(3),
  "created_by" VARCHAR(64),
  "updated_by" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_campaign_release_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mkt_campaign_release_draft_id_fkey"
    FOREIGN KEY ("draft_id") REFERENCES "mkt_campaign_draft"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mkt_entitlement_pool" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "pool_type" "MktEntitlementPoolType" NOT NULL,
  "status" "MktEntitlementPoolStatus" NOT NULL DEFAULT 'DRAFT',
  "owner" VARCHAR(128),
  "touchpoints" JSONB NOT NULL DEFAULT '[]',
  "source_type" VARCHAR(30),
  "source_key" VARCHAR(120),
  "member_id" VARCHAR(64),
  "template_id" VARCHAR(64),
  "template_name" VARCHAR(120),
  "task_id" VARCHAR(64),
  "task_name" VARCHAR(120),
  "compile_preview_json" JSONB,
  "risk_summary_json" JSONB,
  "compile_artifacts_json" JSONB,
  "last_compiled_at" TIMESTAMP(3),
  "created_by" VARCHAR(64),
  "updated_by" VARCHAR(64),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_entitlement_pool_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mkt_campaign_draft_entitlement_pool" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "draft_id" TEXT NOT NULL,
  "pool_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_campaign_draft_entitlement_pool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mkt_campaign_draft_entitlement_pool_draft_id_fkey"
    FOREIGN KEY ("draft_id") REFERENCES "mkt_campaign_draft"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mkt_campaign_draft_entitlement_pool_pool_id_fkey"
    FOREIGN KEY ("pool_id") REFERENCES "mkt_entitlement_pool"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mkt_campaign_draft_tenant_id_status_idx"
  ON "mkt_campaign_draft"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "mkt_campaign_draft_tenant_id_type_idx"
  ON "mkt_campaign_draft"("tenant_id", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_release_tenant_id_draft_id_release_no_key"
  ON "mkt_campaign_release"("tenant_id", "draft_id", "release_no");

CREATE INDEX IF NOT EXISTS "mkt_campaign_release_tenant_id_status_idx"
  ON "mkt_campaign_release"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "mkt_entitlement_pool_tenant_id_pool_type_idx"
  ON "mkt_entitlement_pool"("tenant_id", "pool_type");

CREATE INDEX IF NOT EXISTS "mkt_entitlement_pool_tenant_id_status_idx"
  ON "mkt_entitlement_pool"("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "mkt_entitlement_pool_tenant_id_update_time_idx"
  ON "mkt_entitlement_pool"("tenant_id", "update_time");

CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_draft_entitlement_pool_tenant_id_draft_id_pool_id_key"
  ON "mkt_campaign_draft_entitlement_pool"("tenant_id", "draft_id", "pool_id");

CREATE INDEX IF NOT EXISTS "mkt_campaign_draft_entitlement_pool_tenant_id_draft_id_idx"
  ON "mkt_campaign_draft_entitlement_pool"("tenant_id", "draft_id");

CREATE INDEX IF NOT EXISTS "mkt_campaign_draft_entitlement_pool_tenant_id_pool_id_idx"
  ON "mkt_campaign_draft_entitlement_pool"("tenant_id", "pool_id");
