import { ApiProperty } from '@nestjs/swagger';
import {
  PointsConsumeAllocationStatus,
  PointsDebtReason,
  PointsDebtStatus,
  PointsFreezeAllocationStatus,
  PointsLotStatus,
  PointsRefundAllocationStrategy,
  PointsTransactionStatus,
  PointsTransactionType,
} from '@prisma/client';

export class PointsAssetTransactionBriefVo {
  @ApiProperty({ description: '交易ID' })
  id: string;

  @ApiProperty({ description: '交易类型', enum: PointsTransactionType })
  type: PointsTransactionType;

  @ApiProperty({ description: '积分数量' })
  amount: number;

  @ApiProperty({ description: '交易状态', enum: PointsTransactionStatus })
  status: PointsTransactionStatus;

  @ApiProperty({ description: '关联业务ID', type: String, nullable: true })
  relatedId: string | null;

  @ApiProperty({ description: '关联业务类型', type: String, nullable: true })
  relatedType: string | null;

  @ApiProperty({ description: '备注', type: String, nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}

export class PointsAssetLotBriefVo {
  @ApiProperty({ description: '批次ID' })
  id: string;

  @ApiProperty({ description: '来源交易ID', type: String, nullable: true })
  sourceTransactionId: string | null;

  @ApiProperty({ description: '来源交易类型', enum: PointsTransactionType, nullable: true })
  sourceType: PointsTransactionType | null;

  @ApiProperty({ description: '总积分' })
  totalAmount: number;

  @ApiProperty({ description: '可用积分' })
  availableAmount: number;

  @ApiProperty({ description: '冻结积分' })
  frozenAmount: number;

  @ApiProperty({ description: '已消费积分' })
  consumedAmount: number;

  @ApiProperty({ description: '已过期积分' })
  expiredAmount: number;

  @ApiProperty({ description: '过期时间', type: Date, nullable: true })
  expireTime: Date | null;

  @ApiProperty({ description: '批次状态', enum: PointsLotStatus })
  status: PointsLotStatus;
}

export class PointsLotVo extends PointsAssetLotBriefVo {
  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '账户ID' })
  accountId: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  updateTime: Date;

  @ApiProperty({ description: '来源交易', type: PointsAssetTransactionBriefVo, nullable: true })
  sourceTransaction: PointsAssetTransactionBriefVo | null;
}

export class PointsFreezeAllocationVo {
  @ApiProperty({ description: '冻结分摊ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '账户ID' })
  accountId: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '冻结交易ID' })
  freezeTransactionId: string;

  @ApiProperty({ description: '解冻交易ID', type: String, nullable: true })
  releaseTransactionId: string | null;

  @ApiProperty({ description: '批次ID' })
  lotId: string;

  @ApiProperty({ description: '关联业务ID', type: String, nullable: true })
  relatedId: string | null;

  @ApiProperty({ description: '分摊积分' })
  amount: number;

  @ApiProperty({ description: '冻结分摊状态', enum: PointsFreezeAllocationStatus })
  status: PointsFreezeAllocationStatus;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  updateTime: Date;

  @ApiProperty({ description: '批次快照', type: PointsAssetLotBriefVo })
  lot: PointsAssetLotBriefVo;

  @ApiProperty({ description: '冻结交易', type: PointsAssetTransactionBriefVo })
  freezeTransaction: PointsAssetTransactionBriefVo;

  @ApiProperty({ description: '解冻交易', type: PointsAssetTransactionBriefVo, nullable: true })
  releaseTransaction: PointsAssetTransactionBriefVo | null;
}

export class PointsConsumeAllocationVo {
  @ApiProperty({ description: '消费分摊ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '账户ID' })
  accountId: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '消费交易ID' })
  spendTransactionId: string;

  @ApiProperty({ description: '来源冻结分摊ID', type: String, nullable: true })
  sourceFreezeAllocationId: string | null;

  @ApiProperty({ description: '批次ID' })
  lotId: string;

  @ApiProperty({ description: '关联业务ID', type: String, nullable: true })
  relatedId: string | null;

  @ApiProperty({ description: '分摊积分' })
  amount: number;

  @ApiProperty({ description: '可退款积分' })
  refundableAmount: number;

  @ApiProperty({ description: '消费分摊状态', enum: PointsConsumeAllocationStatus })
  status: PointsConsumeAllocationStatus;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  updateTime: Date;

  @ApiProperty({ description: '批次快照', type: PointsAssetLotBriefVo })
  lot: PointsAssetLotBriefVo;

  @ApiProperty({ description: '消费交易', type: PointsAssetTransactionBriefVo })
  spendTransaction: PointsAssetTransactionBriefVo;
}

export class PointsRefundAllocationVo {
  @ApiProperty({ description: '退款分摊ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '账户ID' })
  accountId: string;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '退款交易ID' })
  refundTransactionId: string;

  @ApiProperty({ description: '原消费交易ID', type: String, nullable: true })
  sourceSpendTransactionId: string | null;

  @ApiProperty({ description: '原消费分摊ID', type: String, nullable: true })
  sourceConsumeAllocationId: string | null;

  @ApiProperty({ description: '来源批次ID', type: String, nullable: true })
  sourceLotId: string | null;

  @ApiProperty({ description: '退回目标批次ID', type: String, nullable: true })
  targetLotId: string | null;

  @ApiProperty({ description: '关联业务ID', type: String, nullable: true })
  relatedId: string | null;

  @ApiProperty({ description: '分摊积分' })
  amount: number;

  @ApiProperty({ description: '退款分摊策略', enum: PointsRefundAllocationStrategy })
  strategy: PointsRefundAllocationStrategy;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '退款交易', type: PointsAssetTransactionBriefVo })
  refundTransaction: PointsAssetTransactionBriefVo;

  @ApiProperty({ description: '原消费交易', type: PointsAssetTransactionBriefVo, nullable: true })
  sourceSpendTransaction: PointsAssetTransactionBriefVo | null;

  @ApiProperty({ description: '来源批次快照', type: PointsAssetLotBriefVo, nullable: true })
  sourceLot: PointsAssetLotBriefVo | null;

  @ApiProperty({ description: '退回目标批次快照', type: PointsAssetLotBriefVo, nullable: true })
  targetLot: PointsAssetLotBriefVo | null;
}

export class PointsDebtVo {
  @ApiProperty({ description: '欠账ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '账户ID', type: String, nullable: true })
  accountId: string | null;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '来源交易ID', type: String, nullable: true })
  sourceTransactionId: string | null;

  @ApiProperty({ description: '关联业务ID', type: String, nullable: true })
  relatedId: string | null;

  @ApiProperty({ description: '关联业务类型', type: String, nullable: true })
  relatedType: string | null;

  @ApiProperty({ description: '欠账原因', enum: PointsDebtReason })
  reason: PointsDebtReason;

  @ApiProperty({ description: '欠账状态', enum: PointsDebtStatus })
  status: PointsDebtStatus;

  @ApiProperty({ description: '应扣积分' })
  expectedAmount: number;

  @ApiProperty({ description: '已扣积分' })
  deductedAmount: number;

  @ApiProperty({ description: '待补账积分' })
  debtAmount: number;

  @ApiProperty({ description: '创建欠账时可用积分' })
  availableAtCreate: number;

  @ApiProperty({ description: '备注', type: String, nullable: true })
  remark: string | null;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '更新时间' })
  updateTime: Date;

  @ApiProperty({ description: '来源交易', type: PointsAssetTransactionBriefVo, nullable: true })
  sourceTransaction: PointsAssetTransactionBriefVo | null;
}
