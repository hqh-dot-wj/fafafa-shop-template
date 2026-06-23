CREATE UNIQUE INDEX IF NOT EXISTS "mkt_campaign_draft_tenant_id_source_activity_id_key"
  ON "mkt_campaign_draft"("tenant_id", "source_activity_id");
