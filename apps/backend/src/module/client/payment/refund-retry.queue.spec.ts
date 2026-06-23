import {
  AUTO_CANCEL_REFUND_RETRY_JOB,
  PAYMENT_REFUND_RETRY_QUEUE,
  REFUND_RETRY_ATTEMPTS,
  REFUND_RETRY_INITIAL_DELAY_MS,
  RefundRetryQueueService,
} from './refund-retry.queue';

describe('RefundRetryQueueService', () => {
  const queue = {
    add: jest.fn(),
  };

  let service: RefundRetryQueueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RefundRetryQueueService(queue as any);
    queue.add.mockResolvedValue({ id: `${AUTO_CANCEL_REFUND_RETRY_JOB}:AUTO_REFUND_ORDER001_CANCELLED` });
  });

  it('Given 自动取消退款外呼失败, When enqueueAutoCancelRefund, Then 用退款单号作为稳定 jobId 并配置退避重试', async () => {
    const jobId = await service.enqueueAutoCancelRefund({
      tenantId: 'tenant-1',
      orderId: 'order-1',
      orderSn: 'ORDER001',
      refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
      refundAmount: '19.90',
      totalAmount: '19.90',
      reason: '订单已取消，自动退款',
    });

    expect(jobId).toBe(`${AUTO_CANCEL_REFUND_RETRY_JOB}:AUTO_REFUND_ORDER001_CANCELLED`);
    expect(queue.add).toHaveBeenCalledWith(
      AUTO_CANCEL_REFUND_RETRY_JOB,
      expect.objectContaining({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        refundSn: 'AUTO_REFUND_ORDER001_CANCELLED',
        source: 'AUTO_CANCEL_PAYMENT_CALLBACK',
      }),
      expect.objectContaining({
        jobId: `${AUTO_CANCEL_REFUND_RETRY_JOB}:AUTO_REFUND_ORDER001_CANCELLED`,
        delay: REFUND_RETRY_INITIAL_DELAY_MS,
        attempts: REFUND_RETRY_ATTEMPTS,
        backoff: {
          type: 'exponential',
          delay: REFUND_RETRY_INITIAL_DELAY_MS,
        },
      }),
    );
  });

  it('Given 队列名常量, When 注册队列, Then 使用支付退款重试队列名', () => {
    expect(PAYMENT_REFUND_RETRY_QUEUE).toBe('PAYMENT_REFUND_RETRY');
  });
});
