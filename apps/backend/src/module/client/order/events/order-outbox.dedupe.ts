import { IdempotencyActions } from 'src/common/idempotency/actions';
import { buildIdempotencyKey } from 'src/common/idempotency/keys';
import { OrderDomainEvent, OrderDomainEventType } from './order-domain-event.types';

export function buildOrderOutboxDedupeKey(event: OrderDomainEvent): string {
  switch (event.type) {
    case OrderDomainEventType.CREATED:
      return buildIdempotencyKey('order', IdempotencyActions.order.created, event.orderId);
    case OrderDomainEventType.PAID:
      return buildIdempotencyKey('order', IdempotencyActions.order.paid, event.orderId);
    case OrderDomainEventType.CANCELLED:
      return buildIdempotencyKey('order', IdempotencyActions.order.cancelled, event.orderId);
    case OrderDomainEventType.REFUNDED:
      return buildIdempotencyKey(
        'order',
        IdempotencyActions.order.refunded,
        event.orderId,
        event.refundReferenceId?.trim() || undefined,
      );
  }
}
