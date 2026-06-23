import { OrderDomainEventType } from './order-domain-event.types';
import { buildOrderOutboxDedupeKey } from './order-outbox.dedupe';

describe('buildOrderOutboxDedupeKey', () => {
  it('Given paid event, When build key, Then use canonical order idempotency key format', () => {
    expect(
      buildOrderOutboxDedupeKey({
        type: OrderDomainEventType.PAID,
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: 'tenant-1',
        memberId: 'member-1',
        payAmount: 100,
        transactionId: 'tx-1',
        paidAt: new Date('2026-05-15T00:00:00.000Z'),
      }),
    ).toBe('order:paid:order-1');
  });

  it('Given refunded event with reference, When build key, Then include refund reference as sub id', () => {
    expect(
      buildOrderOutboxDedupeKey({
        type: OrderDomainEventType.REFUNDED,
        orderId: 'order-1',
        orderSn: 'SN001',
        tenantId: 'tenant-1',
        memberId: 'member-1',
        refundReferenceId: 'refund-1',
        refundedAt: new Date('2026-05-15T00:00:00.000Z'),
      }),
    ).toBe('order:refunded:order-1:refund-1');
  });
});
