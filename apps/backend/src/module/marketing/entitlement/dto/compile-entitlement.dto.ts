import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EntitlementPoolType } from './entitlement-definition.dto';

const ENTITLEMENT_PRODUCT_SOURCE_TYPES = ['SCENE', 'CATEGORY', 'RECOMMEND'] as const;
const ALLOWED_TOUCHPOINTS = ['audience', 'product', 'coupon', 'points', 'notification', 'share'] as const;

export type ProductPoolSourceType = (typeof ENTITLEMENT_PRODUCT_SOURCE_TYPES)[number];
export type EntitlementTouchpoint = (typeof ALLOWED_TOUCHPOINTS)[number];
export type CompileEntitlementPoolDto = EntitlementPoolCompileInputDto;

export class EntitlementPoolCompileInputDto {
  @ApiProperty({ description: '权益池类型', enum: ['PRODUCT', 'COUPON', 'POINTS'], example: 'PRODUCT' })
  @IsIn(['PRODUCT', 'COUPON', 'POINTS'])
  poolType: EntitlementPoolType;

  @ApiProperty({ description: '商品池场景类型（商品池必须传）', example: 'SCENE', required: false })
  @IsOptional()
  @IsIn(ENTITLEMENT_PRODUCT_SOURCE_TYPES)
  sourceType?: ProductPoolSourceType;

  @ApiProperty({ description: '商品池/券池/积分池源标识（商品池与券池可使用）', example: 'scene-newcomer', required: false })
  @IsOptional()
  @IsString()
  sourceKey?: string;

  @ApiProperty({ description: '用户ID（商品池预览时需要）', required: false, example: 'member-1' })
  @IsOptional()
  @Type(() => String)
  @IsString()
  memberId?: string;

  @ApiProperty({ description: '积分任务ID（积分池需要）', required: false, example: 'task-signin' })
  @IsOptional()
  @IsString()
  taskId?: string;

  @ApiProperty({ description: '券模板ID（券池需要）', required: false, example: 'tpl-signin' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({ description: '分页页码', required: false, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum?: number;

  @ApiProperty({ description: '分页大小', required: false, example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class CompileEntitlementDto {
  @ApiProperty({
    description: '本次编排目标触点',
    enum: ALLOWED_TOUCHPOINTS,
    type: [String],
    example: ['product', 'coupon', 'points'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsIn(ALLOWED_TOUCHPOINTS, { each: true })
  touchpoints: EntitlementTouchpoint[];

  @ApiProperty({ description: '权益池输入列表', type: [EntitlementPoolCompileInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EntitlementPoolCompileInputDto)
  pools: EntitlementPoolCompileInputDto[];
}
