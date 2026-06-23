import { ApiProperty } from '@nestjs/swagger';

export class ActivityDashboardSummaryVo {
  @ApiProperty({ description: '活动总数' })
  total: number;

  @ApiProperty({ description: '已发布活动数' })
  published: number;

  @ApiProperty({ description: '已暂停活动数' })
  paused: number;

  @ApiProperty({ description: '已归档活动数' })
  archived: number;

  @ApiProperty({ description: '草稿活动数' })
  draft: number;
}

export class ActivityDashboardTrendVo {
  @ApiProperty({ description: '日期', example: '2026-04-10' })
  date: string;

  @ApiProperty({ description: '当日活动总数' })
  total: number;

  @ApiProperty({ description: '当日已发布活动数' })
  published: number;

  @ApiProperty({ description: '当日已暂停活动数' })
  paused: number;

  @ApiProperty({ description: '当日已归档活动数' })
  archived: number;

  @ApiProperty({ description: '当日草稿活动数' })
  draft: number;
}

export class ActivityDashboardVo {
  @ApiProperty({ description: '聚合摘要', type: ActivityDashboardSummaryVo })
  summary: ActivityDashboardSummaryVo;

  @ApiProperty({ description: '趋势数据', type: [ActivityDashboardTrendVo] })
  trend: ActivityDashboardTrendVo[];
}
