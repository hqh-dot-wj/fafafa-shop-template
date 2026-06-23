import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { WechatPayService } from '../wechat-pay.service';
import { PaymentGatewayPort } from '../ports/payment-gateway.port';
import {
  PrepayParams,
  PrepayResult,
  PaymentCallbackPayload,
  RefundCallbackPayload,
  RefundParams,
  RefundResult,
  QueryRefundResult,
} from '../interfaces/payment-gateway.types';

/**
 * 微信支付 Adapter
 *
 * 将 PaymentGatewayPort 映射到 WechatPayService (IPaymentProvider)
 *
 * @see https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/direct-jsons/jsapi-prepay.html
 * @see https://pay.weixin.qq.com/docs/merchant/apis/jsapi-payment/payment-notice.html
 */
@Injectable()
export class WechatPayAdapter extends PaymentGatewayPort {
  private readonly logger = new Logger(WechatPayAdapter.name);

  constructor(
    private readonly wechatPayService: WechatPayService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async prepay(params: PrepayParams): Promise<PrepayResult> {
    const result = await this.wechatPayService.createOrder({
      orderSn: params.orderSn,
      amount: params.amount,
      description: params.description,
      openId: params.openId,
      attach: params.attach,
      profitSharing: params.profitSharing,
    });

    return result.paymentParams;
  }

  async handleCallback(headers: Record<string, string>, body: string): Promise<PaymentCallbackPayload> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    try {
      const parsed = await this.wechatPayService.parsePaymentCallback(headers, body);
      return {
        orderSn: parsed.orderSn,
        transactionId: parsed.transactionId,
        payAmount: parsed.payAmount,
      };
    } catch (error) {
      if (isProd) {
        throw error;
      }

      this.logger.warn(`[WechatPayAdapter] 支付回调验签失败，开发环境回退到 JSON 解析: ${String(error)}`);
      const data = JSON.parse(body) as Record<string, unknown>;
      return {
        orderSn: (data.out_trade_no ?? data.orderSn) as string,
        transactionId: (data.transaction_id ?? data.transactionId) as string,
        payAmount: this.parseAmount(data),
      };
    }
  }

  async handleRefundCallback(headers: Record<string, string>, body: string): Promise<RefundCallbackPayload> {
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    try {
      const parsed = await this.wechatPayService.parseRefundCallback(headers, body);
      return {
        refundSn: parsed.refundSn,
        refundId: parsed.refundId,
        status: parsed.status as RefundCallbackPayload['status'],
        amount: parsed.amount,
        payerRefundAmount: parsed.payerRefundAmount,
        settlementRefundAmount: parsed.settlementRefundAmount,
        refundFeeAmount: parsed.refundFeeAmount,
        discountRefundAmount: parsed.discountRefundAmount,
        netAmount: parsed.netAmount,
        successTime: parsed.successTime,
        rawPayload: parsed.rawPayload,
      };
    } catch (error) {
      if (isProd) {
        throw error;
      }

      this.logger.warn(`[WechatPayAdapter] 退款回调验签失败，开发环境回退到 JSON 解析: ${String(error)}`);
      const data = JSON.parse(body) as Record<string, unknown>;
      return {
        refundSn: (data.out_refund_no ?? data.refundSn) as string,
        refundId: (data.refund_id ?? data.refundId ?? '') as string,
        status: ((data.refund_status ?? data.status) as RefundCallbackPayload['status']) || 'PROCESSING',
        amount: this.parseRefundAmount(data),
        ...this.parseRefundAmountBreakdown(data),
        successTime: data.success_time ? new Date(data.success_time as string) : undefined,
        rawPayload: data,
      };
    }
  }

  private parseAmount(data: Record<string, unknown>): number {
    if (typeof data.payAmount === 'number') return data.payAmount;
    const amt = data.amount as { total?: number } | undefined;
    if (amt?.total != null) return amt.total / 100;
    return 0;
  }

  private parseRefundAmount(data: Record<string, unknown>): number | undefined {
    // 仅在真正的"退款金额"字段中找 fallback；refund_fee 是"手续费"概念，
    // 不能作为退款金额的 fallback（否则会把手续费当退款额写入金额列）。
    // 字段全部缺失时返回 undefined，避免兜底 0 把已落库的退款金额改写为 0。
    if (typeof data.amount === 'number' && Number.isFinite(data.amount)) return data.amount;
    const amount = data.amount as { refund?: number; payer_refund?: number; settlement_refund?: number } | undefined;
    if (amount?.refund != null) return amount.refund;
    if (amount?.payer_refund != null) return amount.payer_refund;
    if (amount?.settlement_refund != null) return amount.settlement_refund;
    return undefined;
  }

  private parseRefundAmountBreakdown(data: Record<string, unknown>) {
    const amount =
      typeof data.amount === 'object' && data.amount != null
        ? (data.amount as {
            refund?: number;
            payer_refund?: number;
            settlement_refund?: number;
            refund_fee?: number;
            discount_refund?: number;
            net_amount?: number;
          })
        : undefined;
    const payerRefundAmount = this.readFen(amount?.payer_refund ?? amount?.refund ?? data.amount);
    const refundFeeAmount = this.readFen(amount?.refund_fee ?? data.refund_fee);
    const settlementRefundAmount = this.readFen(amount?.settlement_refund);
    const discountRefundAmount = this.readFen(amount?.discount_refund ?? data.discount_refund);
    const explicitNetAmount = this.readFen(amount?.net_amount ?? data.net_amount);
    const netAmount =
      explicitNetAmount ??
      settlementRefundAmount ??
      (payerRefundAmount == null ? undefined : payerRefundAmount - (refundFeeAmount ?? 0));

    return {
      // 字段缺失统一保留 undefined（与 payerRefundAmount/settlementRefundAmount 对称），
      // 避免兜底 0 经 fenToYuan(0)=0.00 清零已落库的 fee/discount。
      payerRefundAmount,
      settlementRefundAmount,
      refundFeeAmount,
      discountRefundAmount,
      netAmount,
    };
  }

  private readFen(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    const result = await this.wechatPayService.refund({
      orderSn: params.orderSn,
      refundSn: params.refundSn,
      refundAmount: params.refundAmount,
      totalAmount: params.totalAmount,
      reason: params.reason,
    });

    return {
      refundSn: result.refundSn,
      refundId: result.refundId,
      status: result.status as RefundResult['status'],
      amount: result.amount,
      payerRefundAmount: result.payerRefundAmount,
      settlementRefundAmount: result.settlementRefundAmount,
      refundFeeAmount: result.refundFeeAmount,
      discountRefundAmount: result.discountRefundAmount,
      netAmount: result.netAmount,
      successTime: result.successTime,
      rawPayload: result.rawPayload,
    };
  }

  async queryPaymentStatus(orderSn: string) {
    const result = await this.wechatPayService.queryOrder(orderSn);
    return {
      orderSn: result.orderSn,
      transactionId: result.transactionId,
      status: result.status,
      payAmount: result.amount / 100,
      payTime: result.payTime,
    };
  }

  async queryRefund(refundSn: string): Promise<QueryRefundResult> {
    const result = await this.wechatPayService.queryRefund(refundSn);
    return {
      refundSn: result.refundSn,
      refundId: result.refundId,
      status: result.status as QueryRefundResult['status'],
      amount: result.amount,
      payerRefundAmount: result.payerRefundAmount,
      settlementRefundAmount: result.settlementRefundAmount,
      refundFeeAmount: result.refundFeeAmount,
      discountRefundAmount: result.discountRefundAmount,
      netAmount: result.netAmount,
      successTime: result.successTime,
      rawPayload: result.rawPayload,
    };
  }
}
