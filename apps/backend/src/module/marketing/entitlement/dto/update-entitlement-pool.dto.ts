import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { MktEntitlementPoolStatus } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { CreateEntitlementPoolDto } from './create-entitlement-pool.dto';

export class UpdateEntitlementPoolDto extends PartialType(CreateEntitlementPoolDto) {
  @ApiPropertyOptional({ description: '编排状态', enum: MktEntitlementPoolStatus })
  @IsOptional()
  @IsEnum(MktEntitlementPoolStatus)
  status?: MktEntitlementPoolStatus;

  @ApiPropertyOptional({ description: '编译产物', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  compileArtifacts?: string[];

  @ApiPropertyOptional({ description: '风险摘要', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskSummary?: string[];

  @ApiPropertyOptional({ description: '编译预览', type: Object })
  @IsOptional()
  @IsObject()
  compilePreview?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '最近编译时间' })
  @IsOptional()
  @IsDateString()
  lastCompiledAt?: string;
}

