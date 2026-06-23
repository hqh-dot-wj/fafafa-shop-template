import { ApiProperty } from '@nestjs/swagger';
import { ProductType, PublishStatus, MarketingStockMode, CommissionMode } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PageQueryDto } from 'src/common/dto/base.dto';

export class StorePlayConfigDto {
  @ApiProperty({ description: '服务/商品ID' })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({ description: '服务类型', enum: ProductType })
  @IsEnum(ProductType)
  serviceType: string;

  @ApiProperty({ description: '玩法模板编码' })
  @IsString()
  @IsNotEmpty()
  templateCode: string;

  @ApiProperty({ description: '营销规则配置' })
  @IsNotEmpty()
  rules: Record<string, unknown>;

  @ApiProperty({ description: '库存策略 (自动计算)', enum: MarketingStockMode, required: false })
  @IsEnum(MarketingStockMode)
  @IsOptional()
  stockMode?: string;

  @ApiProperty({ description: '上下架状态', enum: PublishStatus })
  @IsEnum(PublishStatus)
  @IsOptional()
  status?: string;

  @ApiProperty({ description: '佣金模式', enum: CommissionMode, required: false })
  @IsEnum(CommissionMode)
  @IsOptional()
  commissionMode?: CommissionMode;

  @ApiProperty({ description: '佣金比例', required: false })
  @IsOptional()
  commissionRate?: number;

  @ApiProperty({ description: '是否参与聚合裁决', required: false })
  @IsOptional()
  aggregateEnabled?: boolean;

  @ApiProperty({ description: '是否启用专区', required: false })
  @IsOptional()
  zoneEnabled?: boolean;

  @ApiProperty({ description: '展示优先级', required: false })
  @IsOptional()
  @IsInt()
  displayPriority?: number;
}

export class CreateStorePlayConfigDto extends StorePlayConfigDto {}

export class UpdateStorePlayConfigDto {
  @ApiProperty({ description: '服务/商品ID', required: false })
  @IsString()
  @IsOptional()
  serviceId?: string;

  @ApiProperty({ description: '服务类型', enum: ProductType, required: false })
  @IsEnum(ProductType)
  @IsOptional()
  serviceType?: string;

  @ApiProperty({ description: '玩法模板编码', required: false })
  @IsString()
  @IsOptional()
  templateCode?: string;

  @ApiProperty({ description: '营销规则配置', required: false })
  @IsOptional()
  rules?: Record<string, unknown>;

  @ApiProperty({ description: '规则历史版本', required: false })
  @IsOptional()
  rulesHistory?: Array<{ version?: number; rules?: unknown; operator?: string }>;

  @ApiProperty({ description: '库存策略', enum: MarketingStockMode, required: false })
  @IsEnum(MarketingStockMode)
  @IsOptional()
  stockMode?: string;

  @ApiProperty({ description: '上下架状态', enum: PublishStatus, required: false })
  @IsEnum(PublishStatus)
  @IsOptional()
  status?: string;
}

export class ListStorePlayConfigDto extends PageQueryDto {
  @ApiProperty({ description: '模板编码', required: false })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiProperty({ description: '状态', enum: PublishStatus, required: false })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: string;
}
