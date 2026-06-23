import { OrderDomainEventPublisher } from './order-domain-event.publisher';
import { OrderDomainEventType } from './order-domain-event.types';
import { OrderOutboxWriter } from './order-outbox.writer';

describe('OrderDomainEventPublisher', () => {
  it('Given created order payload, When publishCreated, Then emit order created domain event', async () => {
    const outboxWriter = { write: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OrderOutboxWriter>;
    const publisher = new OrderDomainEventPublisher(outboxWriter);
    const createdAt = new Date('2026-05-06T11:00:00.000Z');

    await publisher.publishCreated({
      orderId: 'order-1',
      orderSn: 'SN001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      userCouponId: 'coupon-1',
      pointsUsed: 100,
      createdAt,
    });

    expect(outboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OrderDomainEventType.CREATED,
        orderId: 'order-1',
        userCouponId: 'coupon-1',
        pointsUsed: 100,
        createdAt,
      }),
    );
  });

  it('Given paid order payload, When publishPaid, Then emit order paid domain event', async () => {
    const outboxWriter = { write: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OrderOutboxWriter>;
    const publisher = new OrderDomainEventPublisher(outboxWriter);
    const paidAt = new Date('2026-05-06T12:00:00.000Z');

    await publisher.publishPaid({
      orderId: 'order-1',
      orderSn: 'SN001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      payAmount: 99.5,
      transactionId: 'tx-1',
      paidAt,
    });

    expect(outboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OrderDomainEventType.PAID,
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: 'tenant-1',
        memberId: 'member-1',
        payAmount: 99.5,
        transactionId: 'tx-1',
        paidAt,
      }),
    );
  });

  it('Given cancelled order payload, When publishCancelled, Then emit order cancelled domain event', async () => {
    const outboxWriter = { write: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OrderOutboxWriter>;
    const publisher = new OrderDomainEventPublisher(outboxWriter);
    const cancelledAt = new Date('2026-05-06T12:30:00.000Z');

    await publisher.publishCancelled({
      orderId: 'order-1',
      orderSn: 'SN001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      reason: 'user cancelled',
      cancelledAt,
    });

    expect(outboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OrderDomainEventType.CANCELLED,
        orderId: 'order-1',
        reason: 'user cancelled',
        cancelledAt,
      }),
    );
  });

  it('Given refunded order payload, When publishRefunded, Then emit order refunded domain event', async () => {
    const outboxWriter = { write: jest.fn().mockResolvedValue(undefined) } as unknown as jest.Mocked<OrderOutboxWriter>;
    const publisher = new OrderDomainEventPublisher(outboxWriter);
    const refundedAt = new Date('2026-05-06T13:00:00.000Z');

    await publisher.publishRefunded({
      orderId: 'order-1',
      orderSn: 'SN001',
      tenantId: 'tenant-1',
      memberId: 'member-1',
      refundReferenceId: 'refund-1',
      refundPointsAmount: 20,
      earnedPointsClawbackRatio: 0.4,
      refundCoupon: false,
      partialRefund: true,
      refundedAt,
    });

    expect(outboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OrderDomainEventType.REFUNDED,
        orderId: 'order-1',
        refundReferenceId: 'refund-1',
        refundPointsAmount: 20,
        earnedPointsClawbackRatio: 0.4,
        refundCoupon: false,
        partialRefund: true,
        refundedAt,
      }),
    );
  });
});
