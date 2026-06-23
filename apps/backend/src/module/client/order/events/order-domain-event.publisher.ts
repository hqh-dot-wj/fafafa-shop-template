import { Injectable } from '@nestjs/common';
import {
  OrderCancelledDomainEvent,
  OrderCreatedDomainEvent,
  OrderDomainEventType,
  OrderPaidDomainEvent,
  OrderRefundedDomainEvent,
} from './order-domain-event.types';
import { OrderOutboxWriter } from './order-outbox.writer';

@Injectable()
export class OrderDomainEventPublisher {
  constructor(private readonly outboxWriter: OrderOutboxWriter) {}

  async publishCreated(event: Omit<OrderCreatedDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({
      type: OrderDomainEventType.CREATED,
      ...event,
    });
  }

  async publishPaid(event: Omit<OrderPaidDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({
      type: OrderDomainEventType.PAID,
      ...event,
    });
  }

  async publishCancelled(event: Omit<OrderCancelledDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({
      type: OrderDomainEventType.CANCELLED,
      ...event,
    });
  }

  async publishRefunded(event: Omit<OrderRefundedDomainEvent, 'type'>): Promise<void> {
    await this.outboxWriter.write({
      type: OrderDomainEventType.REFUNDED,
      ...event,
    });
  }
}
