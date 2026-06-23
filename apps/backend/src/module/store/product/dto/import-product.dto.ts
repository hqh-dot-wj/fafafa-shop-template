import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum DistMode {
  RATIO = 'RATIO',
  FIXED = 'FIXED',
  NONE = 'NONE',
}

export class ImportSkuDto {
  @ApiProperty({ description: 'Global SKU ID' })
  @IsString()
  globalSkuId: string;

  @ApiProperty({ description: 'Store Sale Price' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: 'Stock or Daily Capacity' })
  @IsNumber()
  stock: number;

  @ApiProperty({ description: 'Distribution Rate', required: false })
  @IsOptional()
  @IsNumber()
  distRate?: number;

  @ApiProperty({ description: 'Distribution Mode', enum: DistMode, required: false })
  @IsOptional()
  @IsEnum(DistMode)
  distMode?: DistMode;
}

export class ImportProductDto {
  @ApiProperty({ description: 'Global Product ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: 'Override Service Radius (Meters)', required: false })
  @IsOptional()
  @IsNumber()
  overrideRadius?: number;

  @ApiProperty({ description: '分类ID（导入上下文，可选）', required: false })
  @IsOptional()
  @IsNumber()
  categoryId?: number;

  @ApiProperty({ description: '模板版本ID（可选）', required: false })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiProperty({ description: 'SKU Configurations', type: [ImportSkuDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportSkuDto)
  skus: ImportSkuDto[];
}
