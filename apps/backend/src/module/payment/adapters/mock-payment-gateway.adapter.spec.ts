import { MockPaymentGatewayAdapter } from './mock-payment-gateway.adapter';

describe('MockPaymentGatewayAdapter', () => {
  let adapter: MockPaymentGatewayAdapter;

  beforeEach(() => {
    adapter = new MockPaymentGatewayAdapter();
  });

  describe('refund', () => {
    it('converts refund amount to integer fen with Decimal precision', async () => {
      const result = await adapter.refund({
        orderSn: 'ORDER123456',
        refundSn: 'REFUND123456',
        refundAmount: '19.90',
        totalAmount: '100.00',
      });

      expect(result.amount).toBe(1990);
      expect(result.payerRefundAmount).toBe(1990);
      expect(result.settlementRefundAmount).toBe(1990);
      expect(result.netAmount).toBe(1990);
    });

    it('rejects fractional-cent refund amount', async () => {
      await expect(
        adapter.refund({
          orderSn: 'ORDER123456',
          refundSn: 'REFUND123456',
          refundAmount: '19.901',
          totalAmount: '100.00',
        }),
      ).rejects.toThrow('integer cents');
    });
  });

  describe('handleRefundCallback', () => {
    it('converts refundAmount yuan payload to integer fen', async () => {
      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          refundSn: 'REFUND123456',
          refundId: 'MOCK_REFUND_ID',
          refundAmount: '19.90',
        }),
      );

      expect(result.amount).toBe(1990);
    });

    // 规格（#6.1 防御性）：所有金额字段缺失时 amount=undefined，避免兜底 0 把已落库金额清零。
    it('returns amount=undefined when payload has no amount fields at all', async () => {
      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          refundSn: 'REFUND123456',
          refundId: 'MOCK_REFUND_ID',
          // 故意不带任何 amount 字段
        }),
      );

      expect(result.amount).toBeUndefined();
    });

    // 规格（#merged_bug_001A）：refund_fee 是手续费，不能作为退款金额的 fallback
    it('does NOT treat refund_fee as amount fallback', async () => {
      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          refundSn: 'REFUND123456',
          refundId: 'MOCK_REFUND_ID',
          amount: { refund_fee: 12 }, // 仅手续费
        }),
      );

      expect(result.amount).toBeUndefined();
      expect(result.refundFeeAmount).toBe(12);
    });

    // 规格（#merged_bug_001B）：breakdown 在 fee/discount 缺失时返 undefined
    it('returns refundFeeAmount/discountRefundAmount as undefined when missing', async () => {
      const result = await adapter.handleRefundCallback(
        {},
        JSON.stringify({
          refundSn: 'REFUND123456',
          refundId: 'MOCK_REFUND_ID',
          amount: { refund: 1990, payer_refund: 1990 },
        }),
      );

      expect(result.refundFeeAmount).toBeUndefined();
      expect(result.discountRefundAmount).toBeUndefined();
    });
  });

  describe('queryRefund', () => {
    // 规格（#6.2）：mock 无渠道侧真实金额来源，全部返回 undefined，触发 recordStatusUpdate 不覆盖分支。
    it('returns all amount fields as undefined to prevent reconciliation clearing existing amounts', async () => {
      const result = await adapter.queryRefund('REFUND123456');

      expect(result.amount).toBeUndefined();
      expect(result.payerRefundAmount).toBeUndefined();
      expect(result.settlementRefundAmount).toBeUndefined();
      expect(result.refundFeeAmount).toBeUndefined();
      expect(result.discountRefundAmount).toBeUndefined();
      expect(result.netAmount).toBeUndefined();
    });
  });
});
