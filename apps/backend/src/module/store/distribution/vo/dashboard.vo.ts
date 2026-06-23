import { ApiProperty } from '@nestjs/swagger';

export class DistributorStatsVo {
  @ApiProperty({ description: '总分销员数' })
  total: number;

  @ApiProperty({ description: '新增分销员数（时间范围内）' })
  newCount: number;

  @ApiProperty({ description: '活跃分销员数（时间范围内有佣金记录）' })
  activeCount: number;
}

export class OrderStatsVo {
  @ApiProperty({ description: '分销订单总数' })
  totalCount: number;

  @ApiProperty({ description: '分销订单总金额' })
  totalAmount: number;

  @ApiProperty({ description: '分销订单占比（%）' })
  percentage: number;
}

export class CommissionTrendItemVo {
  @ApiProperty({ description: '日期' })
  date: string;

  @ApiProperty({ description: '佣金金额' })
  amount: number;
}

export class CommissionStatsVo {
  @ApiProperty({ description: '佣金支出总额' })
  totalAmount: number;

  @ApiProperty({ description: '待结算佣金' })
  pendingAmount: number;

  @ApiProperty({ description: '已结算佣金' })
  settledAmount: number;

  @ApiProperty({ description: '佣金趋势（按日）', type: [CommissionTrendItemVo] })
  trend: CommissionTrendItemVo[];
}

export class CommissionBudgetSnapshotVo {
  @ApiProperty({ description: '预算总额' })
  budgetTotal: number;

  @ApiProperty({ description: '预算冻结金额' })
  budgetFrozen: number;

  @ApiProperty({ description: '预算已消耗金额' })
  budgetConsumed: number;

  @ApiProperty({ description: '预算已释放金额' })
  budgetReleased: number;

  @ApiProperty({ description: '按等级分组的预算快照', type: 'object', additionalProperties: { type: 'number' } })
  budgetByLevel: Record<string, number>;

  @ApiProperty({ description: '按渠道分组的预算快照', type: 'object', additionalProperties: { type: 'number' } })
  budgetByChannel: Record<string, number>;

  @ApiProperty({ description: '按活动版本分组的预算快照', type: 'object', additionalProperties: { type: 'number' } })
  budgetByActivityVersion: Record<string, number>;

  @ApiProperty({ description: '预算预警阈值（百分比）' })
  budgetAlertThreshold: number;

  @ApiProperty({ description: '预算熔断阈值（百分比）' })
  budgetFuseThreshold: number;
}

export class DashboardVo {
  @ApiProperty({ description: '分销员统计', type: DistributorStatsVo })
  distributorStats: DistributorStatsVo;

  @ApiProperty({ description: '订单统计', type: OrderStatsVo })
  orderStats: OrderStatsVo;

  @ApiProperty({ description: '佣金统计', type: CommissionStatsVo })
  commissionStats: CommissionStatsVo;
}
