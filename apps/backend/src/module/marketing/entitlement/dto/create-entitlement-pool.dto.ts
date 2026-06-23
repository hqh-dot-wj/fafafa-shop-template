import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MktEntitlementPoolType } from '@prisma/client';
import { IsArray, IsEnum, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const ENTITLEMENT_TOUCHPOINTS = ['audience', 'product', 'coupon', 'points', 'notification', 'share'] as const;
export type EntitlementPoolTouchpoint = (typeof ENTITLEMENT_TOUCHPOINTS)[number];

export class CreateEntitlementPoolDto {
  @ApiProperty({ description: '权益池名称', example: '新人礼-券池' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @ApiProperty({ description: '权益池类型', enum: MktEntitlementPoolType })
  @IsEnum(MktEntitlementPoolType)
  poolType: MktEntitlementPoolType;

  @ApiProperty({ description: '触点列表', type: [String], example: ['coupon'] })
  @IsArray()
  @IsIn(ENTITLEMENT_TOUCHPOINTS, { each: true })
  touchpoints: EntitlementPoolTouchpoint[];

  @ApiPropertyOptional({ description: '商品池来源类型', example: 'SCENE' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: '来源标识（场景码/商品ID）', example: 'HF_SCENE_HOME' })
  @IsOptional()
  @IsString()
  sourceKey?: string;

  @ApiPropertyOptional({ description: '会员ID', example: 'member-001' })
  @IsOptional()
  @IsString()
  memberId?: string;

  @ApiPropertyOptional({ description: '券模板ID', example: 'tpl-signin' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: '券模板名称', example: '签到券模板' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiPropertyOptional({ description: '积分任务ID', example: 'task-signin' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiPropertyOptional({ description: '积分任务名称', example: '每日签到积分' })
  @IsOptional()
  @IsString()
  taskName?: string;
}

