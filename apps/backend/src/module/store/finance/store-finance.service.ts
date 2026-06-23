import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { FinWithdrawal, Prisma, WithdrawalStatus } from '@prisma/client';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { WithdrawalQueryPort } from 'src/module/finance/ports/withdrawal-query.port';
import { ListCommissionDto, ListWithdrawalDto, AuditWithdrawalDto, ListLedgerDto } from './dto/store-finance.dto';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { StoreDashboardService } from './dashboard.service';
import { StoreCommissionQueryService } from './commission-query.service';
import { StoreLedgerService } from './ledger.service';
import { FormatDateFields } from 'src/common/utils';
import { Result } from 'src/common/response';

/**
 * Store端财务服务 (Facade)
 *
 * @description
 * 作为 Facade 模式的入口,协调各个子服务:
 * - StoreDashboardService: 看板统计
 * - StoreCommissionQueryService: 佣金查询
 * - StoreLedgerService: 财务流水
 * - FinanceCommandPort / WithdrawalQueryPort: 提现管理
 */
@Injectable()
export class StoreFinanceService {
  constructor(
    private readonly dashboardService: StoreDashboardService,
    private readonly commissionQueryService: StoreCommissionQueryService,
    private readonly ledgerService: StoreLedgerService,
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly withdrawalQueryPort: WithdrawalQueryPort,
  ) {}

  /**
   * 获取资金看板数据
   */
  async getDashboard() {
    return this.dashboardService.getDashboard();
  }

  /**
   * 查询佣金明细列表
   */
  async getCommissionList(query: ListCommissionDto) {
    return this.commissionQueryService.getCommissionList(query);
  }

  /**
   * 获取佣金统计数据
   */
  async getCommissionStats() {
    return this.dashboardService.getCommissionStats();
  }

  /**
   * 查询提现列表
   * @param query 查询参数
   */
  async getWithdrawalList(query: ListWithdrawalDto) {
    const tenantId = TenantContext.getTenantId();
    const where: Prisma.FinWithdrawalWhereInput = {
      ...(TenantContext.isSuperTenant() ? {} : { tenantId }),
      ...(query.status ? { status: query.status as WithdrawalStatus } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
    };

    const result = await this.withdrawalQueryPort.findPage({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      where: where as Record<string, unknown>,
      include: {
        member: {
          select: {
            memberId: true,
            nickname: true,
            mobile: true,
            avatar: true,
          },
        },
      },
      orderBy: 'createTime',
      order: 'desc',
    });

    return Result.page(
      FormatDateFields(result.rows.map((item) => this.toWithdrawalListItem(item))),
      result.total,
      result.pageNum,
      result.pageSize,
    );
  }

  /**
   * 审核提现
   */
  async auditWithdrawal(dto: AuditWithdrawalDto, auditBy: string) {
    const tenantId = TenantContext.getTenantId();
    return await this.financeCommandPort.auditWithdrawal({
      withdrawalId: dto.withdrawalId,
      action: dto.action,
      auditBy,
      tenantId,
      remark: dto.remark,
    });
  }

  /**
   * 查询门店流水
   * @param query 查询参数
   */
  /**
   * 查询财务流水
   */
  async getLedger(query: ListLedgerDto) {
    return this.ledgerService.getLedger(query);
  }

  /**
   * 获取流水统计数据
   */
  async getLedgerStats(query: ListLedgerDto) {
    return this.ledgerService.getLedgerStats(query);
  }

  /**
   * 导出流水数据
   */
  async exportLedger(res: Response, query: ListLedgerDto) {
    return this.ledgerService.exportLedger(res, query);
  }

  private toWithdrawalListItem(item: FinWithdrawal) {
    const member = (item as FinWithdrawal & {
      member?: { nickname?: string | null; mobile?: string | null; avatar?: string | null };
    }).member;
    return {
      ...item,
      memberName: member?.nickname,
      memberMobile: member?.mobile,
      memberAvatar: member?.avatar,
    };
  }
}
