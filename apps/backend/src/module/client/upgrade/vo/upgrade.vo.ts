import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpgradeTriggerContextVo {
  @ApiPropertyOptional({ description: '活动版本ID' })
  activityVersionId?: string | null;

  @ApiPropertyOptional({ description: '归因窗口（分钟）' })
  attributionWindowMinutes?: number | null;

  @ApiPropertyOptional({ description: '分享渠道' })
  shareChannel?: string | null;

  @ApiPropertyOptional({ description: '入口场景编码' })
  sourceSceneCode?: string | null;

  @ApiPropertyOptional({ description: '入口模块编码' })
  sourceModuleCode?: string | null;

  @ApiPropertyOptional({ description: '入口页面路径' })
  sourcePagePath?: string | null;

  @ApiPropertyOptional({ description: '分享人ID' })
  shareUserId?: string | null;

  @ApiPropertyOptional({ description: '推荐人ID' })
  referrerId?: string | null;

  @ApiPropertyOptional({ description: '活动上下文键' })
  activityContextKey?: string | null;
}

export class UpgradeTriggerSnapshotVo extends UpgradeTriggerContextVo {
  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '申请类型' })
  applyType: string;

  @ApiPropertyOptional({ description: '推荐码' })
  referralCode?: string | null;

  @ApiPropertyOptional({ description: '订单ID' })
  orderId?: string | null;

  @ApiProperty({ description: '触发时间' })
  triggerTime: Date;
}

export class UpgradeTriggerResultVo {
  @ApiProperty({ description: '是否已执行升级' })
  applied: boolean;

  @ApiProperty({ description: '申请ID', nullable: true, required: false })
  applyId: string | null;

  @ApiProperty({ description: '会员ID' })
  memberId: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiProperty({ description: '原等级' })
  fromLevel: number;

  @ApiProperty({ description: '目标等级' })
  toLevel: number;

  @ApiProperty({ description: '申请类型' })
  applyType: string;

  @ApiProperty({ description: '状态: APPROVED/SKIPPED' })
  status: string;

  @ApiPropertyOptional({ description: '推荐码' })
  referralCode?: string | null;

  @ApiPropertyOptional({ description: '订单ID' })
  orderId?: string | null;

  @ApiPropertyOptional({ description: '推荐人ID' })
  referrerId?: string | null;

  @ApiPropertyOptional({ description: '活动版本ID' })
  matchedActivityVersion?: string | null;

  @ApiProperty({ description: '触发快照', type: UpgradeTriggerSnapshotVo })
  triggerSnapshot: UpgradeTriggerSnapshotVo;
}

export class UpgradeApplyVo {
  @ApiProperty({ description: '申请ID' })
  id: string;

  @ApiProperty({ description: '原等级' })
  fromLevel: number;

  @ApiProperty({ description: '目标等级' })
  toLevel: number;

  @ApiProperty({ description: '申请类型' })
  applyType: string;

  @ApiProperty({ description: '状态: PENDING/APPROVED/REJECTED' })
  status: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}

export class ReferralCodeVo {
  @ApiProperty({ description: '推荐码' })
  code: string;

  @ApiProperty({ description: '二维码URL (小程序码)' })
  qrCodeUrl: string | null;

  @ApiProperty({ description: '使用次数' })
  usageCount: number;
}

export class TeamStatsVo {
  @ApiProperty({ description: '我的等级' })
  myLevel: number;

  @ApiProperty({ description: '直接下级数量' })
  directCount: number;

  @ApiProperty({ description: '间接下级数量' })
  indirectCount: number;

  @ApiProperty({ description: '团队总业绩' })
  totalTeamSales: number;

  @ApiProperty({ description: '团队规模（直接+间接）' })
  teamSize: number;

  @ApiProperty({ description: '当前等级' })
  currentLevel: number;

  @ApiProperty({ description: '下一等级', nullable: true, required: false })
  nextLevel: number | null;

  @ApiProperty({ description: '预估佣金', nullable: true, required: false })
  estimatedCommission: number | null;

  @ApiProperty({ description: '匹配到的活动版本', nullable: true, required: false })
  matchedActivityVersion: string | null;
}
