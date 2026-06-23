import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpgradeTriggerSnapshotVo {
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

  @ApiPropertyOptional({ description: '推荐人ID' })
  referrerId?: string | null;

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

  @ApiPropertyOptional({ description: '活动上下文键' })
  activityContextKey?: string | null;

  @ApiProperty({ description: '触发时间' })
  triggerTime: Date;
}

/**
 * 升级申请记录 VO
 */
export class UpgradeApplyVo {
  @ApiProperty({ description: '申请 ID' })
  id: string;

  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '会员 ID' })
  memberId: string;

  @ApiProperty({ description: '原等级 ID' })
  fromLevel: number;

  @ApiProperty({ description: '原等级名称' })
  fromLevelName: string;

  @ApiProperty({ description: '目标等级 ID' })
  toLevel: number;

  @ApiProperty({ description: '目标等级名称' })
  toLevelName: string;

  @ApiProperty({ description: '申请类型: PRODUCT_PURCHASE/REFERRAL_CODE/MANUAL_ADJUST' })
  applyType: string;

  @ApiProperty({ description: '状态: PENDING/APPROVED/REJECTED' })
  status: string;

  @ApiPropertyOptional({ description: '触发快照' })
  triggerSnapshot?: UpgradeTriggerSnapshotVo | null;

  @ApiPropertyOptional({ description: '匹配到的活动版本' })
  matchedActivityVersion?: string | null;

  @ApiProperty({ description: '关联订单 ID', required: false })
  orderId?: string;

  @ApiProperty({ description: '申请时间' })
  createTime: Date;

  @ApiProperty({ description: '会员概览信息' })
  member?: {
    nickname: string;
    mobile: string;
    avatar: string;
  };
}

/**
 * 升级审批统计 VO
 */
export class UpgradeStatsVo {
  @ApiProperty({ description: '待审批申请数' })
  pendingCount: number;

  @ApiProperty({ description: '总申请记录数' })
  totalCount: number;
}
