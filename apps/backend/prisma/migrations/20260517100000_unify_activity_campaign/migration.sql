-- P1-05: unify marketing activity runtime on mkt_campaign.
-- This migration keeps legacy mkt_activity physical tables for rollback/data audit.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MktCampaignDraftStatus')
    AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MktCampaignStatus') THEN
    ALTER TYPE "MktCampaignDraftStatus" RENAME TO "MktCampaignStatus";
  END IF;
END $$;

DO $$
BEGIN
  CREATE TYPE "MktCampaignKind" AS ENUM ('POLICY', 'HANDLER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF to_regclass('mkt_campaign') IS NULL AND to_regclass('mkt_campaign_draft') IS NOT NULL THEN
    ALTER TABLE "mkt_campaign_draft" RENAME TO "mkt_campaign";
  END IF;
END $$;

ALTER TABLE IF EXISTS "mkt_campaign"
  ADD COLUMN IF NOT EXISTS "kind" "MktCampaignKind" NOT NULL DEFAULT 'POLICY',
  ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "policy_json" JSONB;

UPDATE "mkt_campaign"
SET
  "kind" = CASE
    WHEN "type" IN ('FIRST_ORDER', 'FULL_REDUCTION', 'MEMBER_DAY', 'PROMOTION_PRICE', 'BIRTHDAY')
      THEN 'POLICY'::"MktCampaignKind"
    ELSE 'HANDLER'::"MktCampaignKind"
  END,
  "start_time" = COALESCE(
    "start_time",
    CASE
      WHEN "foundation_json" IS NOT NULL
        AND ("foundation_json"::jsonb ->> 'startTime') ~ '^\d{4}-\d{2}-\d{2}'
      THEN ("foundation_json"::jsonb ->> 'startTime')::timestamp(3)
      ELSE NULL
    END
  ),
  "end_time" = COALESCE(
    "end_time",
    CASE
      WHEN "foundation_json" IS NOT NULL
        AND ("foundation_json"::jsonb ->> 'endTime') ~ '^\d{4}-\d{2}-\d{2}'
      THEN ("foundation_json"::jsonb ->> 'endTime')::timestamp(3)
      ELSE NULL
    END
  ),
  "priority" = CASE
    WHEN "foundation_json" IS NOT NULL
      AND ("foundation_json"::jsonb ->> 'priority') ~ '^-?\d+$'
    THEN ("foundation_json"::jsonb ->> 'priority')::integer
    ELSE "priority"
  END
WHERE to_regclass('mkt_campaign') IS NOT NULL;

UPDATE "mkt_campaign"
SET "policy_json" = jsonb_strip_nulls(
  jsonb_build_object(
    'source', 'foundation',
    'type', "type",
    'audience', "audience_json",
    'rights', "rights_json",
    'stages', "stages_json"
  )
)
WHERE "kind" = 'POLICY'::"MktCampaignKind" AND "policy_json" IS NULL;

ALTER TABLE IF EXISTS "mkt_campaign" DROP COLUMN IF EXISTS "source_activity_id";

DO $$
BEGIN
  IF to_regclass('mkt_campaign_release') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mkt_campaign_release' AND column_name = 'draft_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mkt_campaign_release' AND column_name = 'campaign_id'
    ) THEN
    ALTER TABLE "mkt_campaign_release" RENAME COLUMN "draft_id" TO "campaign_id";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('mkt_campaign_entitlement_pool') IS NULL
    AND to_regclass('mkt_campaign_draft_entitlement_pool') IS NOT NULL THEN
    ALTER TABLE "mkt_campaign_draft_entitlement_pool" RENAME TO "mkt_campaign_entitlement_pool";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('mkt_campaign_entitlement_pool') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mkt_campaign_entitlement_pool' AND column_name = 'draft_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'mkt_campaign_entitlement_pool' AND column_name = 'campaign_id'
    ) THEN
    ALTER TABLE "mkt_campaign_entitlement_pool" RENAME COLUMN "draft_id" TO "campaign_id";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "mkt_campaign_touchpoint" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "kind" "MktTouchpointKind" NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "config" JSONB NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_campaign_touchpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mkt_campaign_participation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "rewards_snapshot" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mkt_campaign_participation_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "mkt_campaign_draft_tenant_id_source_activity_id_key";
DROP INDEX IF EXISTS "mkt_campaign_draft_tenant_id_status_idx";
DROP INDEX IF EXISTS "mkt_campaign_draft_tenant_id_type_idx";
DROP INDEX IF EXISTS "mkt_campaign_draft_entitlement_pool_tenant_id_draft_id_pool_id_key";
DROP INDEX IF EXISTS "mkt_campaign_draft_entitlement_pool_tenant_id_draft_id_idx";

CREATE INDEX IF NOT EXISTS "mkt_campaign_tenant_id_type_status_idx" ON "mkt_campaign"("tenant_id", "type", "status");
CREATE INDEX IF NOT EXISTS "mkt_campaign_tenant_id_status_start_time_end_time_idx" ON "mkt_campaign"("tenant_id", "status", "start_time", "end_time");
CREATE INDEX IF NOT EXISTS "mkt_campaign_tenant_id_update_time_idx" ON "mkt_campaign"("tenant_id", "update_time");
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_release_tenant_id_campaign_id_release_no_key" ON "mkt_campaign_release"("tenant_id", "campaign_id", "release_no");
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_entitlement_pool_tenant_id_campaign_id_pool_id_key" ON "mkt_campaign_entitlement_pool"("tenant_id", "campaign_id", "pool_id");
CREATE INDEX IF NOT EXISTS "mkt_campaign_entitlement_pool_tenant_id_campaign_id_idx" ON "mkt_campaign_entitlement_pool"("tenant_id", "campaign_id");
CREATE INDEX IF NOT EXISTS "mkt_campaign_entitlement_pool_tenant_id_pool_id_idx" ON "mkt_campaign_entitlement_pool"("tenant_id", "pool_id");
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_touchpoint_tenant_id_campaign_id_kind_code_key" ON "mkt_campaign_touchpoint"("tenant_id", "campaign_id", "kind", "code");
CREATE INDEX IF NOT EXISTS "mkt_campaign_touchpoint_tenant_id_campaign_id_kind_idx" ON "mkt_campaign_touchpoint"("tenant_id", "campaign_id", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_participation_campaign_id_member_id_key" ON "mkt_campaign_participation"("campaign_id", "member_id");
CREATE INDEX IF NOT EXISTS "mkt_campaign_participation_tenant_id_member_id_idx" ON "mkt_campaign_participation"("tenant_id", "member_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_release_campaign_id_fkey'
  ) THEN
    ALTER TABLE "mkt_campaign_release"
      ADD CONSTRAINT "mkt_campaign_release_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_entitlement_pool_campaign_id_fkey'
  ) THEN
    ALTER TABLE "mkt_campaign_entitlement_pool"
      ADD CONSTRAINT "mkt_campaign_entitlement_pool_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_entitlement_pool_pool_id_fkey'
  ) THEN
    ALTER TABLE "mkt_campaign_entitlement_pool"
      ADD CONSTRAINT "mkt_campaign_entitlement_pool_pool_id_fkey"
      FOREIGN KEY ("pool_id") REFERENCES "mkt_entitlement_pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_touchpoint_campaign_id_fkey'
  ) THEN
    ALTER TABLE "mkt_campaign_touchpoint"
      ADD CONSTRAINT "mkt_campaign_touchpoint_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mkt_campaign_participation_campaign_id_fkey'
  ) THEN
    ALTER TABLE "mkt_campaign_participation"
      ADD CONSTRAINT "mkt_campaign_participation_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "mkt_campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
