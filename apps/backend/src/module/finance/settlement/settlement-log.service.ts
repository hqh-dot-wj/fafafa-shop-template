import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { Result } from 'src/common/response';
import { FormatDateFields } from 'src/common/utils';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { v4 as uuidv4 } from 'uuid';

/**
 * 结算日志数据
 */
interface SettlementLogData {
  settledCount: number;
  failedCount: number;
  totalAmount: Decimal;
  startTime: Date;
  endTime: Date;
  triggerType: 'SCHEDULED' | 'MANUAL';
  errorDetails?: string;
}

/**
 * 结算日志服务
 *
 * @description
 * S-T8: 新增结算日志表和查询接口
 */
@Injectable()
export class SettlementLogService {
  private readonly logger = new Logger(SettlementLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 创建结算日志
   *
   * @description
   * R-FLOW-SETTLEMENT-LOG-01: 记录结算批次日志
   */
  async createLog(data: SettlementLogData): Promise<string> {
    const tenantId = TenantContext.getTenantId() ?? 'system';
    const batchId = uuidv4();
    const durationMs = data.endTime.getTime() - data.startTime.getTime();

    await this.prisma.finSettlementLog.create({
      data: {
        tenantId,
        batchId,
        settledCount: data.settledCount,
        failedCount: data.failedCount,
        totalAmount: data.totalAmount,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMs,
        triggerType: data.triggerType,
        errorDetails: data.errorDetails,
      },
    });

    this.logger.log(
      `[结算日志] 批次 ${batchId}: 成功 ${data.settledCount}, 失败 ${data.failedCount}, ` +
        `金额 ${data.totalAmount}, 耗时 ${durationMs}ms`,
    );

    return batchId;
  }

  /**
   * 查询结算日志列表
   *
   * @description
   * R-FLOW-SETTLEMENT-LOG-02: 分页查询结算日志
   */
  async getLogList(query: {
    pageNum?: number;
    pageSize?: number;
    triggerType?: 'SCHEDULED' | 'MANUAL';
    startTime?: Date;
    endTime?: Date;
    hasError?: boolean;
  }) {
    const tenantId = TenantContext.getTenantId();
    const isSuper = TenantContext.isSuperTenant();
    const page = query.pageNum ?? 1;
    const size = query.pageSize ?? 20;

    const where: Prisma.FinSettlementLogWhereInput = {
      ...(isSuper ? {} : { tenantId }),
      ...(query.triggerType ? { triggerType: query.triggerType } : {}),
    };

    if (query.startTime || query.endTime) {
      where.createTime = {};
      if (query.startTime) where.createTime.gte = query.startTime;
      if (query.endTime) where.createTime.lte = query.endTime;
    }

    if (query.hasError !== undefined) {
      if (query.hasError) {
        where.failedCount = { gt: 0 };
      } else {
        where.failedCount = 0;
      }
    }

    const scopedWhere = this.tenantHelper.readWhereForDelegate(
      'finSettlementLog',
      where as object,
    ) as Prisma.FinSettlementLogWhereInput;

    const [list, total] = await Promise.all([
      this.prisma.finSettlementLog.findMany({
        where: scopedWhere,
        orderBy: { createTime: 'desc' },
        skip: (page - 1) * size,
        take: size,
      }),
      this.prisma.finSettlementLog.count({ where: scopedWhere }),
    ]);

    const formattedList = list.map((log) => ({
      id: log.id.toString(),
      batchId: log.batchId,
      settledCount: log.settledCount,
      failedCount: log.failedCount,
      totalAmount: Number(log.totalAmount),
      startTime: log.startTime,
      endTime: log.endTime,
      durationMs: log.durationMs,
      triggerType: log.triggerType,
      triggerTypeName: log.triggerType === 'SCHEDULED' ? '定时任务' : '手动触发',
      hasError: log.failedCount > 0,
      errorDetails: log.errorDetails ? JSON.parse(log.errorDetails) : null,
      createTime: log.createTime,
    }));

    return Result.page(FormatDateFields(formattedList), total);
  }

  /**
   * 获取结算日志详情
   */
  async getLogDetail(logId: string) {
    const log = await this.prisma.finSettlementLog.findFirst({
      where: this.tenantHelper.readWhereForDelegate('finSettlementLog', {
        id: BigInt(logId),
      } as object) as Prisma.FinSettlementLogWhereInput,
    });

    if (!log) {
      return Result.fail(404, '结算日志不存在');
    }

    return Result.ok(
      FormatDateFields({
        id: log.id.toString(),
        batchId: log.batchId,
        settledCount: log.settledCount,
        failedCount: log.failedCount,
        totalAmount: Number(log.totalAmount),
        startTime: log.startTime,
        endTime: log.endTime,
        durationMs: log.durationMs,
        triggerType: log.triggerType,
        triggerTypeName: log.triggerType === 'SCHEDULED' ? '定时任务' : '手动触发',
        hasError: log.failedCount > 0,
        errorDetails: log.errorDetails ? JSON.parse(log.errorDetails) : null,
        createTime: log.createTime,
      }),
    );
  }

  /**
   * 获取结算统计概览
   */
  async getSettlementOverview() {
    const tenantId = TenantContext.getTenantId();
    const isSuper = TenantContext.isSuperTenant();
    const baseWhere = isSuper ? {} : { tenantId };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);

    const [totalStats, todayStats, weekStats, errorStats] = await Promise.all([
      // 总体统计
      this.prisma.finSettlementLog.aggregate({
        where: this.tenantHelper.readWhereForDelegate(
          'finSettlementLog',
          baseWhere as object,
        ) as Prisma.FinSettlementLogWhereInput,
        _count: true,
        _sum: {
          settledCount: true,
          failedCount: true,
          totalAmount: true,
        },
        _avg: { durationMs: true },
      }),
      // 今日统计
      this.prisma.finSettlementLog.aggregate({
        where: this.tenantHelper.readWhereForDelegate('finSettlementLog', {
          ...baseWhere,
          createTime: { gte: today },
        } as object) as Prisma.FinSettlementLogWhereInput,
        _count: true,
        _sum: {
          settledCount: true,
          failedCount: true,
          totalAmount: true,
        },
      }),
      // 本周统计
      this.prisma.finSettlementLog.aggregate({
        where: this.tenantHelper.readWhereForDelegate('finSettlementLog', {
          ...baseWhere,
          createTime: { gte: weekStart },
        } as object) as Prisma.FinSettlementLogWhereInput,
        _count: true,
        _sum: {
          settledCount: true,
          failedCount: true,
          totalAmount: true,
        },
      }),
      // 错误统计
      this.prisma.finSettlementLog.count({
        where: this.tenantHelper.readWhereForDelegate('finSettlementLog', {
          ...baseWhere,
          failedCount: { gt: 0 },
        } as object) as Prisma.FinSettlementLogWhereInput,
      }),
    ]);

    const totalSettled = totalStats._sum.settledCount ?? 0;
    const totalFailed = totalStats._sum.failedCount ?? 0;
    const successRate =
      totalSettled + totalFailed > 0 ? ((totalSettled / (totalSettled + totalFailed)) * 100).toFixed(2) : '100.00';

    return Result.ok({
      // 总体
      totalBatches: totalStats._count,
      totalSettled,
      totalFailed,
      totalAmount: Number(totalStats._sum.totalAmount ?? 0),
      avgDurationMs: Math.round(totalStats._avg.durationMs ?? 0),
      successRate: Number(successRate),
      errorBatches: errorStats,
      // 今日
      todayBatches: todayStats._count,
      todaySettled: todayStats._sum.settledCount ?? 0,
      todayFailed: todayStats._sum.failedCount ?? 0,
      todayAmount: Number(todayStats._sum.totalAmount ?? 0),
      // 本周
      weekBatches: weekStats._count,
      weekSettled: weekStats._sum.settledCount ?? 0,
      weekFailed: weekStats._sum.failedCount ?? 0,
      weekAmount: Number(weekStats._sum.totalAmount ?? 0),
    });
  }
}
