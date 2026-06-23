/**
 * 营销后台 API 聚合出口。
 *
 * 这里仅 re-export 各业务切片的请求封装；新增切片时先确认 backend Controller 前缀，
 * 再在对应文件里标注后端来源，避免 admin-web 路由和 backend 接口语义漂移。
 */
export * from './template';
export * from './config';
export * from './coupon';
export * from './finance';
export * from './points';
export * from './resolution';
export { fetchGetPointsStatistics } from './statistics';
export * from './course';
export * from './ai-prompt';
export * from './scene';
export * from './policy';
export * from './runtime-ledger';
export * from './business-dashboard';
export * from './instance';
export * from './activity';
export * from './scene-placement';
export * from './course-group';
export * from './protocol';
export * from './campaign';
export * from './entitlement';
export * from './event-catalog';
export * from './orchestration';
