import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const ORDER_AMOUNT_FREEZE_CUTOFF = new Date('2026-05-17T00:00:00.000Z');

type OrderAmountValue = Decimal | number | string | null | undefined;

export type ProjectableOrderAmounts = {
  totalAmount: OrderAmountValue;
  freightAmount?: OrderAmountValue;
  discountAmount?: OrderAmountValue;
  couponDiscount?: OrderAmountValue;
  pointsDiscount?: OrderAmountValue;
  payAmount?: OrderAmountValue;
  createTime: Date;
};

function amountToNumber(value: OrderAmountValue): number {
  if (value instanceof Decimal) return value.toNumber();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

export function projectOrderAmountFields(order: ProjectableOrderAmounts) {
  const dbDiscount = amountToNumber(order.discountAmount);
  const couponDiscount = amountToNumber(order.couponDiscount);
  const pointsDiscount = amountToNumber(order.pointsDiscount);
  const discountAmount =
    order.createTime < ORDER_AMOUNT_FREEZE_CUTOFF ? dbDiscount + couponDiscount + pointsDiscount : dbDiscount;

  return {
    totalAmount: amountToNumber(order.totalAmount),
    freightAmount: amountToNumber(order.freightAmount),
    discountAmount: Number(discountAmount.toFixed(2)),
    payAmount: amountToNumber(order.payAmount),
  };
}

/**
 * 订单商品项 VO
 */
export class OrderItemVo {
  @ApiProperty({ description: '商品ID' })
  productId: string;

  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiProperty({ description: '商品图片' })
  productImg: string;

  @ApiProperty({ description: 'SKU ID' })
  skuId: string;

  @ApiProperty({ description: '规格数据' })
  specData: Record<string, string> | null;

  @ApiProperty({ description: '单价' })
  price: number;

  @ApiProperty({ description: '数量' })
  quantity: number;

  @ApiProperty({ description: '小计' })
  totalAmount: number;

  @ApiPropertyOptional({ description: '活动上下文键' })
  activityContextKey?: string | null;

  @ApiPropertyOptional({ description: '活动类型' })
  activityType?: string | null;

  @ApiPropertyOptional({ description: '活动名称' })
  activityNameSnapshot?: string | null;

  @ApiPropertyOptional({ description: '活动价格' })
  activityPriceSnapshot?: number | null;
}

/**
 * 结算预览订单项 VO（含完整活动快照，用于落库）
 */
export class CheckoutPreviewItemVo extends OrderItemVo {
  @ApiProperty({ description: '商品类型', enum: ProductType })
  productType: ProductType;

  @ApiPropertyOptional({ description: '原价' })
  originalPrice?: number | null;

  @ApiPropertyOptional({ description: '活动配置ID' })
  activityConfigId?: string | null;

  @ApiPropertyOptional({ description: '活动状态快照' })
  activityStatusSnapshot?: string | null;

  @ApiPropertyOptional({ description: '佣金模式快照' })
  activityCommissionModeSnapshot?: string | null;

  @ApiPropertyOptional({ description: '佣金比例快照' })
  activityCommissionRateSnapshot?: number | null;

  @ApiPropertyOptional({ description: '租户ID' })
  tenantId?: string | null;

  @ApiPropertyOptional({ description: '入口场景编码' })
  entrySceneCode?: string | null;

  @ApiPropertyOptional({ description: '入口模块编码' })
  entryModuleCode?: string | null;

  @ApiPropertyOptional({ description: '卡片模板编码' })
  cardTemplateCode?: string | null;

  @ApiPropertyOptional({ description: '裁决策略编码' })
  resolverPolicyCode?: string | null;

  @ApiPropertyOptional({ description: '场景发布版本号' })
  resolverReleaseNoSnapshot?: number | null;

  @ApiPropertyOptional({ description: '渠道' })
  channel?: string | null;

  @ApiPropertyOptional({ description: '次权益列表' })
  secondaryBenefits?: unknown[] | null;

  @ApiPropertyOptional({ description: '活动版本ID（归因快照）' })
  activityVersionId?: string | null;

  @ApiPropertyOptional({ description: '归因窗口（分钟）' })
  attributionWindowMinutes?: number | null;

  @ApiPropertyOptional({ description: '分享来源渠道' })
  shareChannel?: string | null;

  @ApiPropertyOptional({ description: '购物车来源分享令牌 sid' })
  sid?: string | null;

  @ApiPropertyOptional({ description: '服务端解析后的分享人ID' })
  shareUserId?: string | null;
}

/**
 * 订单详情 VO
 */
export class OrderDetailVo {
  @ApiProperty({ description: '订单ID' })
  id: string;

  @ApiProperty({ description: '订单编号' })
  orderSn: string;

  @ApiProperty({ description: '订单状态' })
  status: string;

  @ApiProperty({ description: '支付状态' })
  payStatus: string;

  @ApiProperty({ description: '订单类型' })
  orderType: string;

  @ApiProperty({ description: '商品总额' })
  totalAmount: number;

  @ApiProperty({ description: '运费' })
  freightAmount: number;

  @ApiProperty({ description: '优惠金额' })
  discountAmount: number;

  @ApiProperty({ description: '应付金额' })
  payAmount: number;

  @ApiPropertyOptional({ description: '收货人' })
  receiverName?: string;

  @ApiPropertyOptional({ description: '收货电话' })
  receiverPhone?: string;

  @ApiPropertyOptional({ description: '收货地址' })
  receiverAddress?: string;

  @ApiPropertyOptional({ description: '预约时间' })
  bookingTime?: Date;

  @ApiPropertyOptional({ description: '服务备注' })
  serviceRemark?: string;

  @ApiPropertyOptional({ description: '支付时间' })
  payTime?: Date;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;

  @ApiProperty({ description: '订单商品', type: [OrderItemVo] })
  items: OrderItemVo[];
}

/**
 * 订单列表项 VO
 */
export class OrderListItemVo {
  @ApiProperty({ description: '订单ID' })
  id: string;

  @ApiProperty({ description: '订单编号' })
  orderSn: string;

  @ApiProperty({ description: '订单状态' })
  status: string;

  @ApiProperty({ description: '应付金额' })
  payAmount: number;

  @ApiProperty({ description: '商品数量' })
  itemCount: number;

  @ApiProperty({ description: '首个商品图片' })
  coverImage: string;

  @ApiProperty({ description: '首个商品名称' })
  productName: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}

/**
 * 结算预览 VO
 */
export class CheckoutPreviewVo {
  @ApiProperty({ description: '商品列表', type: [CheckoutPreviewItemVo] })
  items: CheckoutPreviewItemVo[];

  @ApiProperty({ description: '商品总额' })
  totalAmount: number;

  @ApiProperty({ description: '运费' })
  freightAmount: number;

  @ApiProperty({ description: '优惠金额' })
  discountAmount: number;

  @ApiProperty({ description: '应付金额' })
  payAmount: number;

  @ApiPropertyOptional({ description: '默认收货地址' })
  defaultAddress?: {
    name: string;
    phone: string;
    address: string;
    lat?: number;
    lng?: number;
  };

  @ApiProperty({ description: '是否包含服务商品' })
  hasService: boolean;

  @ApiProperty({ description: '是否超出服务范围' })
  outOfRange?: boolean;
}
