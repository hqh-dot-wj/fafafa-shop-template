import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpsertPriorityRuleDto {
  @ApiProperty({ description: '活动类型', example: 'FLASH_SALE' })
  @IsString()
  @IsNotEmpty()
  activityType: string;

  @ApiProperty({ description: '优先级（越大越优先）', example: 100 })
  @IsInt()
  @Min(0)
  @Max(999)
  priority: number;

  @ApiProperty({ description: '是否参与聚合裁决', required: false })
  @IsOptional()
  @IsBoolean()
  aggregateEnabled?: boolean;

  @ApiProperty({ description: '是否启用专区', required: false })
  @IsOptional()
  @IsBoolean()
  zoneEnabled?: boolean;
}
