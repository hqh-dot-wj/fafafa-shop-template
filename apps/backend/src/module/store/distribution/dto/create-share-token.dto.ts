import { DistShareBizType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateShareTokenDto {
  @ApiProperty({ description: '分享人会员ID', example: 'member_001' })
  @IsString()
  @MaxLength(64)
  shareUserId: string;

  @ApiProperty({ description: '业务类型', enum: DistShareBizType, example: DistShareBizType.PRODUCT })
  @IsEnum(DistShareBizType)
  bizType: DistShareBizType;

  @ApiProperty({ description: '业务ID（如商品ID/活动ID）', example: 'product_1001' })
  @IsString()
  @MaxLength(64)
  bizId: string;

  @ApiPropertyOptional({ description: '覆盖策略：链接有效期（分钟）', example: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  linkExpireMinutes?: number;

  @ApiPropertyOptional({ description: '覆盖策略：点击上限', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxClickCount?: number;

  @ApiPropertyOptional({ description: '覆盖策略：绑定上限', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBindCount?: number;

  @ApiPropertyOptional({ description: '覆盖策略：归因订单上限', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOrderCount?: number;

  @ApiPropertyOptional({
    description: '扩展元数据（可透传页面路径、活动上下文等）',
    type: Object,
    example: { pagePath: 'pages/product/detail', activityContextKey: 'ctx_001' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
