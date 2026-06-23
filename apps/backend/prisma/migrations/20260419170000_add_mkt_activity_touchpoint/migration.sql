DO $$
BEGIN
  CREATE TYPE "MktTouchpointKind" AS ENUM ('MESSAGE', 'SHARE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "mkt_activity_touchpoint" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "activity_id" TEXT NOT NULL,
  "kind" "MktTouchpointKind" NOT NULL,
  "code" VARCHAR(60) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "config" JSONB NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mkt_activity_touchpoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mkt_activity_touchpoint_activity_id_fkey"
    FOREIGN KEY ("activity_id") REFERENCES "mkt_activity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mkt_activity_touchpoint_tenant_id_activity_id_kind_code_key"
  ON "mkt_activity_touchpoint"("tenant_id", "activity_id", "kind", "code");

CREATE INDEX IF NOT EXISTS "mkt_activity_touchpoint_tenant_id_activity_id_kind_idx"
  ON "mkt_activity_touchpoint"("tenant_id", "activity_id", "kind");
