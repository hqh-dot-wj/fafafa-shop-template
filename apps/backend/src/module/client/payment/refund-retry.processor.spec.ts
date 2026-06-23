import { FinRefundStatus } from '@prisma/client';
import { Job } from 'bull';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { RefundStatus } from 'src/module/payment/interfaces/payment-provider.interface';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { OrderRefundFinalizerService } from '../order/refund/order-refund-finalizer.service';
import { AutoCancelRefundRetryJob, REFUND_RETRY_ATTEMPTS } from './refund-retry.queue';
import { RefundRetryProcessor } from './refund-retry.processor';

describe('RefundRetryProcessor', () => {
  const paymentGateway = {
    refund: jest.fn(),
  };
  const finRefundService = {
    findByRefundSn: jest.fn(),
    recordGatewayResult: jest.fn(),
    recordGatewayFailure: jest.fn(),
    markManualReviewRequired: jest.fn(),
  };
  const orderRefundFinalizer = {
    finalize: jest.fn(),
  };

  let processor: RefundRetryProcessor;

  const jobData: AutoCancelRefundRetryJob = {
    tenantId: 'tenant-1',
    orderId: 'order-1',
    orderSn: 'ORDER001',
    refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
    refundAmount: '19.90',
    totalAmount: '19.90',
    reason: '订单已取消，自动退款',
    source: 'AUTO_CANCEL_PAYMENT_CALLBACK',
  };

  const buildJob = (attemptsMade = 0): Job<AutoCancelRefundRetryJob> =>
    ({
      id: `auto-cancel-refund:${jobData.refundSn}`,
      data: jobData,
      attemptsMade,
      opts: { attempts: REFUND_RETRY_ATTEMPTS },
    }) as Job<AutoCancelRefundRetryJob>;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new RefundRetryProcessor(
      paymentGateway as unknown as PaymentGatewayPort,
      finRefundService as unknown as FinRefundService,
      orderRefundFinalizer as unknown as OrderRefundFinalizerService,
    );
    paymentGateway.refund.mockResolvedValue({
      refundSn: jobData.refundSn,
      refundId: 'wx-refund-1',
      status: RefundStatus.PROCESSING,
      amount: 1990,
    });
    finRefundService.findByRefundSn.mockResolvedValue(null);
    finRefundService.recordGatewayResult.mockImplementation(async (input) => ({
      id: 'fin-refund-1',
      refundSn: input.refundSn,
      status: input.status,
    }));
    finRefundService.recordGatewayFailure.mockResolvedValue({
      id: 'fin-refund-1',
      refundSn: jobData.refundSn,
      status: FinRefundStatus.CREATED,
    });
    finRefundService.markManualReviewRequired.mockResolvedValue({
      id: 'fin-refund-1',
      refundSn: jobData.refundSn,
      status: FinRefundStatus.ABNORMAL,
    });
    orderRefundFinalizer.finalize.mockResolvedValue({ finalized: false });
  });

  it('Given 自动取消退款重试返回 SUCCESS, When handleAutoCancelRefund, Then 记录同步结果并触发收口', async () => {
    paymentGateway.refund.mockResolvedValue({
      refundSn: jobData.refundSn,
      refundId: 'wx-refund-1',
      status: RefundStatus.SUCCESS,
      amount: 1990,
      successTime: new Date('2026-05-18T10:00:00.000Z'),
    });
    finRefundService.recordGatewayResult.mockResolvedValue({
      id: 'fin-refund-1',
      refundSn: jobData.refundSn,
      status: FinRefundStatus.SUCCESS,
    });

    const result = await processor.handleAutoCancelRefund(buildJob());

    expect(result).toEqual({ refundSn: jobData.refundSn, status: FinRefundStatus.SUCCESS });
    expect(paymentGateway.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderSn: 'ORDER001',
        refundSn: jobData.refundSn,
        reason: jobData.reason,
      }),
    );
    expect(finRefundService.recordGatewayResult).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: jobData.refundSn,
        status: RefundStatus.SUCCESS,
        operator: 'payment.refundRetryJob',
      }),
    );
    expect(orderRefundFinalizer.finalize).toHaveBeenCalledWith(
      expect.objectContaining({ status: FinRefundStatus.SUCCESS }),
    );
  });

  it('Given 自动取消退款重试仍返回 PROCESSING, When handleAutoCancelRefund, Then 不触发成功收口', async () => {
    await processor.handleAutoCancelRefund(buildJob());

    expect(finRefundService.recordGatewayResult).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: jobData.refundSn,
        status: RefundStatus.PROCESSING,
      }),
    );
    expect(orderRefundFinalizer.finalize).not.toHaveBeenCalled();
  });

  it('Given 本地退款已是 SUCCESS 终态且已收口, When Bull 重试到达, Then 不重复外呼支付渠道', async () => {
    finRefundService.findByRefundSn.mockResolvedValue({
      id: 'fin-refund-1',
      refundSn: jobData.refundSn,
      status: FinRefundStatus.SUCCESS,
      finalizedAt: new Date('2026-05-18T10:00:00.000Z'),
    });

    const result = await processor.handleAutoCancelRefund(buildJob());

    expect(result).toEqual({ refundSn: jobData.refundSn, status: FinRefundStatus.SUCCESS });
    expect(paymentGateway.refund).not.toHaveBeenCalled();
    expect(finRefundService.recordGatewayResult).not.toHaveBeenCalled();
    expect(orderRefundFinalizer.finalize).not.toHaveBeenCalled();
  });

  it('Given 本地退款已是 SUCCESS 但未收口, When Bull 重试到达, Then 只补业务收口不重复退款', async () => {
    const currentRefund = {
      id: 'fin-refund-1',
      refundSn: jobData.refundSn,
      status: FinRefundStatus.SUCCESS,
      finalizedAt: null,
    };
    finRefundService.findByRefundSn.mockResolvedValue(currentRefund);

    const result = await processor.handleAutoCancelRefund(buildJob());

    expect(result).toEqual({ refundSn: jobData.refundSn, status: FinRefundStatus.SUCCESS });
    expect(paymentGateway.refund).not.toHaveBeenCalled();
    expect(orderRefundFinalizer.finalize).toHaveBeenCalledWith(currentRefund);
  });

  it('Given 自动取消退款重试未耗尽, When 网关异常, Then 记录失败并交给 Bull 继续重试', async () => {
    paymentGateway.refund.mockRejectedValue(new Error('wechat unavailable'));

    await expect(processor.handleAutoCancelRefund(buildJob(1))).rejects.toThrow('wechat unavailable');

    expect(finRefundService.recordGatewayFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: jobData.refundSn,
        failReason: 'wechat unavailable',
        operator: 'payment.refundRetryJob',
      }),
    );
    expect(finRefundService.markManualReviewRequired).not.toHaveBeenCalled();
  });

  it('Given 自动取消退款重试耗尽, When 网关仍异常, Then 标记人工异常并抛错保留 Bull 失败态', async () => {
    paymentGateway.refund.mockRejectedValue(new Error('wechat unavailable'));

    await expect(processor.handleAutoCancelRefund(buildJob(REFUND_RETRY_ATTEMPTS - 1))).rejects.toThrow(
      'wechat unavailable',
    );

    expect(finRefundService.recordGatewayFailure).toHaveBeenCalled();
    expect(finRefundService.markManualReviewRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: jobData.refundSn,
        operator: 'payment.refundRetryJob',
        reason: expect.stringContaining('自动取消退款外呼重试耗尽'),
      }),
    );
  });
});
