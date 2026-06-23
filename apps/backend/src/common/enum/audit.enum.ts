/**
 * 统一审核状态枚举
 *
 * 用于所有需要审核/审批的业务场景，规范审核状态命名。
 * 各业务模块应逐步对齐到此枚举，避免各自定义不同的状态值和字段命名。
 *
 * 字段命名规范：
 * - 审核状态字段统一使用 `auditStatus`
 * - 审核人字段统一使用 `auditBy`
 * - 审核时间字段统一使用 `auditTime`
 * - 审核备注字段统一使用 `auditRemark`
 */
export enum AuditStatusEnum {
  /** 待审核 */
  PENDING = 'PENDING',
  /** 审核中（多级审批场景） */
  REVIEWING = 'REVIEWING',
  /** 已通过 */
  APPROVED = 'APPROVED',
  /** 已驳回 */
  REJECTED = 'REJECTED',
  /** 已撤回（申请人主动撤回） */
  CANCELLED = 'CANCELLED',
}

/**
 * 统一审核记录接口
 *
 * 各业务模块的审核操作应记录以下标准字段。
 * 已有模块的字段映射关系：
 *
 * | 业务模块   | 旧审核人字段   | 旧时间字段   | 旧备注字段    |
 * |-----------|--------------|------------|-------------|
 * | 提现审核   | auditBy      | auditTime  | auditRemark |
 * | 会员升级   | reviewBy     | reviewTime | reviewRemark|
 * | 分销申请   | reviewerId   | reviewTime | reviewRemark|
 * | 营销活动   | approver     | approvalTime| remark     |
 *
 * 新业务模块应直接使用 auditBy / auditTime / auditRemark 命名。
 */
export interface AuditRecord {
  /** 审核状态 */
  auditStatus: AuditStatusEnum;
  /** 审核人ID */
  auditBy?: number;
  /** 审核人名称 */
  auditByName?: string;
  /** 审核时间 */
  auditTime?: Date;
  /** 审核备注/原因 */
  auditRemark?: string;
}
