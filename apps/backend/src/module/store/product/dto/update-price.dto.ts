import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsEnum, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { DistributionMode } from '@prisma/client';

export class UpdateProductPriceDto {
  @ApiProperty({ description: '店铺SKU ID' })
  @IsString()
  tenantSkuId: string;

  @ApiProperty({ description: '售价' })
  @IsNumber()
  price: number;

  @ApiProperty({ description: '库存/日接单量' })
  @IsNumber()
  stock: number;

  @ApiProperty({ description: '分销费率/金额' })
  @IsNumber()
  distRate: number;

  @ApiProperty({ description: '分销模式', enum: DistributionMode, required: false })
  @IsOptional()
  @IsEnum(DistributionMode)
  distMode?: string;

  @ApiProperty({ description: '积分获得比例（0-200，100 为正常，可与前台经营配置一致）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  pointsRatio?: number;

  @ApiProperty({ description: '是否营销活动商品', required: false })
  @IsOptional()
  @IsBoolean()
  isPromotionProduct?: boolean;
}
