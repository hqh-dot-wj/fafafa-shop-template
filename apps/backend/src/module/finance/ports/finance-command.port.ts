import { FinRefund, FinTenantSettlementProfile, FinWallet } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface RequestWithdrawalInput {
  memberId: string;
  tenantId: string;
  amount: number;
  method: string;
}

export interface AuditWithdrawalInput {
  withdrawalId: string;
  action: 'APPROVE' | 'REJECT';
  auditBy: string;
  tenantId?: string;
  remark?: string;
}

export interface CreditWalletIncomeInput {
  memberId: string;
  tenantId: string;
  amount: Decimal;
  relatedId: string;
  remark: string;
}

export interface RecordPaidOrderInput {
  orderId: string;
  tenantId: string;
  orderSn: string;
  transactionId: string;
  payAmount: number;
  channelType: string;
  payTime: Date;
}

export interface CancelPartialRefundCommissionsInput {
  orderId: string;
  refundRatio: Decimal;
  relatedId?: string;
}

/**
 * 财务写入端口。
 *
 * 业务域只能通过该端口请求财务状态变更；钱包、佣金、提现、结算表的实际写入仍留在 Finance 内部服务。
 */
export abstract class FinanceCommandPort {
  abstract ensureWallet(memberId: string, tenantId: string): Promise<FinWallet>;

  abstract creditWalletIncome(input: CreditWalletIncomeInput): Promise<FinWallet>;

  abstract requestWithdrawal(input: RequestWithdrawalInput): Promise<unknown>;

  abstract auditWithdrawal(input: AuditWithdrawalInput): Promise<unknown>;

  abstract recordPaidOrder(input: RecordPaidOrderInput): Promise<unknown>;

  abstract queueCommissionCalculation(orderId: string, tenantId: string): Promise<void>;

  abstract cancelOrderCommissions(orderId: string, itemIds?: number[]): Promise<void>;

  abstract cancelCommissionsForOrderPartialRefund(input: CancelPartialRefundCommissionsInput): Promise<void>;

  abstract handleSuccessfulRefundSettlement(refund: FinRefund): Promise<unknown>;

  abstract updateCommissionPlanSettleTime(orderId: string, eventType: 'CONFIRM' | 'VERIFY'): Promise<void>;

  abstract reverseSettledCommissionForOrderRefund(
    memberId: string,
    amount: Decimal,
    relatedId: string,
    remark: string,
  ): Promise<{ deducted: Decimal; pendingRecovery: Decimal }>;

  abstract ensureTenantSettlementProfile(tenantId: string): Promise<FinTenantSettlementProfile>;
}
