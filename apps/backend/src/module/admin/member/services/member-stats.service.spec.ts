import { MemberStatsService } from './member-stats.service';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';

// ── Mock Factory ────────────────────────────────────────────────

const createPrismaMock = () => ({
  omsOrder: {
    groupBy: jest.fn().mockResolvedValue([]),
  },
  finCommission: {
    groupBy: jest.fn().mockResolvedValue([]),
  },
});

const createTenantHelperMock = (): Pick<TenantHelper, 'readWhereForDelegate'> => ({
  readWhereForDelegate: jest.fn((_delegate: string, where?: object) => ({ ...(where ?? {}) })),
});

// ── Tests ───────────────────────────────────────────────────────

describe('MemberStatsService', () => {
  let service: MemberStatsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let tenantHelper: ReturnType<typeof createTenantHelperMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    tenantHelper = createTenantHelperMock();
    service = new MemberStatsService(prisma as unknown as PrismaService, tenantHelper as unknown as TenantHelper);
  });

  describe('getBatchStats', () => {
    // R-FLOW-STATS-01: 返回消费和佣金 Map
    it('Given memberIds, When getBatchStats, Then 返回 consumptionMap 和 commissionMap', async () => {
      prisma.omsOrder.groupBy.mockResolvedValue([
        { memberId: 'M001', _sum: { payAmount: new Prisma.Decimal(500) } },
        { memberId: 'M002', _sum: { payAmount: new Prisma.Decimal(300) } },
      ]);
      prisma.finCommission.groupBy.mockResolvedValue([
        { beneficiaryId: 'M001', _sum: { amount: new Prisma.Decimal(100) } },
      ]);

      const result = await service.getBatchStats(['M001', 'M002']);

      expect(result.consumptionMap.get('M001')).toEqual(new Prisma.Decimal(500));
      expect(result.consumptionMap.get('M002')).toEqual(new Prisma.Decimal(300));
      expect(result.commissionMap.get('M001')).toEqual(new Prisma.Decimal(100));
      expect(result.commissionMap.has('M002')).toBe(false);
    });

    // R-FLOW-STATS-02: 空 memberIds 返回空 Map
    it('Given 空 memberIds, When getBatchStats, Then 返回空 Map', async () => {
      const result = await service.getBatchStats([]);

      expect(result.consumptionMap.size).toBe(0);
      expect(result.commissionMap.size).toBe(0);
      // 不应调用数据库
      expect(prisma.omsOrder.groupBy).not.toHaveBeenCalled();
      expect(prisma.finCommission.groupBy).not.toHaveBeenCalled();
    });

    // 边界：null memberIds
    it('Given null memberIds, When getBatchStats, Then 返回空 Map', async () => {
      const result = await service.getBatchStats(null);

      expect(result.consumptionMap.size).toBe(0);
      expect(result.commissionMap.size).toBe(0);
    });

    // 边界：聚合结果 _sum 为 null
    it('Given 聚合结果 payAmount 为 null, When getBatchStats, Then 使用 Decimal(0)', async () => {
      prisma.omsOrder.groupBy.mockResolvedValue([{ memberId: 'M001', _sum: { payAmount: null } }]);
      prisma.finCommission.groupBy.mockResolvedValue([{ beneficiaryId: 'M001', _sum: { amount: null } }]);

      const result = await service.getBatchStats(['M001']);

      expect(result.consumptionMap.get('M001')).toEqual(new Prisma.Decimal(0));
      expect(result.commissionMap.get('M001')).toEqual(new Prisma.Decimal(0));
    });
  });
});
