declare global {
  namespace Api {
    namespace FinanceCenter {
      type SettlementChannelType = 'WECHAT_PROFITSHARING' | 'WECHAT_TRANSFER' | 'BANK_TRANSFER' | 'OFFLINE_TRANSFER';
      type SettlementReceiverType = 'TENANT' | 'MEMBER' | 'MERCHANT' | 'BANK_ACCOUNT';
      type SettlementProfileStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';
      type PaymentRecordStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CLOSED';
      type SettlementBillStatus =
        | 'INIT'
        | 'PENDING_REVIEW'
        | 'REJECTED'
        | 'APPROVED'
        | 'EXECUTING'
        | 'SUCCESS'
        | 'FAILED'
        | 'RECONCILING'
        | 'CLOSED';
      type SettlementExecutionStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CLOSED';
      type ReconciliationBizScope = 'PAYMENT' | 'REFUND' | 'SETTLEMENT' | 'WITHDRAWAL';
      type ReconciliationStatus = 'WAITING' | 'MATCHED' | 'UNMATCHED' | 'HANDLED';
      type StatementBatchStatus = 'INIT' | 'NORMALIZED' | 'FAILED';
      type ReconciliationBatchStatus = 'INIT' | 'RUNNING' | 'COMPLETED' | 'FAILED';
      type ReconciliationResultStatus = 'MATCHED' | 'UNMATCHED' | 'BUFFERED' | 'IGNORED';
      type ReconciliationBufferStatus = 'WAITING' | 'RECHECKING' | 'MATCHED' | 'EXPIRED' | 'IGNORED';
      type WalletStatus = 'NORMAL' | 'FROZEN' | 'DISABLED';
      type SettlementLogTriggerType = 'SCHEDULED' | 'MANUAL';

      type SettlementProfile = Common.CommonRecord<{
        id: string;
        tenantId: string;
        enabled: boolean;
        defaultChannel: SettlementChannelType;
        receiverType: SettlementReceiverType;
        receiverAccount?: string | null;
        receiverName?: string | null;
        bankName?: string | null;
        bankAccountNo?: string | null;
        needManualReview: boolean;
        status: SettlementProfileStatus;
        remark?: string | null;
      }>;

      type SettlementProfileRow = Pick<
        Api.System.Tenant,
        | 'id'
        | 'tenantId'
        | 'companyName'
        | 'contactUserName'
        | 'contactPhone'
        | 'regionName'
        | 'status'
        | 'settlementEnabled'
        | 'settlementChannel'
        | 'settlementReceiverType'
        | 'settlementReceiverAccount'
        | 'settlementReceiverName'
        | 'settlementBankName'
        | 'settlementBankAccountNo'
        | 'settlementNeedManualReview'
        | 'settlementStatus'
        | 'settlementRemark'
      >;

      type SaveSettlementProfilePayload = Partial<
        Pick<
          SettlementProfile,
          | 'enabled'
          | 'defaultChannel'
          | 'receiverType'
          | 'receiverAccount'
          | 'receiverName'
          | 'bankName'
          | 'bankAccountNo'
          | 'needManualReview'
          | 'status'
          | 'remark'
        >
      >;

      type PaymentRecordSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          tenantId: string;
          orderSn: string;
          transactionId: string;
          status: PaymentRecordStatus;
        }
      >;

      type PaymentRecord = Common.CommonRecord<{
        id: string;
        orderId: string;
        orderSn: string;
        tenantId: string;
        channelType: string;
        transactionId?: string | null;
        payAmount: number;
        status: PaymentRecordStatus;
        payTime?: string | null;
        orderStatus?: string | null;
        payStatus?: string | null;
        memberId?: string | null;
      }>;

      type PaymentRecordList = Api.Common.PaginatingQueryRecord<PaymentRecord>;

      type SettlementBillSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          tenantId: string;
          billNo: string;
          orderSn: string;
          status: SettlementBillStatus;
          channelType: SettlementChannelType;
        }
      >;

      type SettlementBill = Common.CommonRecord<{
        id: string;
        billNo: string;
        orderId: string;
        orderSn: string;
        tenantId: string;
        totalAmount: number;
        platformAmount: number;
        storeAmount: number;
        commissionAmount: number;
        crossTenantAmount: number;
        channelType: SettlementChannelType;
        status: SettlementBillStatus;
        payRecordStatus?: PaymentRecordStatus | null;
        latestExecutionStatus?: SettlementExecutionStatus | null;
        latestExecutionNo?: string | null;
      }>;

      type SettlementBillList = Api.Common.PaginatingQueryRecord<SettlementBill>;

      type SettlementBillItem = Common.CommonRecord<{
        id: string;
        receiverType: SettlementReceiverType;
        receiverId: string;
        receiverName?: string | null;
        channelType: SettlementChannelType;
        amount: number;
        reason?: string | null;
      }>;

      type SettlementBillAuditLog = Common.CommonRecord<{
        id: string;
        action: 'APPROVE' | 'REJECT';
        auditBy: string;
        remark?: string | null;
      }>;

      type SettlementExecutionLog = Common.CommonRecord<{
        id: string;
        stage: string;
        message: string;
        payload?: Record<string, unknown> | null;
      }>;

      type SettlementExecution = Common.CommonRecord<{
        id: string;
        executeNo: string;
        channelType: SettlementChannelType;
        status: SettlementExecutionStatus;
        externalNo?: string | null;
        failureReason?: string | null;
        logs: SettlementExecutionLog[];
      }>;

      type SettlementBillDetail = Common.CommonRecord<{
        id: string;
        billNo: string;
        tenantId: string;
        orderId: string;
        status: SettlementBillStatus;
        channelType: SettlementChannelType;
        totalAmount: number;
        platformAmount: number;
        storeAmount: number;
        commissionAmount: number;
        crossTenantAmount: number;
        remark?: string | null;
        order: {
          id: string;
          orderSn: string;
          memberId: string;
          status: string;
          payStatus: string;
          payAmount: number;
          payTime?: string | null;
        };
        payRecord?: {
          id: string;
          channelType: string;
          transactionId?: string | null;
          payAmount: number;
          status: PaymentRecordStatus;
          payTime?: string | null;
          createTime: string;
        } | null;
        items: SettlementBillItem[];
        audits: SettlementBillAuditLog[];
        executions: SettlementExecution[];
      }>;

      type AuditSettlementBillPayload = {
        billId: string;
        action: 'APPROVE' | 'REJECT';
        remark?: string;
      };

      type ExecuteSettlementBillPayload = {
        billId: string;
        channelType?: SettlementChannelType;
        externalNo?: string;
        markAsSuccess?: boolean;
        remark?: string;
      };

      type StatementBatchSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          statementDate: string;
          bizScope: ReconciliationBizScope;
          channelType: string;
          status: StatementBatchStatus;
        }
      >;

      type StatementBatch = Common.CommonRecord<{
        id: string;
        statementDate: string;
        bizScope: ReconciliationBizScope;
        channelType: string;
        status: StatementBatchStatus;
        sourceType: string;
        fileName?: string | null;
        importedCount: number;
        failedCount: number;
        remark?: string | null;
      }>;

      type StatementBatchDetail = StatementBatch & {
        lines: StatementLine[];
      };

      type StatementBatchList = Api.Common.PaginatingQueryRecord<StatementBatch>;

      type StatementLineSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          batchId: string;
          bizScope: ReconciliationBizScope;
          channelType: string;
          status: string;
          outBizNo: string;
          transactionId: string;
        }
      >;

      type StatementLine = Common.CommonRecord<{
        id: string;
        batchId: string;
        statementDate: string;
        tenantId?: string | null;
        bizScope: ReconciliationBizScope;
        channelType: string;
        transactionId?: string | null;
        externalNo?: string | null;
        outBizNo?: string | null;
        amount: number;
        amountKind: string;
        payerRefundAmount?: number | null;
        settlementRefundAmount?: number | null;
        refundFeeAmount?: number | null;
        discountRefundAmount?: number | null;
        netAmount?: number | null;
        currency: string;
        status: string;
        tradeTime?: string | null;
        rawPayload?: Record<string, unknown> | null;
      }>;

      type StatementLineList = Api.Common.PaginatingQueryRecord<StatementLine>;

      type ImportStatementPayload = {
        statementDate: string;
        bizScope: ReconciliationBizScope;
        channelType: string;
        sourceType?: string;
        fileName?: string;
        remark?: string;
      };

      type ReparseStatementBatchPayload = {
        force?: boolean;
        remark?: string;
      };

      type ReconciliationBatchSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          batchDate: string;
          bizScope: ReconciliationBizScope;
          channelType: string;
          status: ReconciliationBatchStatus;
        }
      >;

      type ReconciliationBatch = Common.CommonRecord<{
        id: string;
        statementBatchId?: string | null;
        batchDate: string;
        bizScope: ReconciliationBizScope;
        channelType: string;
        status: ReconciliationBatchStatus;
        totalCount: number;
        matchedCount: number;
        unmatchedCount: number;
        bufferedCount: number;
        ignoredCount: number;
        remark?: string | null;
        startedAt?: string | null;
        finishedAt?: string | null;
      }>;

      type ReconciliationBatchDetail = ReconciliationBatch & {
        statementBatch?: StatementBatch | null;
      };

      type ReconciliationBatchList = Api.Common.PaginatingQueryRecord<ReconciliationBatch>;

      type RunReconciliationBatchPayload = {
        batchDate: string;
        bizScope: ReconciliationBizScope;
        channelType: string;
        force?: boolean;
      };

      type RerunReconciliationBatchPayload = {
        clearOldResult?: boolean;
      };

      type ReconciliationResultSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          batchId: string;
          bizScope: ReconciliationBizScope;
          channelType: string;
          status: ReconciliationResultStatus;
          reasonCode: string;
          tenantId: string;
          localBizNo: string;
          channelBizNo: string;
        }
      >;

      type RefundAmountBreakdown = {
        amountKind: 'REFUND';
        payerRefundAmount: string;
        settlementRefundAmount?: string | null;
        refundFeeAmount: string;
        discountRefundAmount: string;
        netAmount: string;
      };

      type ReconciliationResult = Common.CommonRecord<{
        id: string;
        batchId: string;
        bizScope: ReconciliationBizScope;
        tenantId?: string | null;
        channelType: string;
        localBizId?: string | null;
        localBizNo?: string | null;
        channelBizNo?: string | null;
        transactionId?: string | null;
        localAmount?: number | null;
        channelAmount?: number | null;
        diffAmount?: number | null;
        localAmountBreakdown?: RefundAmountBreakdown | null;
        channelAmountBreakdown?: RefundAmountBreakdown | null;
        status: ReconciliationResultStatus;
        reasonCode?: string | null;
        reasonText?: string | null;
        issueId?: string | null;
        bufferId?: string | null;
        matchedAt?: string | null;
      }>;

      type ReconciliationResultList = Api.Common.PaginatingQueryRecord<ReconciliationResult>;

      type ReconciliationBufferSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          bizScope: ReconciliationBizScope;
          channelType: string;
          status: ReconciliationBufferStatus;
          reasonCode: string;
          tenantId: string;
        }
      >;

      type ReconciliationBuffer = Common.CommonRecord<{
        id: string;
        bizScope: ReconciliationBizScope;
        channelType: string;
        tenantId?: string | null;
        localBizId?: string | null;
        localBizNo?: string | null;
        channelBizNo?: string | null;
        transactionId?: string | null;
        reasonCode: string;
        reasonText?: string | null;
        firstSeenAt: string;
        nextCheckAt: string;
        expireAt: string;
        retryCount: number;
        status: ReconciliationBufferStatus;
      }>;

      type ReconciliationBufferList = Api.Common.PaginatingQueryRecord<ReconciliationBuffer>;

      type HandleReconciliationBufferPayload = {
        bufferId: string;
        remark?: string;
      };

      type ReconciliationIssueSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          tenantId: string;
          status: ReconciliationStatus;
          issueType: string;
          billNo: string;
          orderSn: string;
        }
      >;

      type ReconciliationIssue = Common.CommonRecord<{
        id: string;
        batchId?: string | null;
        resultId?: string | null;
        bizScope?: ReconciliationBizScope | null;
        tenantId: string;
        localBizId?: string | null;
        localBizNo?: string | null;
        channelBizNo?: string | null;
        transactionId?: string | null;
        orderId?: string | null;
        orderSn?: string | null;
        billId?: string | null;
        billNo?: string | null;
        billStatus?: SettlementBillStatus | null;
        executionId?: string | null;
        executeNo?: string | null;
        executionStatus?: SettlementExecutionStatus | null;
        channelType?: SettlementChannelType | null;
        externalNo?: string | null;
        issueType: string;
        status: ReconciliationStatus;
        diffAmount?: number | null;
        issueReason?: string | null;
        handledBy?: string | null;
        handledRemark?: string | null;
        handledTime?: string | null;
      }>;

      type ReconciliationIssueDetail = ReconciliationIssue;
      type ReconciliationIssueList = Api.Common.PaginatingQueryRecord<ReconciliationIssue>;

      type HandleReconciliationIssuePayload = {
        issueId: string;
        action: 'MARK_SUCCESS' | 'MARK_FAILED' | 'MARK_HANDLED';
        externalNo?: string;
        remark?: string;
      };

      type DistributionCommissionSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          status: Api.Finance.CommissionStatus;
          orderId: string;
          orderSn: string;
          beneficiaryId: string;
          keyword: string;
          level: number;
          startTime: string;
          endTime: string;
        }
      >;

      type DistributionCommission = Common.CommonRecord<{
        id: string;
        orderId: string;
        orderSn: string;
        orderPayAmount: number;
        beneficiaryId: string;
        beneficiaryName: string;
        beneficiaryMobile: string;
        beneficiaryAvatar?: string;
        level: number;
        levelName: string;
        amount: number;
        rateSnapshot: number;
        commissionBase: number;
        commissionBaseType?: 'ORIGINAL_PRICE' | 'ACTUAL_PAID' | 'ZERO' | null;
        isCapped: boolean;
        isCrossTenant: boolean;
        status: Api.Finance.CommissionStatus;
        statusName: string;
        planSettleTime?: string | null;
        settleTime?: string | null;
      }>;

      type DistributionCommissionList = Api.Common.PaginatingQueryRecord<DistributionCommission>;

      type DistributionCommissionStats = Common.CommonRecord<{
        totalCount: number;
        totalAmount: number;
        frozenCount: number;
        frozenAmount: number;
        settledCount: number;
        settledAmount: number;
        cancelledCount: number;
        cancelledAmount: number;
        todayCount: number;
        todayAmount: number;
        monthCount: number;
        monthAmount: number;
        yearCount: number;
        yearAmount: number;
        level1Count: number;
        level1Amount: number;
        level2Count: number;
        level2Amount: number;
      }>;

      type DistributionWithdrawalSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          status: Api.Finance.WithdrawalStatus;
          keyword: string;
          startTime: string;
          endTime: string;
        }
      >;

      type DistributionWithdrawal = Api.Finance.WithdrawalRecord;

      type DistributionWithdrawalList = Api.Common.PaginatingQueryRecord<DistributionWithdrawal>;

      type DistributionWithdrawalStats = Common.CommonRecord<{
        totalCount: number;
        totalAmount: number;
        totalFee: number;
        totalActualAmount: number;
        pendingCount: number;
        pendingAmount: number;
        approvedCount: number;
        approvedAmount: number;
        rejectedCount: number;
        rejectedAmount: number;
        failedCount: number;
        failedAmount: number;
        todayCount: number;
        todayAmount: number;
        monthCount: number;
        monthAmount: number;
        methodStats: Array<{
          method: string;
          methodName: string;
          count: number;
          amount: number;
        }>;
      }>;

      type WalletSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          status: WalletStatus;
          keyword: string;
          minBalance: number;
          maxBalance: number;
        }
      >;

      type WalletRecord = Common.CommonRecord<{
        id: string;
        memberId: string;
        memberName: string;
        memberMobile?: string;
        memberAvatar?: string;
        balance: number;
        frozen: number;
        totalIncome: number;
        pendingRecovery: number;
        status: WalletStatus;
        frozenReason?: string | null;
      }>;

      type WalletList = Api.Common.PaginatingQueryRecord<WalletRecord>;

      type WalletStats = Common.CommonRecord<{
        totalWallets: number;
        totalBalance: number;
        totalFrozen: number;
        totalIncome: number;
        totalPendingRecovery: number;
        normalWallets: number;
        frozenWallets: number;
        disabledWallets: number;
        pendingRecoveryWallets: number;
      }>;

      type FreezeWalletPayload = {
        walletId: string;
        reason: string;
      };

      type SettlementLogSearchParams = CommonType.RecordNullable<
        Api.Common.CommonSearchParams & {
          triggerType: SettlementLogTriggerType;
          hasError: boolean;
          startTime: string;
          endTime: string;
        }
      >;

      type SettlementLog = Common.CommonRecord<{
        id: string;
        batchId: string;
        settledCount: number;
        failedCount: number;
        totalAmount: number;
        startTime: string;
        endTime: string;
        durationMs: number;
        triggerType: SettlementLogTriggerType;
        triggerTypeName: string;
        hasError: boolean;
        errorDetails?: unknown;
      }>;

      type SettlementLogList = Api.Common.PaginatingQueryRecord<SettlementLog>;

      type SettlementOverview = Common.CommonRecord<{
        totalBatches: number;
        totalSettled: number;
        totalFailed: number;
        totalAmount: number;
        avgDurationMs: number;
        successRate: number;
        errorBatches: number;
        todayBatches: number;
        todaySettled: number;
        todayFailed: number;
        todayAmount: number;
        weekBatches: number;
        weekSettled: number;
        weekFailed: number;
        weekAmount: number;
      }>;
    }
  }
}

export {};
