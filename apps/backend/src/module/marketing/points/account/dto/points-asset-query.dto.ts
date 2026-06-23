import { ApiProperty } from '@nestjs/swagger';
import {
  PointsConsumeAllocationStatus,
  PointsDebtReason,
  PointsDebtStatus,
  PointsFreezeAllocationStatus,
  PointsLotStatus,
  PointsRefundAllocationStrategy,
  PointsTransactionType,
} from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PointsAssetPageQueryDto {
  @ApiProperty({ description: '会员ID', required: false })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ description: '账户ID', required: false })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ description: '关联业务ID，如订单ID', required: false })
  @IsOptional()
  @IsString()
  relatedId?: string;

  @ApiProperty({ description: '开始时间', required: false })
  @IsOptional()
  startTime?: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @IsOptional()
  endTime?: Date;

  @ApiProperty({ description: '页码', example: 1, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNum?: number;

  @ApiProperty({ description: '每页数量', example: 10, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class PointsLotQueryDto extends PointsAssetPageQueryDto {
  @ApiProperty({ description: '批次状态', enum: PointsLotStatus, required: false })
  @IsOptional()
  @IsEnum(PointsLotStatus)
  status?: PointsLotStatus;

  @ApiProperty({ description: '来源交易ID', required: false })
  @IsOptional()
  @IsString()
  sourceTransactionId?: string;

  @ApiProperty({ description: '来源交易类型', enum: PointsTransactionType, required: false })
  @IsOptional()
  @IsEnum(PointsTransactionType)
  sourceType?: PointsTransactionType;
}

export class PointsFreezeAllocationQueryDto extends PointsAssetPageQueryDto {
  @ApiProperty({ description: '批次ID', required: false })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiProperty({ description: '冻结交易ID', required: false })
  @IsOptional()
  @IsString()
  freezeTransactionId?: string;

  @ApiProperty({ description: '解冻交易ID', required: false })
  @IsOptional()
  @IsString()
  releaseTransactionId?: string;

  @ApiProperty({ description: '冻结分摊状态', enum: PointsFreezeAllocationStatus, required: false })
  @IsOptional()
  @IsEnum(PointsFreezeAllocationStatus)
  status?: PointsFreezeAllocationStatus;
}

export class PointsConsumeAllocationQueryDto extends PointsAssetPageQueryDto {
  @ApiProperty({ description: '批次ID', required: false })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiProperty({ description: '消费交易ID', required: false })
  @IsOptional()
  @IsString()
  spendTransactionId?: string;

  @ApiProperty({ description: '来源冻结分摊ID', required: false })
  @IsOptional()
  @IsString()
  sourceFreezeAllocationId?: string;

  @ApiProperty({ description: '消费分摊状态', enum: PointsConsumeAllocationStatus, required: false })
  @IsOptional()
  @IsEnum(PointsConsumeAllocationStatus)
  status?: PointsConsumeAllocationStatus;
}

export class PointsRefundAllocationQueryDto extends PointsAssetPageQueryDto {
  @ApiProperty({ description: '退款交易ID', required: false })
  @IsOptional()
  @IsString()
  refundTransactionId?: string;

  @ApiProperty({ description: '原消费交易ID', required: false })
  @IsOptional()
  @IsString()
  sourceSpendTransactionId?: string;

  @ApiProperty({ description: '原消费分摊ID', required: false })
  @IsOptional()
  @IsString()
  sourceConsumeAllocationId?: string;

  @ApiProperty({ description: '来源批次ID', required: false })
  @IsOptional()
  @IsString()
  sourceLotId?: string;

  @ApiProperty({ description: '退回目标批次ID', required: false })
  @IsOptional()
  @IsString()
  targetLotId?: string;

  @ApiProperty({ description: '退款分摊策略', enum: PointsRefundAllocationStrategy, required: false })
  @IsOptional()
  @IsEnum(PointsRefundAllocationStrategy)
  strategy?: PointsRefundAllocationStrategy;
}

export class PointsDebtQueryDto extends PointsAssetPageQueryDto {
  @ApiProperty({ description: '欠账状态', enum: PointsDebtStatus, required: false })
  @IsOptional()
  @IsEnum(PointsDebtStatus)
  status?: PointsDebtStatus;

  @ApiProperty({ description: '欠账原因', enum: PointsDebtReason, required: false })
  @IsOptional()
  @IsEnum(PointsDebtReason)
  reason?: PointsDebtReason;

  @ApiProperty({ description: '来源交易ID', required: false })
  @IsOptional()
  @IsString()
  sourceTransactionId?: string;
}
