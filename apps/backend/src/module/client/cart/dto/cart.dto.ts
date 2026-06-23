import { IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 添加购物车 DTO
 */
export class AddCartDto {
  @ApiProperty({ description: '租户ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'SKU ID' })
  @IsString()
  skuId: string;

  @ApiProperty({ description: '数量', default: 1 })
  @IsInt()
  @Min(1)
  quantity: number = 1;

  @ApiPropertyOptional({ description: '分享令牌 sid（归因追踪）' })
  @IsOptional()
  @IsString()
  sid?: string;

  @ApiPropertyOptional({ description: '活动上下文键' })
  @IsOptional()
  @IsString()
  activityContextKey?: string;

  @ApiPropertyOptional({ description: '入口来源' })
  @IsOptional()
  @IsString()
  entrySource?: string;
}

/**
 * 更新购物车数量 DTO
 */
export class UpdateCartQuantityDto {
  @ApiProperty({ description: 'SKU ID' })
  @IsString()
  skuId: string;

  @ApiProperty({ description: '新数量' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: '活动上下文键（多活动拆行时必传，缺省匹配无活动上下文行）' })
  @IsOptional()
  @IsString()
  activityContextKey?: string;
}
