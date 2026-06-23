import { Queue } from 'bull';
import { OrderDomainEventType } from './order-domain-event.types';
import { OrderOutboxDispatcher } from './order-outbox.dispatcher';

describe('OrderOutboxDispatcher', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };
  const queue = {
    add: jest.fn(),
  };
  const redis = {
    tryLock: jest.fn(),
    renewLock: jest.fn(),
    unlock: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$executeRaw.mockResolvedValue(1);
    queue.add.mockResolvedValue({ id: 'job-1' });
    redis.tryLock.mockResolvedValue('token-1');
    redis.renewLock.mockResolvedValue(1);
    redis.unlock.mockResolvedValue(1);
  });

  it('Given pending paid outbox row, When dispatch batch, Then enqueue paid job and mark dispatched', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 1n,
        eventType: OrderDomainEventType.PAID,
        dedupeKey: 'order:paid:order-1',
        attempts: 0,
        payload: {
          type: OrderDomainEventType.PAID,
          orderId: 'order-1',
          orderSn: 'SN001',
          tenantId: 'tenant-1',
          memberId: 'member-1',
          payAmount: 100,
          transactionId: 'tx-1',
          paidAt: '2026-05-15T00:00:00.000Z',
        },
      },
    ]);

    const dispatcher = new OrderOutboxDispatcher(prisma as any, redis as any, queue as unknown as Queue);

    await expect(dispatcher.dispatchPendingBatch()).resolves.toBe(1);

    expect(queue.add).toHaveBeenCalledWith(
      'paid',
      expect.objectContaining({
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: 'tenant-1',
        transactionId: 'tx-1',
        paidAt: '2026-05-15T00:00:00.000Z',
      }),
      { jobId: 'order:paid:order-1' },
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('Given replayFailedRows by limit, When called, Then reset FAILED rows to PENDING', async () => {
    const dispatcher = new OrderOutboxDispatcher(prisma as any, redis as any, queue as unknown as Queue);
    prisma.$executeRaw.mockResolvedValue(3);

    await expect(dispatcher.replayFailedRows({ limit: 10 })).resolves.toBe(3);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('Given replayFailedRows with no ids and no limit, Then no-op returning 0', async () => {
    const dispatcher = new OrderOutboxDispatcher(prisma as any, redis as any, queue as unknown as Queue);
    await expect(dispatcher.replayFailedRows({})).resolves.toBe(0);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('Given Bull add fails, When dispatch batch, Then keep row retryable and do not throw', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 2n,
        eventType: OrderDomainEventType.CANCELLED,
        dedupeKey: 'order:cancelled:order-2',
        attempts: 0,
        payload: {
          type: OrderDomainEventType.CANCELLED,
          orderId: 'order-2',
          orderSn: 'SN002',
          tenantId: 'tenant-1',
          memberId: 'member-1',
          reason: 'timeout',
          cancelledAt: '2026-05-15T00:00:00.000Z',
        },
      },
    ]);
    queue.add.mockRejectedValue(new Error('redis down'));

    const dispatcher = new OrderOutboxDispatcher(prisma as any, redis as any, queue as unknown as Queue);

    await expect(dispatcher.dispatchPendingBatch()).resolves.toBe(1);

    expect(queue.add).toHaveBeenCalledWith(
      'cancelled',
      expect.objectContaining({ orderId: 'order-2', reason: 'timeout' }),
      { jobId: 'order:cancelled:order-2' },
    );
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
