ALTER TABLE "sys_notification_log"
  ADD COLUMN IF NOT EXISTS "biz_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "biz_ref_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "activity_id" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "touchpoint_code" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "touchpoint_kind" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "scene_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "policy_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "provider_message_id" VARCHAR(100);

CREATE INDEX IF NOT EXISTS "sys_notification_log_biz_type_activity_id_touchpoint_code_idx"
  ON "sys_notification_log" ("biz_type", "activity_id", "touchpoint_code");
