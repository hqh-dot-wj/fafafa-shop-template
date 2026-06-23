import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { PrismaService } from 'src/prisma/prisma.service';
import { IdempotencyKey } from './keys';

export type IdempotencyAuditLayer = 'L1_DB' | 'L2_BULL' | 'L3_REDIS';
export type IdempotencyAuditCategory = 'retry' | 'replay' | 'unknown';

export interface RecordIdempotencyHitInput {
  tenantId?: string;
  idemKey: IdempotencyKey | string;
  layer: IdempotencyAuditLayer;
  category?: IdempotencyAuditCategory;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class IdempotencyAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async recordHit(input: RecordIdempotencyHitInput): Promise<void> {
    const data: Prisma.SysIdempotencyAuditCreateInput = {
      tenantId: input.tenantId ?? TenantContext.getTenantId() ?? TenantContext.SUPER_TENANT_ID,
      idemKey: String(input.idemKey),
      layer: input.layer,
      category: input.category ?? 'unknown',
    };

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    await this.prisma.sysIdempotencyAudit.create({ data });
  }
}
