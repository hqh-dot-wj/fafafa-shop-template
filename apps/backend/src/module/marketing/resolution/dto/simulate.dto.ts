import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum SimulationExecutionMode {
  PREVIEW = 'PREVIEW',
  REPLAY = 'REPLAY',
  COMMIT = 'COMMIT',
}

export class DelayCompressionDto {
  @ApiPropertyOptional({ description: '是否启用延时压缩', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  enabled?: boolean = false;

  @ApiPropertyOptional({ description: '压缩比例', default: 1, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  ratio?: number = 1;

  @ApiPropertyOptional({ description: '最大时间间隔（毫秒）', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxGapMs?: number;
}

export class SimulateDto {
  @ApiProperty({ description: '租户 ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: '商品 ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: '会员 ID', required: false })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiProperty({ description: '模拟时间（ISO 格式）', required: false })
  @IsOptional()
  @IsString()
  simulateTime?: string;

  @ApiProperty({ description: '是否新客', required: false })
  @IsOptional()
  @IsBoolean()
  isNewcomer?: boolean;

  @ApiProperty({ description: '会员等级', required: false })
  @IsOptional()
  @IsString()
  memberLevel?: string;

  @ApiPropertyOptional({ description: '执行模式', enum: SimulationExecutionMode, default: SimulationExecutionMode.PREVIEW })
  @IsOptional()
  @IsEnum(SimulationExecutionMode)
  executionMode?: SimulationExecutionMode = 'PREVIEW' as SimulationExecutionMode;

  @ApiPropertyOptional({ description: '场景编码', default: 'RUN_CENTER_BASIC' })
  @IsOptional()
  @IsString()
  scenarioCode?: string = 'RUN_CENTER_BASIC';

  @ApiPropertyOptional({ description: '样例事件 ID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleEventIds?: string[];

  @ApiPropertyOptional({ description: '延时压缩配置', type: DelayCompressionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DelayCompressionDto)
  delayCompression?: DelayCompressionDto;

  @ApiPropertyOptional({ description: '是否输出探针步骤', default: false })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  probeEnabled?: boolean = false;
}
