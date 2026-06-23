import { PageQueryDto } from 'src/common/dto';
import { IsOptional, IsString, IsInt, IsEnum, IsArray, ValidateNested, Min, IsBoolean, MaxLength, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, OrderType } from '@prisma/client';

/**
 * 订单批量状态流转目标（仅允许白名单边，避免与核销/退款状态机冲突）
 */
export enum OrderBatchStatusTransitionTarget {
  /** 实物订单：已支付 → 已发货 */
  SHIP = 'SHIP',
  /** 实物订单：已发货 → 已完成（与 C 端确认收货一致，触发佣金 CONFIRM） */
  COMPLETE_RECEIPT = 'COMPLETE_RECEIPT',
}

/**
 * Store端订单列表查询DTO
 */
export class ListStoreOrderDto extends PageQueryDto {
  @ApiProperty({ description: '订单号', required: false })
  @IsOptional()
  @IsString()
  orderSn?: string;

  @ApiProperty({ description: '收货人手机号', required: false })
  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @ApiProperty({ description: '订单状态', enum: OrderStatus, required: false })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: string;

  @ApiProperty({ description: '会员ID', required: false })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ description: '订单类型', enum: OrderType, required: false })
  @IsOptional()
  @IsEnum(OrderType)
  orderType?: string;
}

/**
 * 派单/改派：可指派技师候选列表查询
 */
export class ListDispatchWorkerCandidatesDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '关键词：姓名、昵称或手机号片段' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}

/**
 * 改派技师DTO
 */
export class ReassignWorkerDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '新技师ID' })
  @IsInt()
  @Type(() => Number)
  newWorkerId: number;
}

/**
 * 强制核销DTO
 */
export class VerifyServiceDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '核销备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 订单退款DTO
 */
export class RefundOrderDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '退款原因', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 部分退款订单项
 */
export class PartialRefundItemDto {
  @ApiProperty({ description: '订单项ID' })
  @IsInt()
  @Type(() => Number)
  itemId: number;

  @ApiProperty({ description: '退款数量' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}

/**
 * 部分退款DTO
 */
export class PartialRefundOrderDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '退款订单项列表', type: [PartialRefundItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartialRefundItemDto)
  items: PartialRefundItemDto[];

  @ApiProperty({ description: '退款原因', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 批量核销DTO
 */
export class BatchVerifyDto {
  @ApiProperty({ description: '订单ID列表' })
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({ description: '核销备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 批量退款DTO
 */
export class BatchRefundDto {
  @ApiProperty({ description: '订单ID列表' })
  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({ description: '退款原因', required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}

/**
 * 批量更新订单备注（运营后台）
 */
/**
 * 批量状态流转（实物订单）
 */
export class BatchTransitionOrderStatusDto {
  @ApiProperty({ description: '订单ID列表' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({
    description:
      '流转目标：SHIP=实物已支付→已发货；COMPLETE_RECEIPT=实物已发货→已完成（等同用户确认收货，更新佣金计划结算时间）',
    enum: OrderBatchStatusTransitionTarget,
    enumName: 'OrderBatchStatusTransitionTarget',
  })
  @IsEnum(OrderBatchStatusTransitionTarget)
  target: OrderBatchStatusTransitionTarget;

  @ApiProperty({ description: '操作备注（选填，追加写入订单备注）', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class BatchUpdateOrderRemarkDto {
  @ApiProperty({ description: '订单ID列表' })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  orderIds: string[];

  @ApiProperty({ description: '备注内容（与数据库 oms_order.remark 一致，最长500字）' })
  @IsString()
  @MaxLength(500)
  remark: string;

  @ApiProperty({ description: '是否追加到原备注之后；为 false 时整单替换备注', required: false, default: true })
  @IsOptional()
  @IsBoolean()
  append?: boolean;
}

export { BatchOperationResult, BatchOperationResultItem } from '../../common/dto/batch-operation-result.dto';
