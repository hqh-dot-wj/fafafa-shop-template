-- P1-07: scene templates + draft inheritance metadata.

CREATE TABLE "mkt_scene_template" (
    "id" TEXT NOT NULL,
    "template_code" VARCHAR(60) NOT NULL,
    "template_name" VARCHAR(120) NOT NULL,
    "scene_type" VARCHAR(40) NOT NULL,
    "channel_scope" JSONB NOT NULL,
    "page_route" TEXT,
    "default_card_template_code" TEXT,
    "default_resolver_policy_code" TEXT,
    "placement_config" JSONB,
    "description" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_scene_template_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mkt_scene_template_module" (
    "id" TEXT NOT NULL,
    "template_code" VARCHAR(60) NOT NULL,
    "module_slot" VARCHAR(60) NOT NULL,
    "module_name" TEXT NOT NULL,
    "module_type" TEXT NOT NULL,
    "title" TEXT,
    "sub_title" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "limit_size" INTEGER NOT NULL DEFAULT 20,
    "source_policy_code" TEXT NOT NULL,
    "resolver_policy_code" TEXT NOT NULL,
    "sort_policy_code" TEXT,
    "audience_policy_code" TEXT,
    "card_template_code" TEXT NOT NULL,
    "attribution_policy_code" TEXT,
    "ui_config" JSONB,

    CONSTRAINT "mkt_scene_template_module_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "mkt_scene"
    ADD COLUMN "template_code" VARCHAR(60),
    ADD COLUMN "template_overrides" JSONB;

CREATE UNIQUE INDEX "mkt_scene_template_template_code_key" ON "mkt_scene_template"("template_code");
CREATE INDEX "mkt_scene_template_is_active_idx" ON "mkt_scene_template"("is_active");
CREATE UNIQUE INDEX "mkt_scene_template_module_template_code_module_slot_key"
    ON "mkt_scene_template_module"("template_code", "module_slot");
CREATE INDEX "mkt_scene_template_module_template_code_idx" ON "mkt_scene_template_module"("template_code");
CREATE INDEX "mkt_scene_template_code_idx" ON "mkt_scene"("template_code");

ALTER TABLE "mkt_scene_template_module" ADD CONSTRAINT "mkt_scene_template_module_template_code_fkey"
    FOREIGN KEY ("template_code") REFERENCES "mkt_scene_template"("template_code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mkt_scene" ADD CONSTRAINT "mkt_scene_template_code_fkey"
    FOREIGN KEY ("template_code") REFERENCES "mkt_scene_template"("template_code") ON DELETE SET NULL ON UPDATE CASCADE;
