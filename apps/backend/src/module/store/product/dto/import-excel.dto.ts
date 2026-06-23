import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { DistMode } from './import-product.dto';

export class ImportExcelRowDto {
  @ApiProperty({ description: '行号', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rowNo?: number;

  @ApiProperty({ description: '总部商品ID' })
  @IsString()
  productId: string;

  @ApiProperty({ description: '总部SKU ID（回执中会作为 skuCode）' })
  @IsString()
  globalSkuId: string;

  @ApiProperty({ description: '售价' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: '库存' })
  @Type(() => Number)
  @IsNumber()
  stock: number;

  @ApiProperty({ description: '分佣比例', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  distRate?: number;

  @ApiProperty({ description: '分佣模式', enum: DistMode, required: false })
  @IsOptional()
  @IsEnum(DistMode)
  distMode?: DistMode;

  @ApiProperty({
    description: '模板字段值（键为 attr.<字段名>@v<版本>）',
    required: false,
    type: Object,
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  templateAttrs?: Record<string, string>;
}

export class ImportExcelDto {
  @ApiProperty({ description: '分类ID' })
  @Type(() => Number)
  @IsNumber()
  categoryId: number;

  @ApiProperty({ description: '模板版本ID', required: false })
  @IsOptional()
  @IsString()
  templateVersionId?: string;

  @ApiProperty({ description: 'Excel Base64（可选，传则自动解析）', required: false })
  @IsOptional()
  @IsString()
  fileBase64?: string;

  @ApiProperty({ description: '导入行（可选，调试或直传模式）', type: [ImportExcelRowDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportExcelRowDto)
  rows?: ImportExcelRowDto[];
}
