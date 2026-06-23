import { PrismaService } from 'src/prisma/prisma.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { IdempotencyAuditService } from './audit.service';

describe('IdempotencyAuditService', () => {
  const prisma = {
    sysIdempotencyAudit: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-001');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records a Redis idempotency hit with tenant context', async () => {
    const service = new IdempotencyAuditService(prisma as unknown as PrismaService);

    await service.recordHit({
      idemKey: 'order:paid:order-001',
      layer: 'L3_REDIS',
      category: 'retry',
      metadata: { source: 'worker' },
    });

    expect(prisma.sysIdempotencyAudit.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-001',
        idemKey: 'order:paid:order-001',
        layer: 'L3_REDIS',
        category: 'retry',
        metadata: { source: 'worker' },
      },
    });
  });
});
