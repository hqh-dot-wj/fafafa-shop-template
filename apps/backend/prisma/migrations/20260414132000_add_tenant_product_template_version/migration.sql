-- 为门店商品增加模板版本绑定，支撑模板版本化闭环
ALTER TABLE "pms_tenant_product"
ADD COLUMN IF NOT EXISTS "template_version_id" VARCHAR(64) NULL;

CREATE INDEX IF NOT EXISTS "pms_tenant_product_template_version_id_idx"
ON "pms_tenant_product"("template_version_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pms_tenant_product_template_version_id_fkey'
  ) THEN
    ALTER TABLE "pms_tenant_product"
    ADD CONSTRAINT "pms_tenant_product_template_version_id_fkey"
    FOREIGN KEY ("template_version_id") REFERENCES "pms_attr_template_version"("version_id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
