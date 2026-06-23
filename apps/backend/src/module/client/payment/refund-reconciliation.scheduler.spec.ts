import { FinRefundStatus, FinRefundType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CODE_MANAGED_JOB_METADATA } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { TASK_METADATA } from 'src/module/admin/common/decorators/task.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { FinRefundService } from 'src/module/finance/refund/fin-refund.service';
import { PaymentGatewayPort } from 'src/module/payment/ports/payment-gateway.port';
import { OrderRefundFinalizerService } from '../order/refund/order-refund-finalizer.service';
import { RefundReconciliationScheduler } from './refund-reconciliation.scheduler';

describe('RefundReconciliationScheduler', () => {
  const mockRedisClient = {
    set: jest.fn(),
    eval: jest.fn(),
  };

  const redisService = {
    getClient: jest.fn(() => mockRedisClient),
  };

  const finRefundService = {
    findPendingForQuery: jest.fn(),
    findSuccessUnfinalized: jest.fn(),
    recordQueryResult: jest.fn(),
    recordQueryFailure: jest.fn(),
    markManualReviewRequired: jest.fn(),
  };

  const paymentGateway = {
    queryRefund: jest.fn(),
  };

  const orderRefundFinalizer = {
    finalize: jest.fn(),
  };

  let scheduler: RefundReconciliationScheduler;

  const pendingRefund = {
    id: 'refund-1',
    tenantId: 'tenant-1',
    orderId: 'order-1',
    orderSn: 'ORDER001',
    refundSn: 'REFUND_ORDER001_FULL',
    refundType: FinRefundType.FULL,
    status: FinRefundStatus.PROCESSING,
    requestedAmount: new Decimal('19.90'),
    retryCount: 0,
    createTime: new Date(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new RefundReconciliationScheduler(
      redisService as unknown as RedisService,
      finRefundService as unknown as FinRefundService,
      paymentGateway as unknown as PaymentGatewayPort,
      orderRefundFinalizer as unknown as OrderRefundFinalizerService,
    );
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.eval.mockResolvedValue(1);
    finRefundService.findPendingForQuery.mockResolvedValue([]);
    finRefundService.findSuccessUnfinalized.mockResolvedValue([]);
    finRefundService.recordQueryResult.mockImplementation(async (input) => ({
      ...pendingRefund,
      status: input.status,
      retryCount: pendingRefund.retryCount + 1,
    }));
    finRefundService.recordQueryFailure.mockImplementation(async (input) => ({
      ...pendingRefund,
      failReason: input.failReason,
      retryCount: pendingRefund.retryCount + 1,
    }));
    finRefundService.markManualReviewRequired.mockImplementation(async () => ({
      ...pendingRefund,
      status: FinRefundStatus.ABNORMAL,
    }));
    orderRefundFinalizer.finalize.mockResolvedValue({ finalized: false });
  });

  it('Given reconcileJob 方法, When 检查任务装饰器, Then 存在代码托管任务元数据', () => {
    const codeManagedMetadata = Reflect.getMetadata(CODE_MANAGED_JOB_METADATA, scheduler.reconcileJob);
    const taskMetadata = Reflect.getMetadata(TASK_METADATA, scheduler.reconcileJob);

    expect(codeManagedMetadata).toMatchObject({
      key: 'payment.refundReconcileJob',
      group: 'FINANCE',
      guardMode: 'self-managed',
    });
    expect(taskMetadata).toMatchObject({
      name: 'payment.refundReconcileJob',
    });
  });

  it('Given 获取锁失败, When reconcileJob, Then 跳过查询且不释放未持有的锁', async () => {
    mockRedisClient.set.mockResolvedValue(null);

    await scheduler.reconcileJob();

    expect(finRefundService.findPendingForQuery).not.toHaveBeenCalled();
    expect(mockRedisClient.eval).not.toHaveBeenCalled();
  });

  it('Given 待查询退款单成功查询为 SUCCESS, When reconcileJob, Then 记录 QUERY 并触发收口', async () => {
    const successTime = new Date('2026-05-18T10:00:00.000Z');
    finRefundService.findPendingForQuery.mockResolvedValue([pendingRefund]);
    paymentGateway.queryRefund.mockResolvedValue({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: 'SUCCESS',
      amount: 1990,
      successTime,
      rawPayload: { out_refund_no: 'REFUND_ORDER001_FULL' },
    });

    await scheduler.reconcileJob();

    expect(finRefundService.findPendingForQuery).toHaveBeenCalledWith(50);
    expect(paymentGateway.queryRefund).toHaveBeenCalledWith('REFUND_ORDER001_FULL');
    expect(finRefundService.recordQueryResult).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'REFUND_ORDER001_FULL',
        refundId: 'wx-refund-1',
        status: 'SUCCESS',
        amount: 1990,
        successTime,
        operator: 'payment.refundReconcileJob',
      }),
    );
    expect(orderRefundFinalizer.finalize).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }));
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      'lock:payment:refund-reconciliation',
      expect.any(String),
    );
  });

  it('Given SUCCESS 但未收口退款单, When reconcileJob, Then 不再查询渠道并重试业务收口', async () => {
    const unfinalizedRefund = {
      ...pendingRefund,
      status: FinRefundStatus.SUCCESS,
      finalizedAt: null,
      refundSn: 'REFUND_ORDER001_FULL',
    };
    finRefundService.findPendingForQuery.mockResolvedValue([]);
    finRefundService.findSuccessUnfinalized.mockResolvedValue([unfinalizedRefund]);

    await scheduler.reconcileJob();

    expect(finRefundService.findSuccessUnfinalized).toHaveBeenCalledWith(50);
    expect(paymentGateway.queryRefund).not.toHaveBeenCalled();
    expect(orderRefundFinalizer.finalize).toHaveBeenCalledWith(unfinalizedRefund);
  });

  it('Given 查询已确认 SUCCESS 但业务收口失败, When reconcileJob, Then 不把收口异常记成渠道查询失败', async () => {
    finRefundService.findPendingForQuery.mockResolvedValue([pendingRefund]);
    paymentGateway.queryRefund.mockResolvedValue({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: 'SUCCESS',
      amount: 1990,
    });
    finRefundService.recordQueryResult.mockResolvedValue({
      ...pendingRefund,
      status: FinRefundStatus.SUCCESS,
      finalizedAt: null,
    });
    orderRefundFinalizer.finalize.mockRejectedValueOnce(new Error('finalizer unavailable'));

    await scheduler.reconcileJob();

    expect(finRefundService.recordQueryFailure).not.toHaveBeenCalled();
    expect(finRefundService.findSuccessUnfinalized).toHaveBeenCalledWith(50);
  });

  it('Given 多条待查询退款且第一条查询失败, When reconcileJob, Then 继续处理后续记录', async () => {
    const secondRefund = { ...pendingRefund, id: 'refund-2', refundSn: 'REFUND_ORDER002_FULL' };
    finRefundService.findPendingForQuery.mockResolvedValue([pendingRefund, secondRefund]);
    paymentGateway.queryRefund.mockRejectedValueOnce(new Error('wechat unavailable')).mockResolvedValueOnce({
      refundSn: 'REFUND_ORDER002_FULL',
      refundId: 'wx-refund-2',
      status: 'CLOSED',
      amount: 1990,
    });

    await scheduler.reconcileJob();

    expect(paymentGateway.queryRefund).toHaveBeenCalledTimes(2);
    expect(finRefundService.recordQueryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'REFUND_ORDER001_FULL',
        failReason: 'wechat unavailable',
        operator: 'payment.refundReconcileJob',
      }),
    );
    expect(finRefundService.recordQueryResult).toHaveBeenCalledTimes(1);
    expect(finRefundService.recordQueryResult).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'REFUND_ORDER002_FULL',
        status: 'CLOSED',
      }),
    );
  });

  it('Given 查询后仍未成功且超过处理窗口, When reconcileJob, Then 升级人工异常且不触发收口', async () => {
    const manualReviewThreshold = 8 * 24 * 6;
    const staleRefund = { ...pendingRefund, retryCount: manualReviewThreshold - 1 };
    finRefundService.findPendingForQuery.mockResolvedValue([staleRefund]);
    paymentGateway.queryRefund.mockResolvedValue({
      refundSn: 'REFUND_ORDER001_FULL',
      refundId: 'wx-refund-1',
      status: 'PROCESSING',
      amount: 1990,
    });
    finRefundService.recordQueryResult.mockResolvedValue({
      ...staleRefund,
      status: FinRefundStatus.PROCESSING,
      retryCount: manualReviewThreshold,
    });

    await scheduler.reconcileJob();

    expect(orderRefundFinalizer.finalize).not.toHaveBeenCalled();
    expect(finRefundService.markManualReviewRequired).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'REFUND_ORDER001_FULL',
        operator: 'payment.refundReconcileJob',
        reason: expect.stringContaining(`retryCount=${manualReviewThreshold}`),
      }),
    );
  });

  it('Given 查询接口异常且尚未超过处理窗口, When reconcileJob, Then 记录查询失败但不升级人工异常', async () => {
    finRefundService.findPendingForQuery.mockResolvedValue([pendingRefund]);
    paymentGateway.queryRefund.mockRejectedValueOnce(new Error('wechat unavailable'));

    await scheduler.reconcileJob();

    expect(finRefundService.recordQueryFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        refundSn: 'REFUND_ORDER001_FULL',
        failReason: 'wechat unavailable',
        operator: 'payment.refundReconcileJob',
      }),
    );
    expect(finRefundService.markManualReviewRequired).not.toHaveBeenCalled();
    expect(orderRefundFinalizer.finalize).not.toHaveBeenCalled();
  });

  it('Given 查询待处理退款列表异常, When reconcileJob, Then 仍释放锁并上浮错误', async () => {
    finRefundService.findPendingForQuery.mockRejectedValue(new Error('db unavailable'));

    await expect(scheduler.reconcileJob()).rejects.toThrow('db unavailable');
    expect(mockRedisClient.eval).toHaveBeenCalledWith(
      expect.stringContaining('redis.call'),
      1,
      'lock:payment:refund-reconciliation',
      expect.any(String),
    );
  });
});
