import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MARKETING_ACTIVITY_STATUS_VALUES, type MarketingActivityStatus } from '../activity-status';
import { DistributionGrowthVo } from './distribution-growth.vo';
import { TouchpointVo } from './touchpoint.vo';

export class ActivityVo {
  @ApiProperty({ description: '活动ID' })
  id: string;

  @ApiProperty({ description: '租户ID' })
  tenantId: string;

  @ApiPropertyOptional({ description: '租户名称（列表 / 详情聚合）' })
  tenantName?: string;

  @ApiProperty({ description: '活动类型' })
  type: string;

  @ApiProperty({ description: '活动名称' })
  name: string;

  @ApiPropertyOptional({ description: '活动描述' })
  description?: string;

  @ApiProperty({ description: '触发条件' })
  triggerCondition: Record<string, unknown>;

  @ApiProperty({ description: '规则' })
  rules: Record<string, unknown>;

  @ApiProperty({ description: '奖励' })
  rewards: Record<string, unknown>;

  @ApiPropertyOptional({ description: '开始时间' })
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间' })
  endTime?: string;

  @ApiProperty({ description: '是否启用' })
  isEnabled: boolean;

  @ApiProperty({ description: '活动状态', enum: MARKETING_ACTIVITY_STATUS_VALUES })
  status: MarketingActivityStatus;

  @ApiProperty({ description: '触达配置列表（消息 / 分享）', type: [TouchpointVo] })
  touchpoints: TouchpointVo[];

  @ApiPropertyOptional({ description: '分销成长配置快照', type: DistributionGrowthVo })
  distributionGrowth?: DistributionGrowthVo | null;

  @ApiProperty({ description: '优先级' })
  priority: number;

  @ApiProperty({ description: '创建时间' })
  createTime: string;

  @ApiProperty({ description: '更新时间' })
  updateTime: string;
}

export class ActivityListVo {
  @ApiProperty({ description: '活动列表', type: [ActivityVo] })
  rows: ActivityVo[];

  @ApiProperty({ description: '总条数' })
  total: number;
}
