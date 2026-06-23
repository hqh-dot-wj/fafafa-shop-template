import type { BizOperationTargetTypes } from './biz-operation-log.constants';

export type BizOperationTargetType = (typeof BizOperationTargetTypes)[keyof typeof BizOperationTargetTypes];

/**
 * @LogOperation 元数据：由拦截器在接口成功（Result.code=200）后写入 biz_operation_log
 */
export interface LogOperationMeta {
  action: string;
  targetType: BizOperationTargetType;
  /** 从 body 取目标主键，如 orderId / memberId */
  targetIdBodyKey?: string;
  /** 从路由 param 取目标主键，如 memberId */
  targetIdParam?: string;
  /** 批量订单：取 body 中数组第一个作为 targetId，整表写入 detail.orderIds */
  batchOrderIdsBodyKey?: string;
  /** 将 body 中这些字段序列化进 detail（JSON） */
  detailBodyKeys?: string[];
}

export const LOG_OPERATION_META_KEY = 'bizOperationLog';
