import { Injectable } from '@nestjs/common';
import { FinRefund } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionService } from '../commission/commission.service';
import { SettlementCoreService } from '../settlement-core/settlement-core.service';
import { WalletService } from '../wallet/wallet.service';
import { WithdrawalService } from '../withdrawal/withdrawal.service';
import {
  AuditWithdrawalInput,
  CancelPartialRefundCommissionsInput,
  CreditWalletIncomeInput,
  FinanceCommandPort,
  RecordPaidOrderInput,
  RequestWithdrawalInput,
} from '../ports/finance-command.port';

@Injectable()
export class FinanceCommandAdapter extends FinanceCommandPort {
  constructor(
    private readonly walletService: WalletService,
    private readonly withdrawalService: WithdrawalService,
    private readonly commissionService: CommissionService,
    private readonly settlementCoreService: SettlementCoreService,
  ) {
    super();
  }

  ensureWallet(memberId: string, tenantId: string) {
    return this.walletService.getOrCreateWallet(memberId, tenantId);
  }

  async creditWalletIncome(input: CreditWalletIncomeInput) {
    await this.walletService.getOrCreateWallet(input.memberId, input.tenantId);
    return this.walletService.addBalance(input.memberId, input.amount, input.relatedId, input.remark);
  }

  requestWithdrawal(input: RequestWithdrawalInput) {
    return this.withdrawalService.apply(input.memberId, input.tenantId, input.amount, input.method);
  }

  auditWithdrawal(input: AuditWithdrawalInput) {
    return this.withdrawalService.audit(input.withdrawalId, input.action, input.auditBy, input.tenantId, input.remark);
  }

  recordPaidOrder(input: RecordPaidOrderInput) {
    return this.settlementCoreService.recordPaidOrder(input);
  }

  queueCommissionCalculation(orderId: string, tenantId: string) {
    return this.commissionService.triggerCalculation(orderId, tenantId);
  }

  cancelOrderCommissions(orderId: string, itemIds?: number[]) {
    return this.commissionService.cancelCommissions(orderId, itemIds);
  }

  cancelCommissionsForOrderPartialRefund(input: CancelPartialRefundCommissionsInput) {
    return this.commissionService.cancelCommissionsForPartialRefund(input.orderId, input.refundRatio, input.relatedId);
  }

  handleSuccessfulRefundSettlement(refund: FinRefund) {
    return this.settlementCoreService.handleSuccessfulRefundSettlement(refund);
  }

  updateCommissionPlanSettleTime(orderId: string, eventType: 'CONFIRM' | 'VERIFY') {
    return this.commissionService.updatePlanSettleTime(orderId, eventType);
  }

  reverseSettledCommissionForOrderRefund(memberId: string, amount: Decimal, relatedId: string, remark: string) {
    return this.walletService.reverseSettledCommissionForOrderRefund(memberId, amount, relatedId, remark);
  }

  ensureTenantSettlementProfile(tenantId: string) {
    return this.settlementCoreService.ensureTenantProfile(tenantId);
  }
}
