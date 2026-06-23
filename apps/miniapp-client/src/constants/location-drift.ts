/**
 * 与后端 `evaluate-drift` 及产品设计对齐的客户端常量（服务端阈值为准，此处仅时间窗等辅助）
 */

/** 与后端 `LOCATION_DRIFT_COOLDOWN_MS` 一致：减少短时间重复请求 */
export const LOCATION_DRIFT_CLIENT_COOLDOWN_MS = 15 * 60 * 1000;

/** 本地记录上次漂移评估时间的 storage key */
export const LOCATION_DRIFT_LAST_EVALUATED_AT_KEY = 'locationDriftLastEvaluatedAt';
