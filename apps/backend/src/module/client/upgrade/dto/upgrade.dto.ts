import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';

/**
 * 升级链路营销上下文
 * 说明：这些字段只负责透传，不改变现有业务语义。
 */
export class UpgradeAttributionContextDto {
  @ApiPropertyOptional({ description: '活动版本ID' })
  @IsOptional()
  @IsString()
  activityVersionId?: string;

  @ApiPropertyOptional({ description: '归因窗口（分钟）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  attributionWindowMinutes?: number;

  @ApiPropertyOptional({ description: '分享渠道' })
  @IsOptional()
  @IsString()
  shareChannel?: string;

  @ApiPropertyOptional({ description: '入口场景编码' })
  @IsOptional()
  @IsString()
  sourceSceneCode?: string;

  @ApiPropertyOptional({ description: '入口模块编码' })
  @IsOptional()
  @IsString()
  sourceModuleCode?: string;

  @ApiPropertyOptional({ description: '入口页面路径' })
  @IsOptional()
  @IsString()
  sourcePagePath?: string;

  @ApiPropertyOptional({ description: '分享人ID' })
  @IsOptional()
  @IsString()
  shareUserId?: string;

  @ApiPropertyOptional({ description: '推荐人ID（透传字段）' })
  @IsOptional()
  @IsString()
  referrerId?: string;

  @ApiPropertyOptional({ description: '活动上下文键' })
  @IsOptional()
  @IsString()
  activityContextKey?: string;
}

export class ApplyUpgradeDto extends UpgradeAttributionContextDto {
  @ApiProperty({ description: '目标等级: 1=C1团长, 2=C2股东' })
  @IsEnum([1, 2])
  targetLevel: number;

  @ApiProperty({ description: '申请类型: REFERRAL_CODE/PRODUCT_PURCHASE', required: false })
  @IsOptional()
  @IsString()
  applyType?: string;

  @ApiProperty({ description: '推荐码 (扫码申请时)', required: false })
  @IsOptional()
  @IsString()
  referralCode?: string;
}

export class UpgradeByOrderDto extends UpgradeAttributionContextDto {
  @ApiProperty({ description: '订单ID' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '目标等级' })
  targetLevel: number;
}
