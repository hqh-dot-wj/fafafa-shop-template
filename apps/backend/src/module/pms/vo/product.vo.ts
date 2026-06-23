import { ApiProperty } from '@nestjs/swagger';
import { ProductBuildStatus, ProductType, PublishStatus } from '@prisma/client';
import { TemplateSource } from '../dto';

export class ProductVo {
  @ApiProperty({ description: '商品ID' })
  productId: string;

  @ApiProperty({ description: '商品名称' })
  name: string;

  @ApiProperty({ description: '商品分类ID' })
  categoryId: number;

  @ApiProperty({ description: '品牌ID' })
  brandId?: number;

  @ApiProperty({ description: '副标题' })
  subTitle?: string;

  @ApiProperty({ description: '商品主图', isArray: true, type: String })
  mainImages: string[];

  @ApiProperty({ description: '商品相册(兼容字段)', type: String })
  albumPics: string;

  @ApiProperty({ description: '详情页HTML' })
  detailHtml: string;

  @ApiProperty({ description: '商品类型', enum: ProductType })
  type: string;

  @ApiProperty({ description: '重量(g)' })
  weight?: number;

  @ApiProperty({ description: '是否包邮' })
  isFreeShip?: boolean;

  @ApiProperty({ description: '服务时长(Service Types)' })
  serviceDuration?: number;

  @ApiProperty({ description: '服务半径' })
  serviceRadius?: number;

  @ApiProperty({ description: '是否需要预约' })
  needBooking: boolean;

  @ApiProperty({ description: '上架状态: 0-下架, 1-上架' })
  publishStatus: string;

  @ApiProperty({ description: '价格(起)' })
  price: number;

  @ApiProperty({ description: '默认SKU规格标签', required: false })
  defaultSkuLabel?: string;

  @ApiProperty({ description: '展示名称（商品名+默认规格）', required: false })
  displayName?: string;

  @ApiProperty({ description: '模板来源', enum: TemplateSource, required: false })
  templateSource?: TemplateSource;

  @ApiProperty({ description: '模板ID', required: false })
  templateId?: number;

  @ApiProperty({ description: '构建状态', enum: ProductBuildStatus, required: false })
  buildStatus?: ProductBuildStatus;

  @ApiProperty({ description: '最后编辑步骤', required: false })
  lastEditStep?: number;

  @ApiProperty({ description: '草稿保存时间', required: false })
  draftSavedAt?: Date;

  @ApiProperty({ description: '创建租户ID', required: false })
  creatorTenantId?: string;
}
