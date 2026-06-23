import { Injectable, Logger } from '@nestjs/common';
import { FinWithdrawal, WithdrawalStatus, TransType } from '@prisma/client';
import { WithdrawalRepository } from './withdrawal.repository';
import { WalletRepository } from '../wallet/wallet.repository';
import { TransactionRepository } from '../wallet/transaction.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { BusinessException } from 'src/common/exceptions';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { ResponseCode, Result } from 'src/common/response';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { Decimal } from '@prisma/client/runtime/library';
import { WalletService } from '../wallet/wallet.service';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

/**
 * 提现审核服务
 * 负责审核状态流转、资金变动及外部打款调用
 *
 * @description
 * WD-T6: 增加打款失败自动重试（最多 3 次）
 */
@Injectable()
export class WithdrawalAuditService {
  private readonly logger = new Logger(WithdrawalAuditService.name);
  private readonly MAX_RETRY_COUNT = BusinessConstants.FINANCE.MAX_PAYMENT_RETRY_COUNT;

  constructor(
    private readonly withdrawalRepo: WithdrawalRepository,
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly prisma: PrismaService,
    private readonly paymentService: WithdrawalPaymentService,
    private readonly walletService: WalletService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 审核通过
   *
   * @description
   * WD-T6: 支持打款重试
   */
  async approve(withdrawal: FinWithdrawal, auditBy: string) {
    BusinessException.throwIf(withdrawal.status !== WithdrawalStatus.PENDING, '提现申请不存在或已处理');

    const paymentNo = this.paymentService.buildPaymentNo(withdrawal);
    // paymentNo 是通道幂等/查询键，必须在外部打款前落库，避免对账误解冻。
    const claimed = await this.withdrawalRepo.claimPendingForApproval(withdrawal.id, auditBy, paymentNo);
    if (claimed === 0) {
      this.logger.warn(`Withdrawal ${withdrawal.id} approval skipped: status already changed`);
      return Result.ok(null, '提现申请已处理');
    }

    try {
      // 1. 外部打款 (不可回滚，因此在事务外执行)
      const transferWithdrawal = { ...withdrawal, paymentNo, status: WithdrawalStatus.PROCESSING } as FinWithdrawal;
      const { channelStatus } = await this.paymentService.transfer(transferWithdrawal);

      if (channelStatus === 'SUCCESS') {
        const completed = await this.completeApproval(withdrawal, paymentNo, WithdrawalStatus.PROCESSING, { auditBy });
        if (!completed) return Result.ok(null, '提现申请已处理');
        return Result.ok({ paymentNo }, '审核通过并打款成功');
      }

      await this.markProcessing(withdrawal.id, paymentNo, auditBy);
      return Result.ok({ paymentNo }, '审核通过，打款处理中');
    } catch (error: unknown) {
      // WD-T6: 记录失败但不立即标记为最终失败，等待重试
      await this.handlePaymentFailure(withdrawal.id, getErrorMessage(error));
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, `打款失败: ${getErrorMessage(error)}`);
    }
  }

  /**
   * 重试打款
   *
   * @description
   * WD-T6: 打款失败自动重试
   * 由定时任务调用，对 FAILED 状态且重试次数未超限的记录进行重试
   */
  async retryPayment(withdrawalId: string): Promise<boolean> {
    const withdrawal = await this.withdrawalRepo.findOne({ id: withdrawalId });
    if (!withdrawal) {
      this.logger.warn(`Withdrawal ${withdrawalId} not found for retry`);
      return false;
    }

    // 检查状态和重试次数
    if (withdrawal.status !== WithdrawalStatus.FAILED) {
      this.logger.warn(`Withdrawal ${withdrawalId} status is ${withdrawal.status}, skip retry`);
      return false;
    }

    if (withdrawal.retryCount >= this.MAX_RETRY_COUNT) {
      this.logger.warn(`Withdrawal ${withdrawalId} exceeded max retry count (${this.MAX_RETRY_COUNT})`);
      return false;
    }

    const paymentNo = this.paymentService.buildPaymentNo(withdrawal);
    const claimed = await this.withdrawalRepo.claimFailedForRetry(withdrawalId, this.MAX_RETRY_COUNT, paymentNo);
    if (claimed === 0) {
      this.logger.warn(`Withdrawal ${withdrawalId} retry skipped: status or retryCount already changed`);
      return false;
    }

    try {
      // 重新尝试打款
      const retryWithdrawal = { ...withdrawal, paymentNo, status: WithdrawalStatus.PROCESSING } as FinWithdrawal;
      const { channelStatus } = await this.paymentService.transfer(retryWithdrawal);

      if (channelStatus === 'SUCCESS') {
        const completed = await this.completeApprovalAfterRetry(withdrawal, paymentNo);
        if (!completed) return false;
        this.logger.log(`Withdrawal ${withdrawalId} retry succeeded after ${withdrawal.retryCount + 1} attempts`);
        return true;
      }

      await this.markProcessingPaymentNo(withdrawalId, paymentNo);

      this.logger.log(`Withdrawal ${withdrawalId} retry accepted by channel and is processing`);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Withdrawal ${withdrawalId} retry failed (attempt ${withdrawal.retryCount + 1}): ${getErrorMessage(error)}`,
        getErrorStack(error),
      );

      await this.handlePaymentFailure(withdrawalId, getErrorMessage(error));

      return false;
    }
  }

  /**
   * 审核驳回
   */
  @Transactional()
  async reject(withdrawal: FinWithdrawal, auditBy: string, remark?: string) {
    BusinessException.throwIf(withdrawal.status !== WithdrawalStatus.PENDING, '提现申请不存在或已处理');

    const updated = await this.withdrawalRepo.updateStatusIfCurrent(withdrawal.id, WithdrawalStatus.PENDING, {
      status: WithdrawalStatus.REJECTED,
      auditTime: new Date(),
      auditBy,
      auditRemark: remark,
    });

    if (updated === 0) {
      this.logger.warn(`Withdrawal ${withdrawal.id} reject skipped: status already changed`);
      return Result.ok(null, '提现申请已处理');
    }

    await this.walletService.unfreezeBalance(withdrawal.memberId, withdrawal.amount);

    return Result.ok(null, '已驳回');
  }

  async completeChannelConfirmedSuccess(
    withdrawal: FinWithdrawal,
    paymentNo: string,
    currentStatus: WithdrawalStatus,
    finishTime?: Date,
  ) {
    return this.completeApproval(withdrawal, paymentNo, currentStatus, {
      auditTime: finishTime ?? new Date(),
      auditRemark: '系统对账：通道确认到账',
      transactionRemark: '余额提现成功（系统对账确认）',
    });
  }

  /**
   * 完成提现入账 (事务方法)
   */
  @Transactional()
  private async completeApproval(
    withdrawal: FinWithdrawal,
    paymentNo: string,
    currentStatus: WithdrawalStatus,
    options?: { auditBy?: string; auditTime?: Date; auditRemark?: string; transactionRemark?: string },
  ) {
    const updated = await this.withdrawalRepo.updateStatusIfCurrent(withdrawal.id, currentStatus, {
      status: WithdrawalStatus.APPROVED,
      paymentNo,
      failReason: null,
      ...(options?.auditBy || options?.auditTime || options?.auditRemark
        ? {
            auditTime: options.auditTime ?? new Date(),
            ...(options.auditBy ? { auditBy: options.auditBy } : {}),
            ...(options.auditRemark ? { auditRemark: options.auditRemark } : {}),
          }
        : {}),
    });

    if (updated === 0) {
      this.logger.warn(`Withdrawal ${withdrawal.id} complete approval skipped: status already changed`);
      return false;
    }

    await this.walletService.deductFrozen(withdrawal.memberId, withdrawal.amount);

    const wallet = await this.walletRepo.findByMemberId(withdrawal.memberId);
    if (wallet) {
      // 使用 actualAmount（如果有手续费）或 amount
      const actualAmount = withdrawal.actualAmount ?? withdrawal.amount;
      await this.transactionRepo.create({
        wallet: { connect: { id: wallet.id } },
        tenantId: withdrawal.tenantId,
        type: TransType.WITHDRAW_OUT,
        amount: new Decimal(0).minus(actualAmount),
        balanceAfter: wallet.balance,
        relatedId: withdrawal.id,
        remark:
          options?.transactionRemark ??
          (withdrawal.fee?.gt(0) ? `余额提现成功（手续费 ${withdrawal.fee} 元）` : '余额提现成功'),
      });
    }
    return true;
  }

  /**
   * 重试成功后完成入账
   */
  @Transactional()
  private async completeApprovalAfterRetry(withdrawal: FinWithdrawal, paymentNo: string) {
    return this.completeApproval(withdrawal, paymentNo, WithdrawalStatus.PROCESSING, {
      transactionRemark: `余额提现成功（重试 ${withdrawal.retryCount + 1} 次）`,
    });
  }

  /**
   * 处理打款失败
   */
  @Transactional()
  private async handlePaymentFailure(withdrawalId: string, failReason: string) {
    await this.withdrawalRepo.updateStatusIfCurrent(withdrawalId, WithdrawalStatus.PROCESSING, {
      status: WithdrawalStatus.FAILED,
      failReason,
    });
  }

  @Transactional()
  private async markProcessing(withdrawalId: string, paymentNo: string, auditBy: string) {
    await this.withdrawalRepo.updateStatusIfCurrent(withdrawalId, WithdrawalStatus.PROCESSING, {
      status: WithdrawalStatus.PROCESSING,
      auditTime: new Date(),
      auditBy,
      paymentNo,
      failReason: null,
    });
  }

  @Transactional()
  private async markProcessingPaymentNo(withdrawalId: string, paymentNo: string) {
    await this.withdrawalRepo.updateStatusIfCurrent(withdrawalId, WithdrawalStatus.PROCESSING, {
      status: WithdrawalStatus.PROCESSING,
      paymentNo,
      failReason: null,
    });
  }

  /**
   * 获取待重试的提现记录
   *
   * @description
   * 供定时任务调用，获取需要重试的失败记录
   */
  async getRetryableWithdrawals(): Promise<FinWithdrawal[]> {
    return this.prisma.finWithdrawal.findMany({
      where: this.tenantHelper.readWhereForDelegate('finWithdrawal', {
        status: WithdrawalStatus.FAILED,
        retryCount: { lt: this.MAX_RETRY_COUNT },
      }),
      orderBy: { createTime: 'asc' },
      take: 10,
    });
  }
}
