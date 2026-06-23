import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @ApiProperty({ description: 'SKU ID' })
  @IsString()
  skuId: string;

  @ApiProperty({ description: '数量' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: '购物车行ID（购物车结算时传，用于服务端读取归因 sid）' })
  @IsOptional()
  @IsString()
  cartItemId?: string;

  @ApiPropertyOptional({ description: '活动上下文键' })
  @IsOptional()
  @IsString()
  activityContextKey?: string;

  @ApiPropertyOptional({ description: '玩法实例ID' })
  @IsOptional()
  @IsString()
  playInstanceId?: string;

  @ApiPropertyOptional({ description: '拼课团ID（参团时传）' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: '是否团长（开团时传）' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLeader?: boolean;
}

export class CreateOrderDto {
  @ApiProperty({ description: '租户ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: '订单商品列表', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ description: '收货人姓名' })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({ description: '收货人电话' })
  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @ApiPropertyOptional({ description: '收货地址' })
  @IsOptional()
  @IsString()
  receiverAddress?: string;

  @ApiPropertyOptional({ description: '收货纬度' })
  @IsOptional()
  @Type(() => Number)
  receiverLat?: number;

  @ApiPropertyOptional({ description: '收货经度' })
  @IsOptional()
  @Type(() => Number)
  receiverLng?: number;

  @ApiPropertyOptional({ description: '拼课团ID（全局透传，未按 item 传参时使用）' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ description: '是否团长（全局透传，未按 item 传参时使用）' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isLeader?: boolean;

  @ApiPropertyOptional({ description: '预约时间（服务类）' })
  @IsOptional()
  @Type(() => Date)
  bookingTime?: Date;

  @ApiPropertyOptional({ description: '服务备注' })
  @IsOptional()
  @IsString()
  serviceRemark?: string;

  @ApiPropertyOptional({ description: '订单备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '用户优惠券ID' })
  @IsOptional()
  @IsString()
  userCouponId?: string;

  @ApiPropertyOptional({ description: '使用积分数量' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  pointsUsed?: number;
}

export class CheckoutPreviewDto {
  @ApiProperty({ description: '租户ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: '订单商品列表', type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}

export class ListOrderDto {
  @ApiPropertyOptional({
    description: '订单状态',
    enum: ['PENDING_PAY', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ description: '页码', default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  pageNum: number = 1;

  @ApiProperty({ description: '每页数量', default: 10 })
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  pageSize: number = 10;
}

export class CancelOrderDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiPropertyOptional({ description: '取消原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
