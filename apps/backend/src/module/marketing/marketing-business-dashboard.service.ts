import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { CouponStatisticsService } from './coupon/statistics/statistics.service';
import { BusinessDashboardQueryDto } from './dto/business-dashboard-query.dto';
import { PlayInstanceRepository } from './instance/instance.repository';
import { MarketingRuntimeLedgerService } from './marketing-runtime-ledger.service';
import { PointsStatisticsService } from './points/statistics/statistics.service';
import { IncidentService } from './resolution/incident.service';
import { IncidentStatus } from './resolution/vo/incident.vo';
import { ResolutionObservabilityService } from './resolution/resolution-observability.service';
import { MarketingBusinessDashboardVo, MarketingInstanceOperationsSnapshotVo } from './vo/business-dashboard.vo';

@Injectable()
export class MarketingBusinessDashboardService {
  constructor(
    private readonly resolutionObservability: ResolutionObservabilityService,
    private readonly runtimeLedgerService: MarketingRuntimeLedgerService,
    private readonly playInstanceRepository: PlayInstanceRepository,
    private readonly couponStatisticsService: CouponStatisticsService,
    private readonly pointsStatisticsService: PointsStatisticsService,
    private readonly incidentService: IncidentService,
  ) {}

  async getDashboard(query: BusinessDashboardQueryDto): Promise<MarketingBusinessDashboardVo> {
    const tenantId = query.tenantId || '000000';

    const [resolution, runtimeLedger, instanceSnapshot, couponStatistics, pointsBalance, incidents] = await Promise.all([
      this.resolutionObservability.getDashboard(tenantId),
      this.runtimeLedgerService.listRows(tenantId),
      this.getInstanceOperationsSnapshot(),
      this.couponStatisticsService.getStatisticsOverview(),
      this.pointsStatisticsService.getBalanceStatistics(),
      this.incidentService.listIncidents({
        tenantId,
        status: IncidentStatus.OPEN,
        pageNum: 1,
        pageSize: 50,
      }),
    ]);

    const coupon = couponStatistics.data ?? {
      totalDistributed: 0,
      totalUsed: 0,
      useRate: 0,
      totalExpired: 0,
      totalDiscountAmount: 0,
    };

    const points = pointsBalance.data ?? {
      totalPoints: 0,
      availablePoints: 0,
    };

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      sections: {
        resolution,
        runtimeLedger,
        instance: instanceSnapshot,
        statistics: {
          totalDistributed: Number(coupon.totalDistributed ?? 0),
          totalUsed: Number(coupon.totalUsed ?? 0),
          useRate: Number(coupon.useRate ?? 0),
          totalExpired: Number(coupon.totalExpired ?? 0),
          totalDiscountAmount: Number(coupon.totalDiscountAmount ?? 0),
          pointsTotal: Number(points.totalPoints ?? 0),
          pointsAvailable: Number(points.availablePoints ?? 0),
        },
        incidents: {
          total: incidents.data?.total ?? 0,
          rows: incidents.data?.rows ?? [],
        },
      },
    };
  }

  private async getInstanceOperationsSnapshot(): Promise<MarketingInstanceOperationsSnapshotVo> {
    const [total, success, failed, pendingPay, paid, active, timeout, refunded] = await Promise.all([
      this.playInstanceRepository.count(),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.SUCCESS }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.FAILED }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.PENDING_PAY }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.PAID }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.ACTIVE }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.TIMEOUT }),
      this.playInstanceRepository.count({ status: PlayInstanceStatus.REFUNDED }),
    ]);

    return {
      total,
      success,
      failed,
      pendingPay,
      paid,
      active,
      timeout,
      refunded,
      successRate: total > 0 ? Number((success / total).toFixed(4)) : 0,
    };
  }
}
