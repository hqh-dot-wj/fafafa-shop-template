import { ApiPropertyOptional } from '@nestjs/swagger';
import { MktEntitlementPoolStatus, MktEntitlementPoolType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class ListEntitlementPoolDto extends PageQueryDto {
  @ApiPropertyOptional({ description: '关键词（名称/来源/模板/任务）', example: '新人' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '权益池类型', enum: MktEntitlementPoolType })
  @IsOptional()
  @IsEnum(MktEntitlementPoolType)
  poolType?: MktEntitlementPoolType;

  @ApiPropertyOptional({ description: '编排状态', enum: MktEntitlementPoolStatus })
  @IsOptional()
  @IsEnum(MktEntitlementPoolStatus)
  status?: MktEntitlementPoolStatus;
}

