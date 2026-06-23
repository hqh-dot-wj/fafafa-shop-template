import { ApiProperty } from '@nestjs/swagger';
import { IncidentVo } from '../resolution/vo/incident.vo';
import { ResolutionMetricsDashboard } from '../resolution/resolution-observability.service';
import { MarketingRuntimeLedgerRowVo } from '../marketing-runtime-ledger.service';

export class MarketingInstanceOperationsSnapshotVo {
  @ApiProperty({ description: '实例总数' })
  total: number;

  @ApiProperty({ description: '成功数' })
  success: number;

  @ApiProperty({ description: '失败数' })
  failed: number;

  @ApiProperty({ description: '待支付数' })
  pendingPay: number;

  @ApiProperty({ description: '已支付数' })
  paid: number;

  @ApiProperty({ description: '进行中数' })
  active: number;

  @ApiProperty({ description: '超时数' })
  timeout: number;

  @ApiProperty({ description: '已退款数' })
  refunded: number;

  @ApiProperty({ description: '成功率（0-1）' })
  successRate: number;
}

export class MarketingBusinessStatisticsSummaryVo {
  @ApiProperty({ description: '优惠券发放总数' })
  totalDistributed: number;

  @ApiProperty({ description: '优惠券核销总数' })
  totalUsed: number;

  @ApiProperty({ description: '优惠券核销率（0-1）' })
  useRate: number;

  @ApiProperty({ description: '优惠券过期总数' })
  totalExpired: number;

  @ApiProperty({ description: '优惠券优惠金额总计' })
  totalDiscountAmount: number;

  @ApiProperty({ description: '积分总量' })
  pointsTotal: number;

  @ApiProperty({ description: '可用积分' })
  pointsAvailable: number;
}

export class MarketingBusinessIncidentSectionVo {
  @ApiProperty({ description: '未闭环工单总数' })
  total: number;

  @ApiProperty({ description: '工单列表', type: [IncidentVo] })
  rows: IncidentVo[];
}

export class MarketingBusinessDashboardSectionsVo {
  @ApiProperty({ description: '裁决监控' })
  resolution: ResolutionMetricsDashboard;

  @ApiProperty({ description: '运行态台账', type: [Object] })
  runtimeLedger: MarketingRuntimeLedgerRowVo[];

  @ApiProperty({ description: '实例运行快照' })
  instance: MarketingInstanceOperationsSnapshotVo;

  @ApiProperty({ description: '营销统计摘要' })
  statistics: MarketingBusinessStatisticsSummaryVo;

  @ApiProperty({ description: '排障工单摘要' })
  incidents: MarketingBusinessIncidentSectionVo;
}

export class MarketingBusinessDashboardVo {
  @ApiProperty({ description: '租户 ID' })
  tenantId: string;

  @ApiProperty({ description: '生成时间（ISO）' })
  generatedAt: string;

  @ApiProperty({ description: '聚合分区' })
  sections: MarketingBusinessDashboardSectionsVo;
}
