import { Decimal } from '@prisma/client/runtime/library';

/**
 * 预下单参数
 */
export interface PrepayParams {
  /** 订单号 */
  orderSn: string;
  /** 订单金额（元） */
  amount: Decimal | string;
  /** 订单描述 */
  description: string;
  /** 用户 OpenId（微信 JSAPI 必填） */
  openId: string;
  /** 附加数据 */
  attach?: string;

  /** 是否需要开启微信分账标记 */
  profitSharing?: boolean;
}

/**
 * 预下单结果（返回给前端 5 参数）
 */
export interface PrepayResult {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

/**
 * 支付回调验签后的有效载荷
 */
export interface PaymentCallbackPayload {
  /** 商户订单号 */
  orderSn: string;
  /** 微信支付订单号 */
  transactionId: string;
  /** 支付金额（元） */
  payAmount: number;
}

/**
 * 退款回调验签后的有效载荷
 *
 * 单位：所有金额字段为「分」（整数）。
 * undefined 表示「该字段在原始报文中缺失」，上游应按"不更新已有金额"处理，
 * 避免兜底 0 把已落库的金额改写为 0（参见 fin-refund.service.recordStatusUpdate）。
 */
export interface RefundCallbackPayload {
  /** 商户退款单号 */
  refundSn: string;
  /** 微信退款单号 */
  refundId: string;
  /** 退款状态 */
  status: RefundResult['status'];
  /** 退款金额（分），undefined = 字段缺失 */
  amount?: number;
  /** 用户实际退款金额（分） */
  payerRefundAmount?: number;
  /** 商户结算退款金额（分） */
  settlementRefundAmount?: number;
  /** 退款手续费 / 手续费冲减金额（分） */
  refundFeeAmount?: number;
  /** 优惠退款金额（分） */
  discountRefundAmount?: number;
  /** 平台净退款金额（分） */
  netAmount?: number;
  /** 退款成功时间 */
  successTime?: Date;
  /** 渠道原始载荷 */
  rawPayload?: Record<string, unknown>;
}

/**
 * 退款参数
 */
export interface RefundParams {
  orderSn: string;
  refundSn: string;
  refundAmount: Decimal | string;
  totalAmount: Decimal | string;
  reason?: string;
}

/**
 * 退款结果
 *
 * 单位：所有金额字段为「分」（整数）。
 * undefined 表示「该字段在渠道响应中缺失」，上游应按"不更新已有金额"处理。
 */
export interface RefundResult {
  refundSn: string;
  refundId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CLOSED' | 'ABNORMAL';
  /** 退款金额（分），undefined = 字段缺失 */
  amount?: number;
  payerRefundAmount?: number;
  settlementRefundAmount?: number;
  refundFeeAmount?: number;
  discountRefundAmount?: number;
  netAmount?: number;
  successTime?: Date;
  rawPayload?: Record<string, unknown>;
}

export type QueryRefundResult = RefundResult;
