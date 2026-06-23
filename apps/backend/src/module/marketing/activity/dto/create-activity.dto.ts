import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { DistributionGrowthDto } from './distribution-growth.dto';

/**
 * 创建营销活动 DTO
 */
export class CreateActivityDto {
  @ApiProperty({ description: '活动类型', example: 'NEWCOMER_EXCLUSIVE' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  @ApiProperty({ description: '活动名称', example: '新人专享礼包' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: '活动描述', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: '触发条件 JSON' })
  @IsObject()
  @IsNotEmpty()
  triggerCondition: Record<string, unknown>;

  @ApiProperty({ description: '规则 JSON' })
  @IsObject()
  @IsNotEmpty()
  rules: Record<string, unknown>;

  @ApiProperty({ description: '奖励 JSON' })
  @IsObject()
  @IsNotEmpty()
  rewards: Record<string, unknown>;

  @ApiProperty({ description: '分销成长配置', required: false, type: DistributionGrowthDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DistributionGrowthDto)
  distributionGrowth?: DistributionGrowthDto;

  @ApiProperty({ description: '开始时间', required: false })
  @IsOptional()
  startTime?: Date;

  @ApiProperty({ description: '结束时间', required: false })
  @IsOptional()
  endTime?: Date;

  @ApiProperty({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({ description: '活动优先级，数值越大越优先', required: false, default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;
}
