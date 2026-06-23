import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';
import { ActivityQueryDto } from './activity-query.dto';

export class ActivityCalendarQueryDto extends ActivityQueryDto {
  @ApiPropertyOptional({ description: '月份，格式 YYYY-MM', example: '2026-04' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @ApiPropertyOptional({ description: '时间窗开始时间' })
  @IsOptional()
  @IsDateString()
  rangeStart?: string;

  @ApiPropertyOptional({ description: '时间窗结束时间' })
  @IsOptional()
  @IsDateString()
  rangeEnd?: string;
}
