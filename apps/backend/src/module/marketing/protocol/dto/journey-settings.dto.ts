import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class JourneyRuleDto {
  @ApiProperty({ description: '规则编码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '规则操作符' })
  @IsString()
  operator: string;

  @ApiProperty({ description: '规则载荷', type: Object, additionalProperties: true })
  @IsObject()
  payload: Record<string, unknown>;
}

export class ReentryPolicyDto {
  @ApiProperty({ enum: ['NEVER', 'WINDOW', 'UNBOUNDED'], description: '回流模式' })
  @IsIn(['NEVER', 'WINDOW', 'UNBOUNDED'])
  mode: 'NEVER' | 'WINDOW' | 'UNBOUNDED';

  @ApiPropertyOptional({ description: '回流窗口小时数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  windowHours?: number;

  @ApiPropertyOptional({ description: '最大进入次数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxEntries?: number;

  @ApiPropertyOptional({ description: '冷却分钟数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  cooldownMinutes?: number;
}

export class ConflictPolicyDto {
  @ApiProperty({ enum: ['PRIORITY', 'MUTEX', 'OVERLAY'], description: '冲突处理模式' })
  @IsIn(['PRIORITY', 'MUTEX', 'OVERLAY'])
  mode: 'PRIORITY' | 'MUTEX' | 'OVERLAY';

  @ApiPropertyOptional({ description: '优先级' })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({ description: '互斥活动编码列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutexCampaignCodes?: string[];
}

export class HoldoutPolicyDto {
  @ApiProperty({ description: '是否启用灰度' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: '灰度比例' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  percentage?: number;
}

export class QuietHoursDto {
  @ApiProperty({ description: '是否启用静默时段' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ enum: ['USER', 'TENANT', 'UTC'], description: '时区策略' })
  @IsOptional()
  @IsIn(['USER', 'TENANT', 'UTC'])
  timezoneStrategy?: 'USER' | 'TENANT' | 'UTC';

  @ApiPropertyOptional({ description: '静默窗口', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  windows?: string[];
}

export class JourneySettingsDto {
  @ApiProperty({ description: '进入规则列表', type: [JourneyRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JourneyRuleDto)
  entryRules: JourneyRuleDto[];

  @ApiProperty({ description: '退出规则列表', type: [JourneyRuleDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JourneyRuleDto)
  exitRules: JourneyRuleDto[];

  @ApiProperty({ description: '回流策略', type: ReentryPolicyDto })
  @ValidateNested()
  @Type(() => ReentryPolicyDto)
  reentryPolicy: ReentryPolicyDto;

  @ApiProperty({ description: '冲突策略', type: ConflictPolicyDto })
  @ValidateNested()
  @Type(() => ConflictPolicyDto)
  conflictPolicy: ConflictPolicyDto;

  @ApiPropertyOptional({ description: '抑制引用', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suppressionRefs?: string[];

  @ApiPropertyOptional({ description: '灰度策略', type: HoldoutPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => HoldoutPolicyDto)
  holdout?: HoldoutPolicyDto;

  @ApiPropertyOptional({ description: '静默时段', type: QuietHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @ApiPropertyOptional({ description: '目标定义', type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  goal?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '同意策略', type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  consentPolicy?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '测试配置', type: Object, additionalProperties: true })
  @IsOptional()
  @IsObject()
  testSettings?: Record<string, unknown>;
}
