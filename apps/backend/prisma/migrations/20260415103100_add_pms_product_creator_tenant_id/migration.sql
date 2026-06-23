-- 商品创建来源租户，用于总部商品列表按创建方筛选
ALTER TABLE "pms_product"
ADD COLUMN IF NOT EXISTS "creator_tenant_id" VARCHAR(20) NOT NULL DEFAULT '000000';
