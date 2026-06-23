import { ApiProperty } from '@nestjs/swagger';
import { PublishStatus, ProductType, DistributionMode, StoreProductAuditStatus } from '@prisma/client';
import { SpecValues } from 'src/common/types';

export class StoreSkuVo {
  @ApiProperty({ description: '店铺SKU ID' })
  id: string;

  @ApiProperty({ description: '售价' })
  price: number;

  @ApiProperty({ description: '库存/日接单量' })
  stock: number;

  @ApiProperty({ description: '分佣模式', enum: DistributionMode })
  distMode: string;

  @ApiProperty({ description: '分佣比例/金额' })
  distRate: number;

  @ApiProperty({ description: '是否有效' })
  isActive: boolean;

  @ApiProperty({
    description: '规格值',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { 颜色: '红色', 尺寸: 'XL' },
  })
  specValues: SpecValues;

  @ApiProperty({ description: '成本价' })
  costPrice: number;

  @ApiProperty({ description: '总部指导价' })
  guidePrice: number;

  @ApiProperty({ description: '积分获得比例（0-200，100 为正常）', required: false })
  pointsRatio?: number;

  @ApiProperty({ description: '是否营销活动商品', required: false })
  isPromotionProduct?: boolean;
}

export class StoreProductVo {
  @ApiProperty({ description: '店铺商品ID' })
  id: string;

  @ApiProperty({ description: '商品ID(全局)' })
  productId: string;

  @ApiProperty({ description: '商品名称(关联)' })
  name: string;

  @ApiProperty({ description: '商品图片(关联)', type: String })
  albumPics: string;

  @ApiProperty({ description: '产品类型', enum: ProductType })
  type: string;

  @ApiProperty({ description: '上架状态', enum: PublishStatus })
  status: string;

  @ApiProperty({ description: '审核状态', enum: StoreProductAuditStatus })
  auditStatus: string;

  @ApiProperty({ description: '驳回原因', required: false })
  auditReason?: string;

  @ApiProperty({ description: '提审时间', required: false })
  submittedAt?: Date;

  @ApiProperty({ description: '模板版本ID', required: false })
  templateVersionId?: string;

  @ApiProperty({ description: '是否热销' })
  isHot: boolean;

  @ApiProperty({ description: '售价(起)' })
  price: number;

  @ApiProperty({ description: '自定义标题' })
  customTitle?: string;

  @ApiProperty({ description: '覆盖服务半径' })
  overrideRadius?: number;

  @ApiProperty({
    description: '营销/积分展示用（取首个 SKU，多规格时以列表内各 SKU 为准）',
    required: false,
  })
  pointsRatio?: number;

  @ApiProperty({ description: '是否营销商品（取首个 SKU）', required: false })
  isPromotionProduct?: boolean;

  @ApiProperty({ description: 'SKU列表', type: [StoreSkuVo] })
  skus: StoreSkuVo[];
}
