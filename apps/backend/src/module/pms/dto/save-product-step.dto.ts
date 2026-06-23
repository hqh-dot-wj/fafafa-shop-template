import { ApiProperty } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

export enum ProductDraftStep {
  CATEGORY = 1,
  BASE_INFO = 2,
  SKU = 3,
  ATTR = 4,
}

/**
 * 商品分步保存 DTO
 * - productId 为空时创建草稿
 * - productId 有值时更新草稿/编辑中商品
 */
export class SaveProductStepDto extends PartialType(CreateProductDto) {
  @ApiProperty({ description: '商品ID（为空表示创建草稿）', required: false })
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiProperty({ description: '当前步骤(1-4)', minimum: 1, maximum: 4 })
  @IsInt()
  @Min(1)
  @Max(4)
  step: number;
}
