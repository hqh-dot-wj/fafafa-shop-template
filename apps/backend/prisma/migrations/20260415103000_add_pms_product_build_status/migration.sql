-- 总部商品新增构建状态字段，支持建品分步保存与草稿恢复
DO $$ BEGIN CREATE TYPE "ProductBuildStatus" AS ENUM ('DRAFT', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ProductTemplateSource" AS ENUM ('CATEGORY', 'CUSTOM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "pms_product"
ADD COLUMN IF NOT EXISTS "build_status" "ProductBuildStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN IF NOT EXISTS "last_edit_step" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "draft_saved_at" TIMESTAMP(3) NULL,
ADD COLUMN IF NOT EXISTS "template_source" "ProductTemplateSource" NOT NULL DEFAULT 'CATEGORY',
ADD COLUMN IF NOT EXISTS "template_id" INTEGER NULL,
ADD COLUMN IF NOT EXISTS "del_flag" "DelFlag" NOT NULL DEFAULT '0';

CREATE INDEX IF NOT EXISTS "idx_pms_product_publish_ctime" ON "pms_product"("publish_status", "create_time");
CREATE INDEX IF NOT EXISTS "idx_pms_product_publish_type_ctime" ON "pms_product"("publish_status", "type", "create_time");
CREATE INDEX IF NOT EXISTS "idx_pms_product_name" ON "pms_product"("name");
