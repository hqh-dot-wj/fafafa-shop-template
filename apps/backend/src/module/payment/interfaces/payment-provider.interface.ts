import { Decimal } from '@prisma/client/runtime/library';

/**
 * 创建支付订单参数
 */
export interface CreatePaymentOrderParams {
  /** 订单号 */
  orderSn: string;

  /** 订单金额（元） */
  amount: Decimal | string;

  /** 订单描述 */
  description: string;

  /** 用户 OpenId */
  openId: string;

  /** 附加数据 */
  attach?: string;

  /** 是否需要分账标记 */
  profitSharing?: boolean;
}

/**
 * 创建支付订单结果
 */
export interface CreatePaymentOrderResult {
  /** 预支付交易会话标识 */
  prepayId: string;

  /** 支付参数（返回给前端） */
  paymentParams: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };
}

/**
 * 订单状态
 */
export enum PaymentOrderStatus {
  /** 未支付 */
  UNPAID = 'UNPAID',
  /** 已支付 */
  PAID = 'PAID',
  /** 已关闭 */
  CLOSED = 'CLOSED',
  /** 已退款 */
  REFUNDED = 'REFUNDED',
}

/**
 * 查询订单结果
 */
export interface QueryPaymentOrderResult {
  /** 订单号 */
  orderSn: string;

  /** 微信支付订单号 */
  transactionId: string;

  /** 订单状态 */
  status: PaymentOrderStatus;

  /** 支付金额（分） */
  amount: number;

  /** 支付时间 */
  payTime?: Date;
}

/**
 * 退款参数
 */
export interface RefundParams {
  /** 订单号 */
  orderSn: string;

  /** 退款单号 */
  refundSn: string;

  /** 退款金额（元） */
  refundAmount: Decimal | string;

  /** 订单总金额（元） */
  totalAmount: Decimal | string;

  /** 退款原因 */
  reason?: string;
}

/**
 * 退款结果
 */
export interface RefundResult {
  /** 退款单号 */
  refundSn: string;

  /** 微信退款单号 */
  refundId: string;

  /** 退款状态 */
  status: RefundStatus;

  /** 退款金额（分） */
  amount: number;

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
 * 退款状态
 */
export enum RefundStatus {
  /** 退款处理中 */
  PROCESSING = 'PROCESSING',
  /** 退款成功 */
  SUCCESS = 'SUCCESS',
  /** 退款失败 */
  FAILED = 'FAILED',
  /** 退款关闭 */
  CLOSED = 'CLOSED',
  /** 退款异常 */
  ABNORMAL = 'ABNORMAL',
}

/**
 * 查询退款结果
 */
export interface QueryRefundResult {
  /** 退款单号 */
  refundSn: string;

  /** 微信退款单号 */
  refundId: string;

  /** 退款状态 */
  status: RefundStatus;

  /** 退款金额（分） */
  amount: number;

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
 * 支付提供商接口
 * 用于抽象不同的支付方式（微信支付、支付宝等）
 */
export interface IPaymentProvider {
  /**
   * 创建支付订单
   */
  createOrder(params: CreatePaymentOrderParams): Promise<CreatePaymentOrderResult>;

  /**
   * 查询订单状态
   */
  queryOrder(orderSn: string): Promise<QueryPaymentOrderResult>;

  /**
   * 申请退款
   */
  refund(params: RefundParams): Promise<RefundResult>;

  /**
   * 查询退款状态
   */
  queryRefund(refundSn: string): Promise<QueryRefundResult>;
}
