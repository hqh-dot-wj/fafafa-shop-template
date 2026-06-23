import { Injectable } from '@nestjs/common';
import { Result } from 'src/common/response';
import { FormatDateFields } from 'src/common/utils';
import { CommissionStatus, WithdrawalStatus, PayStatus } from '@prisma/client';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { StoreOrderRepository } from 'src/module/store/order/store-order.repository';
import { Cacheable } from 'src/common/decorators/redis.decorator';
import { WithdrawalVo } from 'src/module/finance/withdrawal/vo/withdrawal.vo';
import { CommissionQueryPort } from 'src/module/finance/ports/commission-query.port';
import { WithdrawalQueryPort } from 'src/module/finance/ports/withdrawal-query.port';

/**
 * 店铺财务看板服务
 *
 * @description
 * 负责店铺财务看板数据的统计和聚合
 */
@Injectable()
export class StoreDashboardService {
  constructor(
    private readonly storeOrderRepo: StoreOrderRepository,
    private readonly commissionQueryPort: CommissionQueryPort,
    private readonly withdrawalQueryPort: WithdrawalQueryPort,
  ) {}

  /**
   * 获取资金看板数据
   * 使用 30 秒缓存提升性能
   */
  @Cacheable('store:finance:dashboard:', '', 30)
  async getDashboard() {
    const tenantId = TenantContext.getTenantId();
    const isSuper = TenantContext.isSuperTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const trendStart = new Date(today.getTime());
    trendStart.setDate(trendStart.getDate() - 29);
    trendStart.setHours(0, 0, 0, 0);
    const baseWhere = isSuper ? {} : { tenantId };

    const [
      todayOrders,
      monthOrders,
      pendingCommissions,
      settledCommissions,
      pendingWithdrawals,
      pendingWithdrawalSum,
      settledWithdrawalSum,
      revenueByDay,
      recentWithdrawalRows,
    ] = await Promise.all([
      this.storeOrderRepo.aggregate({
        where: {
          ...baseWhere,
          payStatus: PayStatus.PAID,
          createTime: { gte: today },
        },
        _sum: { payAmount: true },
        _count: true,
      }),
      this.storeOrderRepo.aggregate({
        where: {
          ...baseWhere,
          payStatus: PayStatus.PAID,
          createTime: { gte: monthStart },
        },
        _sum: { payAmount: true },
      }),
      this.commissionQueryPort.aggregate({
        where: {
          ...baseWhere,
          status: CommissionStatus.FROZEN,
        },
        _sum: { amount: true },
      }),
      this.commissionQueryPort.aggregate({
        where: {
          ...baseWhere,
          status: CommissionStatus.SETTLED,
        },
        _sum: { amount: true },
      }),
      this.withdrawalQueryPort.count({
        ...baseWhere,
        status: WithdrawalStatus.PENDING,
      }),
      this.withdrawalQueryPort.aggregate({
        where: { status: WithdrawalStatus.PENDING },
        _sum: { amount: true },
      }),
      this.withdrawalQueryPort.aggregate({
        where: { status: WithdrawalStatus.APPROVED },
        _sum: { amount: true },
      }),
      this.storeOrderRepo.sumPaidAmountByDaySince(trendStart),
      this.withdrawalQueryPort.findMany({
        orderBy: { createTime: 'desc' },
        take: 5,
        include: {
          member: {
            select: {
              nickname: true,
              mobile: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    const revenueTrend = this.buildRevenueTrend(trendStart, revenueByDay);
    const recentWithdrawals = recentWithdrawalRows.map((row) => this.mapRecentWithdrawal(row));

    return Result.ok(
      FormatDateFields({
        todayGMV: todayOrders._sum.payAmount || 0,
        todayOrderCount: todayOrders._count || 0,
        monthGMV: monthOrders._sum.payAmount || 0,
        pendingCommission: pendingCommissions._sum.amount || 0,
        settledCommission: settledCommissions._sum.amount || 0,
        pendingWithdrawals,
        pendingWithdrawalAmount: Number(pendingWithdrawalSum._sum.amount ?? 0),
        settledWithdrawalAmount: Number(settledWithdrawalSum._sum.amount ?? 0),
        revenueTrend,
        recentWithdrawals,
      }),
    );
  }

  private buildRevenueTrend(
    since: Date,
    rows: Array<{ day: string; amount: number }>,
  ): Array<{ date: string; amount: number }> {
    const map = new Map(rows.map((r) => [r.day, r.amount]));
    const out: Array<{ date: string; amount: number }> = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since.getTime());
      d.setDate(since.getDate() + i);
      const key = StoreDashboardService.toYmd(d);
      out.push({ date: key, amount: map.get(key) ?? 0 });
    }
    return out;
  }

  private static toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private mapRecentWithdrawal(row: {
    id: string;
    tenantId: string;
    memberId: string;
    amount: { toString(): string };
    method: string;
    status: string;
    realName: string | null;
    auditBy: string | null;
    auditTime: Date | null;
    auditRemark: string | null;
    paymentNo: string | null;
    createTime: Date;
    member?: { nickname: string; mobile: string | null; avatar: string | null } | null;
  }): WithdrawalVo {
    return FormatDateFields({
      id: row.id,
      tenantId: row.tenantId,
      memberId: row.memberId,
      amount: row.amount.toString(),
      method: row.method,
      status: row.status,
      realName: row.realName ?? '',
      auditBy: row.auditBy ?? undefined,
      auditTime: row.auditTime ?? undefined,
      auditRemark: row.auditRemark ?? undefined,
      paymentNo: row.paymentNo ?? undefined,
      createTime: row.createTime,
      memberName: row.member?.nickname,
      memberMobile: row.member?.mobile ?? undefined,
      memberAvatar: row.member?.avatar ?? undefined,
    }) as unknown as WithdrawalVo;
  }

  /**
   * 获取佣金统计数据
   */
  async getCommissionStats() {
    const tenantId = TenantContext.getTenantId();
    const isSuper = TenantContext.isSuperTenant();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const baseWhere = isSuper ? {} : { tenantId };

    const [todayStats, monthStats, pendingStats] = await Promise.all([
      this.commissionQueryPort.aggregate({
        where: {
          ...baseWhere,
          createTime: { gte: today },
          status: { not: CommissionStatus.CANCELLED },
        },
        _sum: { amount: true },
      }),
      this.commissionQueryPort.aggregate({
        where: {
          ...baseWhere,
          createTime: { gte: monthStart },
          status: { not: CommissionStatus.CANCELLED },
        },
        _sum: { amount: true },
      }),
      this.commissionQueryPort.aggregate({
        where: {
          ...baseWhere,
          status: CommissionStatus.FROZEN,
        },
        _sum: { amount: true },
      }),
    ]);

    return Result.ok(
      FormatDateFields({
        todayCommission: todayStats._sum.amount || 0,
        monthCommission: monthStats._sum.amount || 0,
        pendingCommission: pendingStats._sum.amount || 0,
      }),
    );
  }
}
