import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from 'src/common/dto';

export class ShipProductFulfillmentItemDto {
  @ApiPropertyOptional({ description: '订单项 ID；不传时按订单内全部实物履约项发货' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  orderItemId?: number;

  @ApiPropertyOptional({ description: 'SKU ID，用于发货信息留痕' })
  @IsOptional()
  @IsString()
  skuId?: string;

  @ApiPropertyOptional({ description: '发货数量；不传时使用订单项购买数量' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({ description: '包裹号' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  packageNo?: string;
}

export class ShipProductFulfillmentDto {
  @ApiProperty({ description: '订单 ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ description: '外部操作幂等号，建议由前端或调用方生成' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  operationId?: string;

  @ApiPropertyOptional({ description: '承运商编码' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  carrierCode?: string;

  @ApiPropertyOptional({ description: '承运商名称' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  carrierName?: string;

  @ApiPropertyOptional({ description: '物流单号' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNo?: string;

  @ApiPropertyOptional({ description: '发货时间；不传时使用当前时间' })
  @IsOptional()
  @IsDateString()
  shippedAt?: string;

  @ApiPropertyOptional({ description: '操作备注' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;

  @ApiPropertyOptional({
    description: '包裹明细；不传时按订单实物履约项生成默认明细',
    type: [ShipProductFulfillmentItemDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ShipProductFulfillmentItemDto)
  items?: ShipProductFulfillmentItemDto[];
}

export class ReceiveProductFulfillmentDto {
  @ApiProperty({ description: '订单 ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ description: '外部操作幂等号' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  operationId?: string;

  @ApiPropertyOptional({ description: '操作备注' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class AssignServiceFulfillmentDto {
  @ApiProperty({ description: '订单 ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({ description: '技师 ID' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  workerId: number;

  @ApiPropertyOptional({ description: '外部操作幂等号' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  operationId?: string;

  @ApiPropertyOptional({ description: '操作备注' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class VerifyServiceFulfillmentDto {
  @ApiProperty({ description: '订单 ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ description: '外部操作幂等号' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  operationId?: string;

  @ApiPropertyOptional({ description: '核销备注' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class ListServiceDispatchDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '订单号模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderSn?: string;

  @ApiPropertyOptional({ description: '收货人手机号模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  receiverPhone?: string;

  @ApiPropertyOptional({ description: '会员 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  memberId?: string;
}

export class ListServiceWorkerCandidatesDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '关键词：姓名、昵称或手机号片段' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  keyword?: string;
}

export class DiagnoseMissingFulfillmentDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '订单状态；不传时检查 PAID / SHIPPED / COMPLETED', enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ description: '订单号模糊搜索' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderSn?: string;
}
