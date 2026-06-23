import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateActivityItemDto {
  @ApiPropertyOptional({ description: '活动商品ID，不传则自动生成' })
  @IsOptional()
  @IsString()
  activityItemId?: string;

  @ApiProperty({ description: '活动商品类型' })
  @IsString()
  @IsNotEmpty()
  itemType: string;

  @ApiPropertyOptional({ description: '活动商品编码' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '活动商品名称' })
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional({ description: '是否启用', default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '排序，越小越靠前', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sort?: number;

  @ApiPropertyOptional({ description: '活动商品规则配置 JSON' })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '活动商品扩展字段 JSON' })
  @IsOptional()
  @IsObject()
  ext?: Record<string, unknown>;
}
