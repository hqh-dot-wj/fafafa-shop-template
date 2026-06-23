-- CreateTable
CREATE TABLE "oms_order_item_attribution" (
    "id" BIGSERIAL NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "source_scene_code_snapshot" TEXT,
    "source_module_code_snapshot" TEXT,
    "source_channel_snapshot" TEXT,
    "source_page_path_snapshot" TEXT,
    "share_user_id_snapshot" TEXT,
    "referrer_id_snapshot" TEXT,
    "card_template_code_snapshot" TEXT,
    "resolver_policy_code_snapshot" TEXT,
    "resolver_release_no_snapshot" INTEGER,
    "audience_snapshot" JSONB,
    "secondary_benefits_snapshot" JSONB,
    "deny_stack_reasons_snapshot" JSONB,
    "entry_context_snapshot" JSONB,

    CONSTRAINT "oms_order_item_attribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rpt_order_item_marketing_fact" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_item_id" INTEGER NOT NULL,
    "source_scene_code" TEXT,
    "source_module_code" TEXT,
    "primary_offer_type" TEXT,
    "final_paid_amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "rpt_order_item_marketing_fact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oms_order_item_attribution_order_item_id_key" ON "oms_order_item_attribution"("order_item_id");

-- CreateIndex
CREATE INDEX "oms_order_item_attribution_tenant_id_source_scene_code_snapshot_idx" ON "oms_order_item_attribution"("tenant_id", "source_scene_code_snapshot");

-- CreateIndex
CREATE UNIQUE INDEX "rpt_order_item_marketing_fact_order_item_id_key" ON "rpt_order_item_marketing_fact"("order_item_id");

-- CreateIndex
CREATE INDEX "rpt_order_item_marketing_fact_tenant_id_source_scene_code_source_module_code_idx" ON "rpt_order_item_marketing_fact"("tenant_id", "source_scene_code", "source_module_code");
