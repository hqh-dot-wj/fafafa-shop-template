import { Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { OrderDomainEventType } from './order-domain-event.types';
import { OrderOutboxWriter } from './order-outbox.writer';

describe('OrderOutboxWriter', () => {
  const prisma = {
    omsOrderEventOutbox: {
      create: jest.fn(),
    },
  };
  const cls = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    cls.get.mockReturnValue(undefined);
    prisma.omsOrderEventOutbox.create.mockResolvedValue({});
  });

  it('Given domain event, When write, Then persist canonical outbox payload and dedupe key', async () => {
    const writer = new OrderOutboxWriter(prisma as any, cls as any);

    await writer.write({
      type: OrderDomainEventType.CREATED,
      orderId: 'order-1',
      orderSn: 'SN001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      createdAt: new Date('2026-05-15T00:00:00.000Z'),
    });

    expect(prisma.omsOrderEventOutbox.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        orderId: 'order-1',
        eventType: OrderDomainEventType.CREATED,
        dedupeKey: 'order:created:order-1',
        payload: expect.objectContaining({
          createdAt: '2026-05-15T00:00:00.000Z',
        }),
      }),
    });
  });

  it('Given missing tenant, When write, Then reject before insert', async () => {
    const writer = new OrderOutboxWriter(prisma as any, cls as any);

    await expect(
      writer.write({
        type: OrderDomainEventType.CANCELLED,
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: '',
        memberId: 'member-1',
        cancelledAt: new Date('2026-05-15T00:00:00.000Z'),
      }),
    ).rejects.toThrow(BusinessException);
    expect(prisma.omsOrderEventOutbox.create).not.toHaveBeenCalled();
  });

  it('Given duplicate dedupe key, When write, Then suppress P2002 for idempotent replay', async () => {
    prisma.omsOrderEventOutbox.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const writer = new OrderOutboxWriter(prisma as any, cls as any);

    await expect(
      writer.write({
        type: OrderDomainEventType.PAID,
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: 'tenant-1',
        memberId: 'member-1',
        payAmount: 100,
        transactionId: 'tx-1',
        paidAt: new Date('2026-05-15T00:00:00.000Z'),
      }),
    ).resolves.toBeUndefined();
  });
});
