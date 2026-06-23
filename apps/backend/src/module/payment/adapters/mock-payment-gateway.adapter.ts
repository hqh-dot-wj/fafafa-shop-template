import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { toFen } from '@libs/common-utils';
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
 * Mock 支付网关
 *
 * 用于测试/开发环境，不调用真实支付 API
 * - prepay: 返回模拟支付参数
 * - handleCallback: 接受任意 body（JSON），解析 orderSn/transactionId/payAmount
 * - refund: 模拟成功
 * - queryPaymentStatus: 返回 PAID
 */
@Injectable()
export class MockPaymentGatewayAdapter extends PaymentGatewayPort {
  private readonly logger = new Logger(MockPaymentGatewayAdapter.name);

  async prepay(params: PrepayParams): Promise<PrepayResult> {
    this.logger.log(`[Mock] prepay: ${params.orderSn}, 金额: ${params.amount}`);

    const nonceStr = crypto.randomBytes(16).toString('hex').slice(0, 32);
    const prepayId = `wx_mock_${Date.now()}_${nonceStr.slice(0, 8)}`;

    return {
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      nonceStr,
      package: `prepay_id=${prepayId}`,
      signType: 'RSA',
      paySign: 'mock_pay_sign_' + crypto.randomBytes(8).toString('hex'),
    };
  }

  async handleCallback(headers: Record<string, string>, body: string): Promise<PaymentCallbackPayload> {
    this.logger.log(`[Mock] handleCallback received`);

    try {
      const data = JSON.parse(body) as Record<string, unknown>;
      const orderSn = (data.out_trade_no ?? data.orderSn) as string;
      const transactionId = (data.transaction_id ?? data.transactionId) as string;
      const payAmount = this.parsePayAmount(data);

      if (!orderSn || !transactionId) {
        throw new Error('Mock callback: missing orderSn or transactionId');
      }

      return { orderSn, transactionId, payAmount };
    } catch (error) {
      this.logger.error(`[Mock] handleCallback parse error: ${String(error)}`);
      throw error;
    }
  }

  private parsePayAmount(data: Record<string, unknown>): number {
    if (typeof data.payAmount === 'number') return data.payAmount;
    if (typeof data.total === 'number') return data.total / 100; // 分转元
    const amount = data.amount as { total?: number } | undefined;
    if (amount?.total != null) return amount.total / 100;
    return 0;
  }

  async handleRefundCallback(_headers: Record<string, string>, body: string): Promise<RefundCallbackPayload> {
    this.logger.log(`[Mock] handleRefundCallback received`);

    const data = JSON.parse(body) as Record<string, unknown>;
    const refundSn = (data.out_refund_no ?? data.refundSn) as string;
    if (!refundSn) {
      throw new Error('Mock refund callback: missing refundSn');
    }

    return {
      refundSn,
      refundId: (data.refund_id ?? data.refundId ?? `mock_refund_${Date.now()}`) as string,
      status: ((data.refund_status ?? data.status) as RefundCallbackPayload['status']) || 'SUCCESS',
      amount: this.parseRefundAmount(data),
      ...this.parseRefundAmountBreakdown(data),
      successTime: data.success_time ? new Date(data.success_time as string) : undefined,
      rawPayload: data,
    };
  }

  private parseRefundAmount(data: Record<string, unknown>): number | undefined {
    // 仅在真正的"退款金额"字段中找 fallback；refund_fee 是"手续费"概念，不能作为退款金额的 fallback。
    // 字段全部缺失时返回 undefined，与 wechat-pay.adapter 对齐，避免在 mock 链路里把已落库金额清零。
    if (typeof data.amount === 'number' && Number.isFinite(data.amount)) return data.amount;
    const amount = data.amount as { refund?: number; payer_refund?: number; settlement_refund?: number } | undefined;
    if (amount?.refund != null) return amount.refund;
    if (amount?.payer_refund != null) return amount.payer_refund;
    if (amount?.settlement_refund != null) return amount.settlement_refund;
    if (typeof data.refundAmount === 'number' || typeof data.refundAmount === 'string')
      return toFen(String(data.refundAmount));
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
    this.logger.log(`[Mock] refund: ${params.refundSn}, 金额: ${params.refundAmount}`);
    const amount = toFen(params.refundAmount);

    return {
      refundSn: params.refundSn,
      refundId: `mock_refund_${Date.now()}`,
      status: 'SUCCESS',
      amount,
      payerRefundAmount: amount,
      settlementRefundAmount: amount,
      refundFeeAmount: 0,
      discountRefundAmount: 0,
      netAmount: amount,
    };
  }

  async queryRefund(refundSn: string): Promise<QueryRefundResult> {
    this.logger.log(`[Mock] queryRefund: ${refundSn}`);

    // mock 链路没有渠道侧真实金额来源，全部返回 undefined 触发 recordStatusUpdate 的"不覆盖已有金额"分支，
    // 避免 reconciliation scheduler 在 mock 环境下把已落库的退款金额清零。
    return {
      refundSn,
      refundId: `mock_refund_${Date.now()}`,
      status: 'SUCCESS',
      amount: undefined,
      payerRefundAmount: undefined,
      settlementRefundAmount: undefined,
      refundFeeAmount: undefined,
      discountRefundAmount: undefined,
      netAmount: undefined,
      successTime: new Date(),
    };
  }

  async queryPaymentStatus(orderSn: string): Promise<{
    orderSn: string;
    transactionId: string;
    status: 'UNPAID' | 'PAID' | 'CLOSED' | 'REFUNDED';
    payAmount: number;
    payTime?: Date;
  }> {
    this.logger.log(`[Mock] queryPaymentStatus: ${orderSn}`);

    return {
      orderSn,
      transactionId: `mock_tx_${Date.now()}`,
      status: 'PAID',
      payAmount: 0,
      payTime: new Date(),
    };
  }
}
