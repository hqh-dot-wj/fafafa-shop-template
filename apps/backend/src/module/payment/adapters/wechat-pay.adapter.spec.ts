import { ConfigService } from '@nestjs/config';
import { WechatPayService } from '../wechat-pay.service';
import { WechatPayAdapter } from './wechat-pay.adapter';

describe('WechatPayAdapter', () => {
  const mockWechatPayService = {
    createOrder: jest.fn(),
    parsePaymentCallback: jest.fn(),
    parseRefundCallback: jest.fn(),
    refund: jest.fn(),
    queryOrder: jest.fn(),
    queryRefund: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  let adapter: WechatPayAdapter;

  beforeEach(() => {
    jest.resetAllMocks();
    adapter = new WechatPayAdapter(
      mockWechatPayService as unknown as WechatPayService,
      mockConfigService as unknown as ConfigService,
    );
  });

  describe('handleCallback', () => {
    it('should map verified callback payload from WechatPayService', async () => {
      mockConfigService.get.mockReturnValue('production');
      mockWechatPayService.parsePaymentCallback.mockResolvedValue({
        orderSn: 'ORDER123456',
        transactionId: '4200000000001',
        payAmount: 100,
      });

      const result = await adapter.handleCallback({ signature: 'signed' }, '{}');

      expect(result).toEqual({
        orderSn: 'ORDER123456',
        transactionId: '4200000000001',
        payAmount: 100,
      });
    });

    it('should propagate verification failure in production', async () => {
      const error = new Error('invalid signature');
      mockConfigService.get.mockReturnValue('production');
      mockWechatPayService.parsePaymentCallback.mockRejectedValue(error);

      await expect(adapter.handleCallback({}, '{}')).rejects.toBe(error);
    });

    it('should fallback to raw JSON callback parsing outside production', async () => {
      mockConfigService.get.mockReturnValue('development');
      mockWechatPayService.parsePaymentCallback.mockRejectedValue(new Error('invalid signature'));

      const result = await adapter.handleCallback(
        {},
        JSON.stringify({
          out_trade_no: 'ORDER123456',
          transaction_id: '4200000000001',
          amount: {
            total: 10000,
          },
        }),
      );

      expect(result).toEqual({
        orderSn: 'ORDER123456',
        transactionId: '4200000000001',
        payAmount: 100,
      });
    });
  });

  describe('handleRefundCallback', () => {
    it('should map verified refund callback payload from WechatPayService', async () => {
      const successTime = new Date('2026-05-18T10:00:00.000Z');
      mockConfigService.get.mockReturnValue('production');
      mockWechatPayService.parseRefundCallback.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: 'SUCCESS',
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
        discountRefundAmount: 0,
        successTime,
        rawPayload: { out_refund_no: 'REFUND_ORDER123_FULL' },
      });

      const result = await adapter.handleRefundCallback({ signature: 'signed' }, '{}');

      expect(result).toEqual({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: 'SUCCESS',
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
        discountRefundAmount: 0,
        successTime,
        rawPayload: { out_refund_no: 'REFUND_ORDER123_FULL' },
      });
    });

    it('should fallback to raw JSON refund callback parsing outside production', async () => {
      mockConfigService.get.mockReturnValue('development');
      mockWechatPayService.parseRefundCallback.mockRejectedValue(new Error('invalid signature'));

      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          out_refund_no: 'REFUND_ORDER123_FULL',
          refund_id: '503000000001',
          refund_status: 'CLOSED',
          amount: {
            refund: 1990,
            payer_refund: 1990,
            settlement_refund: 1988,
            refund_fee: 2,
          },
        }),
      );

      expect(result).toMatchObject({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: 'CLOSED',
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
      });
    });

    // 规格（#6.1）：dev fallback 解析时所有金额字段缺失 → amount=undefined（而非兜底 0 清零已落库金额）
    it('should return amount=undefined when dev fallback parses payload with no amount fields', async () => {
      mockConfigService.get.mockReturnValue('development');
      mockWechatPayService.parseRefundCallback.mockRejectedValue(new Error('invalid signature'));

      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          out_refund_no: 'REFUND_ORDER123_FULL',
          refund_id: '503000000001',
          refund_status: 'SUCCESS',
          // 故意不带 amount/refund_fee 等金额字段
        }),
      );

      expect(result.amount).toBeUndefined();
    });

    // 规格（#merged_bug_001A）：refund_fee 是手续费概念，不能作为退款金额的 fallback。
    // 仅有 refund_fee 而缺真正退款金额字段时 → amount=undefined（而非把手续费 0.02 元当退款额写入）
    it('should NOT use refund_fee as amount fallback in dev parser', async () => {
      mockConfigService.get.mockReturnValue('development');
      mockWechatPayService.parseRefundCallback.mockRejectedValue(new Error('invalid signature'));

      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          out_refund_no: 'REFUND_ORDER123_FULL',
          refund_id: '503000000001',
          refund_status: 'SUCCESS',
          amount: { refund_fee: 12 }, // 仅手续费，无 refund/payer_refund/settlement_refund
        }),
      );

      expect(result.amount).toBeUndefined();
      expect(result.refundFeeAmount).toBe(12); // 手续费正确解析到 breakdown
    });

    // 规格（#merged_bug_001B）：breakdown 在 fee/discount 缺失时返 undefined，与 payer/settlement 对称
    it('should return refundFeeAmount/discountRefundAmount as undefined when missing in dev parser', async () => {
      mockConfigService.get.mockReturnValue('development');
      mockWechatPayService.parseRefundCallback.mockRejectedValue(new Error('invalid signature'));

      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          out_refund_no: 'REFUND_ORDER123_FULL',
          refund_id: '503000000001',
          refund_status: 'SUCCESS',
          amount: { refund: 1990, payer_refund: 1990 }, // 只填部分字段
        }),
      );

      expect(result.refundFeeAmount).toBeUndefined();
      expect(result.discountRefundAmount).toBeUndefined();
    });
  });

  describe('queryRefund', () => {
    it('should map refund query result from WechatPayService', async () => {
      mockWechatPayService.queryRefund.mockResolvedValue({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: 'SUCCESS',
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
        rawPayload: { out_refund_no: 'REFUND_ORDER123_FULL' },
      });

      await expect(adapter.queryRefund('REFUND_ORDER123_FULL')).resolves.toMatchObject({
        refundSn: 'REFUND_ORDER123_FULL',
        refundId: '503000000001',
        status: 'SUCCESS',
        amount: 1990,
        payerRefundAmount: 1990,
        settlementRefundAmount: 1988,
        refundFeeAmount: 2,
      });
    });
  });
});
