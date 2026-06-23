-- 新增营销场景配置模型: MktScene / MktSceneModule / MktSceneRelease

CREATE TABLE "mkt_scene" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "scene_code" TEXT NOT NULL,
    "scene_name" TEXT NOT NULL,
    "scene_type" TEXT NOT NULL,
    "channel_scope" JSONB NOT NULL,
    "page_route" TEXT,
    "default_card_template_code" TEXT,
    "default_resolver_policy_code" TEXT,
    "status" TEXT NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_scene_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mkt_scene_module" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "scene_code" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
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
    "status" TEXT NOT NULL,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_scene_module_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mkt_scene_release" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "scene_code" TEXT NOT NULL,
    "release_no" INTEGER NOT NULL,
    "release_status" TEXT NOT NULL,
    "release_snapshot" JSONB NOT NULL,
    "published_by" TEXT,
    "published_at" TIMESTAMP(3),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_scene_release_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "mkt_scene_tenant_id_scene_code_key" ON "mkt_scene"("tenant_id", "scene_code");
CREATE UNIQUE INDEX "mkt_scene_module_tenant_id_module_code_key" ON "mkt_scene_module"("tenant_id", "module_code");
CREATE UNIQUE INDEX "mkt_scene_release_tenant_id_scene_code_release_no_key" ON "mkt_scene_release"("tenant_id", "scene_code", "release_no");

-- Performance indexes
CREATE INDEX "mkt_scene_tenant_id_status_idx" ON "mkt_scene"("tenant_id", "status");
CREATE INDEX "mkt_scene_module_tenant_id_scene_code_display_order_idx" ON "mkt_scene_module"("tenant_id", "scene_code", "display_order");
CREATE INDEX "mkt_scene_release_tenant_id_scene_code_release_status_idx" ON "mkt_scene_release"("tenant_id", "scene_code", "release_status");

-- Foreign key constraints
ALTER TABLE "mkt_scene_module" ADD CONSTRAINT "mkt_scene_module_scene_code_tenant_id_fkey"
    FOREIGN KEY ("scene_code", "tenant_id") REFERENCES "mkt_scene"("scene_code", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "mkt_scene_release" ADD CONSTRAINT "mkt_scene_release_scene_code_tenant_id_fkey"
    FOREIGN KEY ("scene_code", "tenant_id") REFERENCES "mkt_scene"("scene_code", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
