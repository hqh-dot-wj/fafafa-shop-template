import { Job } from 'bull';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { OrderIntegrationService } from './integration.service';
import { OrderMarketingEventProcessor } from './order-marketing-event.processor';
import {
  OrderMarketingCancelledJob,
  OrderMarketingCreatedJob,
  OrderMarketingPaidJob,
  OrderMarketingRefundedJob,
} from './order-marketing-event.contract';

const buildJob = <T>(data: T, attemptsMade = 0): Job<T> =>
  ({
    id: 'job-1',
    data,
    attemptsMade,
  }) as unknown as Job<T>;

describe('OrderMarketingEventProcessor', () => {
  let integration: jest.Mocked<
    Pick<
      OrderIntegrationService,
      'recordOrderCreated' | 'handleOrderPaid' | 'handleOrderCancelled' | 'handleOrderRefunded'
    >
  >;
  let financeCommandPort: jest.Mocked<Pick<FinanceCommandPort, 'recordPaidOrder' | 'queueCommissionCalculation'>>;
  let processor: OrderMarketingEventProcessor;

  beforeEach(() => {
    integration = {
      recordOrderCreated: jest.fn().mockResolvedValue(undefined),
      handleOrderPaid: jest.fn().mockResolvedValue(undefined),
      handleOrderCancelled: jest.fn().mockResolvedValue(undefined),
      handleOrderRefunded: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<
      Pick<
        OrderIntegrationService,
        'recordOrderCreated' | 'handleOrderPaid' | 'handleOrderCancelled' | 'handleOrderRefunded'
      >
    >;
    financeCommandPort = {
      recordPaidOrder: jest.fn().mockResolvedValue(undefined),
      queueCommissionCalculation: jest.fn().mockResolvedValue(undefined),
    };
    processor = new OrderMarketingEventProcessor(
      integration as unknown as OrderIntegrationService,
      financeCommandPort as unknown as FinanceCommandPort,
    );
  });

  it('Given created job, When processed, Then record created fact without locking assets', async () => {
    await processor.handleCreated(
      buildJob<OrderMarketingCreatedJob>({
        orderId: 'order-0',
        memberId: 'member-0',
        tenantId: 'tenant-7',
        userCouponId: 'coupon-1',
        pointsUsed: 20,
      }),
    );

    expect(integration.recordOrderCreated).toHaveBeenCalledWith('order-0', 'member-0', {
      userCouponId: 'coupon-1',
      pointsUsed: 20,
    });
  });

  it('Given paid job, When processed, Then bind tenant context and forward to handleOrderPaid', async () => {
    const captured: { tenantId?: string } = {};
    integration.handleOrderPaid.mockImplementation(async () => {
      captured.tenantId = TenantContext.getTenantId();
    });

    await processor.handlePaid(
      buildJob<OrderMarketingPaidJob>({
        orderId: 'order-1',
        orderSn: 'SN001',
        memberId: 'member-1',
        tenantId: 'tenant-7',
        payAmount: 50,
        transactionId: 'tx-1',
        paidAt: '2026-05-15T00:00:00.000Z',
      }),
    );

    expect(integration.handleOrderPaid).toHaveBeenCalledWith('order-1', 'member-1', 50);
    expect(financeCommandPort.recordPaidOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        orderSn: 'SN001',
        transactionId: 'tx-1',
        payAmount: 50,
      }),
    );
    expect(financeCommandPort.queueCommissionCalculation).toHaveBeenCalledWith('order-1', 'tenant-7');
    expect(captured.tenantId).toBe('tenant-7');
  });

  it('Given paid handler throws, When processed, Then rethrow to let Bull retry', async () => {
    integration.handleOrderPaid.mockRejectedValueOnce(new Error('downstream failed'));

    await expect(
      processor.handlePaid(
        buildJob<OrderMarketingPaidJob>({
          orderId: 'order-2',
          orderSn: 'SN002',
          memberId: 'member-2',
          tenantId: 'tenant-7',
          payAmount: 30,
          transactionId: 'tx-2',
          paidAt: '2026-05-15T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('downstream failed');
  });

  it('Given cancelled job, When processed, Then delegate without payment payload', async () => {
    await processor.handleCancelled(
      buildJob<OrderMarketingCancelledJob>({
        orderId: 'order-3',
        memberId: 'member-3',
        tenantId: 'tenant-7',
        reason: 'timeout',
      }),
    );

    expect(integration.handleOrderCancelled).toHaveBeenCalledWith('order-3', 'member-3');
  });

  it('Given refunded job with options, When processed, Then delegate options through', async () => {
    await processor.handleRefunded(
      buildJob<OrderMarketingRefundedJob>({
        orderId: 'order-4',
        memberId: 'member-4',
        tenantId: 'tenant-7',
        options: { refundReferenceId: 'r1', partialRefund: true },
      }),
    );

    expect(integration.handleOrderRefunded).toHaveBeenCalledWith(
      'order-4',
      'member-4',
      expect.objectContaining({ refundReferenceId: 'r1', partialRefund: true }),
    );
  });

  it('Given missing tenantId, When processed, Then throw instead of falling back to SUPER tenant', async () => {
    await expect(
      processor.handlePaid(
        buildJob<OrderMarketingPaidJob>({
          orderId: 'order-5',
          orderSn: 'SN005',
          memberId: 'member-5',
          tenantId: '',
          payAmount: 10,
          transactionId: 'tx-5',
          paidAt: '2026-05-15T00:00:00.000Z',
        }),
      ),
    ).rejects.toThrow('order marketing job missing tenantId');
  });
});
