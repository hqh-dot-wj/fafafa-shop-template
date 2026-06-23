ALTER TABLE "sys_dist_share_policy"
  ADD COLUMN IF NOT EXISTS "attribution_window_minutes" INTEGER NOT NULL DEFAULT 10080;
