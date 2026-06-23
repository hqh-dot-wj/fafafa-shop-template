import { ApiProperty } from '@nestjs/swagger';
import { DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES, DistributionGrowthShareChannel } from '../dto/distribution-growth.dto';

export class DistributionGrowthVo {
  @ApiProperty({ description: '活动版本ID' })
  activityVersionId: string;

  @ApiProperty({ description: '分享渠道', enum: DISTRIBUTION_GROWTH_SHARE_CHANNEL_VALUES })
  shareChannel: DistributionGrowthShareChannel;

  @ApiProperty({ description: '分享落地页路径' })
  shareLandingPage: string;

  @ApiProperty({ description: '是否启用推荐码' })
  referralCodeEnabled: boolean;

  @ApiProperty({ description: '归因窗口（分钟）' })
  attributionWindowMinutes: number;

  @ApiProperty({ description: '佣金预算总额（分）' })
  commissionBudgetTotal: number;

  @ApiProperty({ description: '预算预警阈值（百分比）' })
  commissionBudgetAlertThreshold: number;

  @ApiProperty({ description: '预算熔断阈值（百分比）' })
  commissionBudgetFuseThreshold: number;

  @ApiProperty({ description: '升级触发规则' })
  upgradeRule: Record<string, unknown>;

  @ApiProperty({ description: '团队达标规则' })
  teamThresholdRule: Record<string, unknown>;
}
