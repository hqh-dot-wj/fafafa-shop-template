import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';
import { MARKETING_ACTIVITY_STATUS_VALUES, type MarketingActivityStatus } from '../activity-status';

/**
 * 活动列表查询 DTO
 */
export class ActivityQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '关键词，支持活动名称 / 活动ID / 租户ID' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @ApiPropertyOptional({ description: '活动类型' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ description: '活动状态', enum: MARKETING_ACTIVITY_STATUS_VALUES })
  @IsOptional()
  @IsIn(MARKETING_ACTIVITY_STATUS_VALUES)
  status?: MarketingActivityStatus;

  @ApiPropertyOptional({ description: '负责人用户ID' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  ownerUserId?: string;

  @ApiPropertyOptional({ description: '开始时间下界' })
  @IsOptional()
  @IsDateString()
  startTimeFrom?: string;

  @ApiPropertyOptional({ description: '开始时间上界' })
  @IsOptional()
  @IsDateString()
  startTimeTo?: string;

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isEnabled?: boolean;
}
