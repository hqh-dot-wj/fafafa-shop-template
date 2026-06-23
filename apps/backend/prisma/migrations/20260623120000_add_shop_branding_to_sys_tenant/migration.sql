-- FAFAFA-PIVOT Phase 4：店铺品牌字段（单实例 SysTenant 000000 自助配置）
ALTER TABLE "sys_tenant" ADD COLUMN IF NOT EXISTS "logo_url" VARCHAR(500);
ALTER TABLE "sys_tenant" ADD COLUMN IF NOT EXISTS "theme_color" VARCHAR(32);
ALTER TABLE "sys_tenant" ADD COLUMN IF NOT EXISTS "user_agreement" TEXT;
ALTER TABLE "sys_tenant" ADD COLUMN IF NOT EXISTS "privacy_agreement" TEXT;
