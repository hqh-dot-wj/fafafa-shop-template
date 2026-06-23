import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderDomainEvent } from './order-domain-event.types';
import { buildOrderOutboxDedupeKey } from './order-outbox.dedupe';

@Injectable()
export class OrderOutboxWriter {
  private readonly logger = new Logger(OrderOutboxWriter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async write(event: OrderDomainEvent): Promise<void> {
    BusinessException.throwIf(!event.tenantId?.trim(), '订单事件缺少租户上下文', ResponseCode.PARAM_INVALID);

    const dedupeKey = buildOrderOutboxDedupeKey(event);
    try {
      await this.client.omsOrderEventOutbox.create({
        data: {
          tenantId: event.tenantId,
          orderId: event.orderId,
          eventType: event.type,
          dedupeKey,
          payload: JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.warn({
          message: 'Duplicate order outbox event suppressed',
          dedupeKey,
          orderId: event.orderId,
          eventType: event.type,
        });
        return;
      }
      throw error;
    }
  }

  private get client(): PrismaService | Prisma.TransactionClient {
    return this.cls.get<Prisma.TransactionClient>('PRISMA_TX') ?? this.prisma;
  }
}
