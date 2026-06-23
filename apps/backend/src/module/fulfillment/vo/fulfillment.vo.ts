import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FulfillmentAssignmentVo {
  @ApiProperty({ description: '指派记录 ID' })
  id: string;

  @ApiProperty({ description: '技师 ID' })
  workerId: number;

  @ApiProperty({ description: '指派状态' })
  status: string;
}

export class FulfillmentShipmentVo {
  @ApiProperty({ description: '发货记录 ID' })
  id: string;

  @ApiPropertyOptional({ description: '承运商编码' })
  carrierCode?: string | null;

  @ApiPropertyOptional({ description: '承运商名称' })
  carrierName?: string | null;

  @ApiPropertyOptional({ description: '物流单号' })
  trackingNo?: string | null;

  @ApiProperty({ description: '发货状态' })
  status: string;
}

export class FulfillmentEventVo {
  @ApiProperty({ description: '事件 ID' })
  id: string;

  @ApiProperty({ description: '事件类型' })
  eventType: string;

  @ApiPropertyOptional({ description: '流转前状态' })
  fromStatus?: string | null;

  @ApiPropertyOptional({ description: '流转后状态' })
  toStatus?: string | null;

  @ApiProperty({ description: '操作者类型' })
  actorType: string;

  @ApiProperty({ description: '创建时间' })
  createTime: Date;
}

export class FulfillmentOrderVo {
  @ApiProperty({ description: '履约单 ID' })
  id: string;

  @ApiProperty({ description: '订单 ID' })
  orderId: string;

  @ApiProperty({ description: '订单项 ID' })
  orderItemId: number;

  @ApiProperty({ description: '履约类型' })
  type: string;

  @ApiProperty({ description: '履约状态' })
  status: string;

  @ApiPropertyOptional({ description: '完成时间' })
  completedAt?: Date | null;
}

export class FulfillmentOrderDetailVo extends FulfillmentOrderVo {
  @ApiProperty({ description: '发货记录', type: [FulfillmentShipmentVo] })
  shipments: FulfillmentShipmentVo[];

  @ApiProperty({ description: '指派记录', type: [FulfillmentAssignmentVo] })
  assignments: FulfillmentAssignmentVo[];

  @ApiProperty({ description: '履约事件', type: [FulfillmentEventVo] })
  events: FulfillmentEventVo[];
}

export class OrderFulfillmentVo {
  @ApiProperty({ description: '订单 ID' })
  orderId: string;

  @ApiProperty({ description: '订单号' })
  orderSn: string;

  @ApiProperty({ description: '订单主状态' })
  orderStatus: string;

  @ApiProperty({ description: '订单类型' })
  orderType: string;

  @ApiProperty({ description: '履约单列表', type: [FulfillmentOrderDetailVo] })
  fulfillments: FulfillmentOrderDetailVo[];
}

export class MissingFulfillmentDryRunItemVo {
  @ApiProperty({ description: '订单项 ID' })
  orderItemId: number;

  @ApiProperty({ description: '商品 ID' })
  productId: string;

  @ApiProperty({ description: 'SKU ID' })
  skuId: string;

  @ApiProperty({ description: '商品名称' })
  productName: string;

  @ApiProperty({ description: '购买数量' })
  quantity: number;

  @ApiPropertyOptional({ description: '推断出的商品类型' })
  productType?: string | null;

  @ApiProperty({ description: '商品类型来源：SNAPSHOT / SKU_JOIN / ORDER_TYPE / UNKNOWN' })
  productTypeSource: string;

  @ApiPropertyOptional({ description: '计划创建的履约类型' })
  fulfillmentType?: string | null;

  @ApiPropertyOptional({ description: '计划回填的履约状态' })
  plannedStatus?: string | null;

  @ApiProperty({ description: 'dry-run 动作：CREATE_FULFILLMENT / SKIP / REVIEW_REQUIRED' })
  dryRunAction: string;

  @ApiProperty({ description: '该订单项是否可自动回填' })
  canBackfill: boolean;

  @ApiProperty({ description: '阻断原因；为空表示 dry-run 规则允许自动回填', type: [String] })
  blockReasons: string[];
}

export class MissingFulfillmentOrderVo {
  @ApiProperty({ description: '订单 ID' })
  orderId: string;

  @ApiProperty({ description: '订单号' })
  orderSn: string;

  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '订单状态' })
  status: string;

  @ApiProperty({ description: '支付状态' })
  payStatus: string;

  @ApiProperty({ description: '订单类型' })
  orderType: string;

  @ApiPropertyOptional({ description: '订单上的技师 ID' })
  workerId?: number | null;

  @ApiProperty({ description: '订单总订单项数量' })
  totalItemCount: number;

  @ApiProperty({ description: '订单已有履约单数量' })
  existingFulfillmentCount: number;

  @ApiProperty({ description: '缺失履约单的订单项数量' })
  itemCount: number;

  @ApiProperty({ description: '是否存在无法推断商品类型的订单项' })
  hasUnknownItemType: boolean;

  @ApiProperty({ description: '整单是否可自动回填' })
  canBackfill: boolean;

  @ApiProperty({ description: '整单 dry-run 阻断原因；为空表示 dry-run 规则允许自动回填', type: [String] })
  blockReasons: string[];

  @ApiProperty({ description: '订单项 dry-run 回填计划', type: [MissingFulfillmentDryRunItemVo] })
  dryRunItems: MissingFulfillmentDryRunItemVo[];
}
