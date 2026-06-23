import { PlayInstanceStatus } from '@prisma/client';
import { CouponStatisticsService } from '../coupon/statistics/statistics.service';
import { PlayInstanceRepository } from '../instance/instance.repository';
import { MarketingRuntimeLedgerService } from '../marketing-runtime-ledger.service';
import { MarketingBusinessDashboardService } from '../marketing-business-dashboard.service';
import { PointsStatisticsService } from '../points/statistics/statistics.service';
import { IncidentService } from '../resolution/incident.service';
import { IncidentStatus } from '../resolution/vo/incident.vo';
import { ResolutionObservabilityService } from '../resolution/resolution-observability.service';

describe('MarketingBusinessDashboardService', () => {
  let service: MarketingBusinessDashboardService;
  const resolutionObservability = {
    getDashboard: jest.fn(async () => ({
      overview: { alerts: [] },
      topScenes: [],
    })),
  };
  const runtimeLedgerService = {
    listRows: jest.fn(async () => [{ configKey: 'marketing.client.compat.aggregate.window14d' }]),
  };
  const playInstanceRepository = {
    count: jest.fn(async (where?: { status?: PlayInstanceStatus }) => {
      if (!where?.status) return 12;
      if (where.status === PlayInstanceStatus.SUCCESS) return 10;
      if (where.status === PlayInstanceStatus.FAILED) return 2;
      return 0;
    }),
  };
  const couponStatisticsService = {
    getStatisticsOverview: jest.fn(async () => ({
      data: {
        totalDistributed: 100,
        totalUsed: 80,
        useRate: 0.8,
        totalExpired: 5,
        totalDiscountAmount: 3200,
      },
    })),
  };
  const pointsStatisticsService = {
    getBalanceStatistics: jest.fn(async () => ({
      data: {
        totalPoints: 1200,
        availablePoints: 900,
      },
    })),
  };
  const incidentService = {
    listIncidents: jest.fn(async () => ({
      data: {
        rows: [],
        total: 0,
      },
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingBusinessDashboardService(
      resolutionObservability as unknown as ResolutionObservabilityService,
      runtimeLedgerService as unknown as MarketingRuntimeLedgerService,
      playInstanceRepository as unknown as PlayInstanceRepository,
      couponStatisticsService as unknown as CouponStatisticsService,
      pointsStatisticsService as unknown as PointsStatisticsService,
      incidentService as unknown as IncidentService,
    );
  });

  it('应该把试跑、探针、异常、运行时台账和统计合成统一经营视图', async () => {
    const result = await service.getDashboard({ tenantId: '000000' });

    expect(result.sections.runtimeLedger).toHaveLength(1);
    expect(result.sections.instance.total).toBe(12);
    expect(result.sections.instance.success).toBe(10);
    expect(result.sections.statistics.totalUsed).toBe(80);
    expect(result.sections.incidents.total).toBe(0);
    expect(incidentService.listIncidents).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '000000',
        status: IncidentStatus.OPEN,
      }),
    );
  });
});
