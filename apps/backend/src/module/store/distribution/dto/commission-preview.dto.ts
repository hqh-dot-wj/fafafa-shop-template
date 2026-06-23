import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES } from 'src/module/marketing/activity/dto/distribution-growth.dto';
import { CommissionBudgetSnapshotVo } from '../vo/dashboard.vo';

export class CommissionPreviewItemDto {
  @ApiProperty({ description: 'SKU ID' })
  @IsString()
  skuId: string;

  @ApiProperty({ description: '购买数量', example: 1 })
  @IsOptional()
  quantity?: number;
}

export class CommissionPreviewShareContextDto {
  @ApiProperty({ description: '分享渠道', enum: DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES, required: false })
  @IsOptional()
  @IsString()
  @IsIn(DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES)
  shareChannel?: (typeof DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES)[number];

  @ApiProperty({ description: '分享落地页路径', required: false, maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  shareLandingPage?: string;

  @ApiProperty({ description: '是否启用推荐码', required: false })
  @IsOptional()
  @IsBoolean()
  referralCodeEnabled?: boolean;

  @ApiProperty({ description: '归因窗口（分钟）', required: false, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionWindowMinutes?: number;
}

export class CommissionPreviewUpgradeContextDto {
  @ApiProperty({ description: '当前等级ID', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentLevelId?: number;

  @ApiProperty({ description: '目标等级ID', required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  targetLevelId?: number;

  @ApiProperty({ description: '是否满足升级条件', required: false })
  @IsOptional()
  @IsBoolean()
  canUpgrade?: boolean;
}

export class CommissionPreviewDto {
  @ApiProperty({ description: '下单门店ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: '商品SKU列表', type: [CommissionPreviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionPreviewItemDto)
  items: CommissionPreviewItemDto[];

  @ApiProperty({ description: '活动版本ID', required: false, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  activityVersionId?: string;

  @ApiProperty({ description: '分享上下文', required: false, type: CommissionPreviewShareContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionPreviewShareContextDto)
  shareContext?: CommissionPreviewShareContextDto;

  @ApiProperty({ description: '升级上下文', required: false, type: CommissionPreviewUpgradeContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CommissionPreviewUpgradeContextDto)
  upgradeContext?: CommissionPreviewUpgradeContextDto;

  @ApiProperty({ description: '分享人ID (可选)', required: false })
  @IsOptional()
  @IsString()
  shareUserId?: string;
}

export class CommissionPreviewVo extends CommissionBudgetSnapshotVo {
  @ApiProperty({ description: '门店名称' })
  tenantName: string;

  @ApiProperty({ description: '佣金比例' })
  commissionRate: string;

  @ApiProperty({ description: '是否本店推荐人' })
  isLocalReferrer: boolean;

  @ApiProperty({ description: '门店是否开启跨店分销' })
  isCrossEnabled: boolean;

  @ApiProperty({ description: '预估佣金金额' })
  estimatedAmount: number;

  @ApiProperty({ description: '提示文案 (跨店时显示)', required: false })
  notice?: string;
}
