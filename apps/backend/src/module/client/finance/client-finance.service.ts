import { Injectable } from '@nestjs/common';
import { Prisma, WithdrawalStatus, CommissionStatus, TransType } from '@prisma/client';
import { Result } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { normalizeClientPageQuery } from 'src/module/client/common/utils/pagination';
import { FinanceCommandPort } from 'src/module/finance/ports/finance-command.port';
import { CommissionQueryPort } from 'src/module/finance/ports/commission-query.port';
import { WalletQueryPort } from 'src/module/finance/ports/wallet-query.port';
import { WithdrawalQueryPort } from 'src/module/finance/ports/withdrawal-query.port';
import {
  ApplyWithdrawalDto,
  ListCommissionDto,
  ListTransactionDto,
  ListWithdrawalDto,
  WalletVo,
} from './dto/client-finance.dto';
import { FormatDateFields } from 'src/common/utils';

@Injectable()
export class ClientFinanceService {
  constructor(
    private readonly financeCommandPort: FinanceCommandPort,
    private readonly walletQueryPort: WalletQueryPort,
    private readonly withdrawalQueryPort: WithdrawalQueryPort,
    private readonly commissionQueryPort: CommissionQueryPort,
  ) {}

  /**
   * 获取我的钱包信息
   *
   * @description
   * W-T5: C 端钱包查询接口增强，返回待回收金额
   */
  async getWallet(tenantId: string, memberId: string) {
    // C 端入口保留“首次查看即建钱包”的兼容行为，但写入动作由 FinanceCommandPort 承接。
    const wallet = await this.financeCommandPort.ensureWallet(memberId, tenantId);

    const vo: WalletVo = {
      totalAssets: Number(wallet.balance) + Number(wallet.frozen),
      balance: Number(wallet.balance),
      frozen: Number(wallet.frozen),
      totalIncome: Number(wallet.totalIncome),
      pendingRecovery: Number(wallet.pendingRecovery),
    };

    return Result.ok(vo);
  }

  /**
   * 申请提现
   */
  async applyWithdrawal(tenantId: string, memberId: string, dto: ApplyWithdrawalDto) {
    await this.financeCommandPort.requestWithdrawal({
      memberId,
      tenantId,
      amount: dto.amount,
      method: dto.method,
    });
    return Result.ok(null, '申请已提交，请等待审核');
  }

  /**
   * 提现记录列表
   */
  async getWithdrawalList(tenantId: string, memberId: string, query: ListWithdrawalDto) {
    const page = normalizeClientPageQuery(query.pageNum, query.pageSize);
    const where: Prisma.FinWithdrawalWhereInput = {
      tenantId,
      memberId,
    };

    if (query.status) {
      where.status = this.normalizeEnum(query.status, WithdrawalStatus, '提现状态') as WithdrawalStatus;
    }

    const result = await this.withdrawalQueryPort.findPage({
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      where: where as Record<string, unknown>,
      orderBy: 'createTime',
      order: 'desc',
    });

    return Result.page(FormatDateFields(result.rows), result.total, result.pageNum, result.pageSize);
  }

  /**
   * 佣金记录列表
   */
  async getCommissionList(tenantId: string, memberId: string, query: ListCommissionDto) {
    const page = normalizeClientPageQuery(query.pageNum, query.pageSize);
    const where: Prisma.FinCommissionWhereInput = {
      tenantId,
      beneficiaryId: memberId,
    };

    if (query.status) {
      where.status = this.normalizeEnum(query.status, CommissionStatus, '佣金状态') as CommissionStatus;
    }

    const result = await this.commissionQueryPort.findPage({
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      where: where as Record<string, unknown>,
      orderBy: 'createTime',
      order: 'desc',
      include: {
        order: {
          select: { orderSn: true, payAmount: true },
        },
      },
    });

    return Result.page(FormatDateFields(result.rows), result.total, result.pageNum, result.pageSize);
  }

  /**
   * 资金流水列表
   */
  async getTransactionList(tenantId: string, memberId: string, query: ListTransactionDto) {
    const page = normalizeClientPageQuery(query.pageNum, query.pageSize);
    const type = query.type ? (this.normalizeEnum(query.type, TransType, '交易类型') as TransType) : undefined;
    const result = await this.walletQueryPort.findTransactionsPage(memberId, {
      tenantId,
      type,
      pageNum: page.pageNum,
      pageSize: page.pageSize,
    });

    return Result.page(FormatDateFields(result.rows), result.total, result.pageNum, result.pageSize);
  }

  private normalizeEnum(value: string, enumObject: Record<string, string>, label: string) {
    BusinessException.throwIf(!Object.values(enumObject).includes(value), `${label}无效`, ResponseCode.PARAM_INVALID);
    return value;
  }
}
