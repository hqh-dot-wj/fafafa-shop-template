/** C 端营销场景接口运行时开关（sys_config，可按租户覆盖，缺省回落平台租户 000000） */
export const MARKETING_CLIENT_SCENE_ENABLED_KEY = 'marketing.client.scene.enabled';

/** 0~100：按 memberId + tenantId 稳定哈希放量，100 表示全量 */
export const MARKETING_CLIENT_SCENE_ROLLOUT_PERCENT_KEY = 'marketing.client.scene.rolloutPercent';

/** C 端营销聚合列表接口总开关（sys_config；连续 14 个 UTC 日历日零调用可由定时任务自动置为 N） */
export const MARKETING_CLIENT_AGGREGATE_ENABLED_KEY = 'marketing.client.aggregate.enabled';
