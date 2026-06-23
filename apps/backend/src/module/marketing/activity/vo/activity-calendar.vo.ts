import { ApiProperty } from '@nestjs/swagger';
import { ActivityVo } from './activity.vo';

export class ActivityCalendarDayVo {
  @ApiProperty({ description: '日期', example: '2026-04-12' })
  date: string;

  @ApiProperty({ description: '当日活动数' })
  total: number;

  @ApiProperty({ description: '是否存在冲突' })
  hasConflict: boolean;

  @ApiProperty({ description: '当日活动列表', type: [ActivityVo] })
  items: ActivityVo[];
}

export class ActivityCalendarConflictVo {
  @ApiProperty({ description: '冲突日期', example: '2026-04-12' })
  date: string;

  @ApiProperty({ description: '冲突活动数' })
  count: number;

  @ApiProperty({ description: '冲突活动ID列表', type: [String] })
  activityIds: string[];
}

export class ActivityCalendarVo {
  @ApiProperty({ description: '查询月份', example: '2026-04' })
  month: string;

  @ApiProperty({ description: '按天聚合的日历视图', type: [ActivityCalendarDayVo] })
  days: ActivityCalendarDayVo[];

  @ApiProperty({ description: '冲突摘要', type: [ActivityCalendarConflictVo] })
  conflicts: ActivityCalendarConflictVo[];
}
