-- 场景定义页：活动类型过滤、匹配门店方式、排序方式等（JSON，与 SaveSceneDto.placementConfig 对齐）
ALTER TABLE "mkt_scene" ADD COLUMN IF NOT EXISTS "placement_config" JSONB;
