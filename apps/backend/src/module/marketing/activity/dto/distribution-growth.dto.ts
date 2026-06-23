import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsString, Max, MaxLength, Min } from 'class-validator';

export const DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES = ['MINIAPP', 'H5', 'APP'] as const;
export type DistributionGrowthShareChannel = (typeof DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES)[number];

export class DistributionGrowthDto {
  @ApiProperty({ description: '活动版本ID', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  activityVersionId: string;

  @ApiProperty({ description: '分享渠道', enum: DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES })
  @IsString()
  @IsIn(DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES)
  shareChannel: DistributionGrowthShareChannel;

  @ApiProperty({ description: '分享落地页路径', example: '/pages/marketing/distribution/index', maxLength: 256 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  shareLandingPage: string;

  @ApiProperty({ description: '是否启用推荐码' })
  @IsBoolean()
  referralCodeEnabled: boolean;

  @ApiProperty({ description: '归因窗口（分钟）', minimum: 1 })
  @IsInt()
  @Min(1)
  attributionWindowMinutes: number;

  @ApiProperty({ description: '佣金预算总额（分）', minimum: 1 })
  @IsNumber()
  @Min(1)
  commissionBudgetTotal: number;

  @ApiProperty({ description: '预算预警阈值（百分比）', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  commissionBudgetAlertThreshold: number;

  @ApiProperty({ description: '预算熔断阈值（百分比）', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  commissionBudgetFuseThreshold: number;

  @ApiProperty({ description: '升级触发规则' })
  @IsObject()
  @IsNotEmpty()
  upgradeRule: Record<string, unknown>;

  @ApiProperty({ description: '团队达标规则' })
  @IsObject()
  @IsNotEmpty()
  teamThresholdRule: Record<string, unknown>;
}
