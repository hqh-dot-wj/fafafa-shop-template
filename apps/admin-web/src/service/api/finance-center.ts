import { request } from '@/service/request';
import { fetchAuditWithdrawal, fetchGetWithdrawalList } from './store/finance';

const SETTLEMENT_BASE = '/admin/finance/settlement-core';
const ADMIN_FINANCE_BASE = '/admin/finance';

export function fetchGetTenantSettlementProfile(tenantId: string) {
  return request<Api.FinanceCenter.SettlementProfile>({
    url: `${SETTLEMENT_BASE}/tenant-profile/${tenantId}`,
    method: 'get',
  });
}

export function fetchSaveTenantSettlementProfile(
  tenantId: string,
  data: Api.FinanceCenter.SaveSettlementProfilePayload,
) {
  return request<Api.FinanceCenter.SettlementProfile>({
    url: `${SETTLEMENT_BASE}/tenant-profile/${tenantId}`,
    method: 'put',
    data,
  });
}

export function fetchGetSettlementPaymentList(params?: Api.FinanceCenter.PaymentRecordSearchParams) {
  return request<Api.FinanceCenter.PaymentRecordList>({
    url: `${SETTLEMENT_BASE}/payment/list`,
    method: 'get',
    params,
  });
}

export function fetchGetSettlementBillList(params?: Api.FinanceCenter.SettlementBillSearchParams) {
  return request<Api.FinanceCenter.SettlementBillList>({
    url: `${SETTLEMENT_BASE}/bill/list`,
    method: 'get',
    params,
  });
}

export function fetchGetSettlementBillDetail(id: string) {
  return request<Api.FinanceCenter.SettlementBillDetail>({
    url: `${SETTLEMENT_BASE}/bill/detail/${id}`,
    method: 'get',
  });
}

export function fetchAuditSettlementBill(data: Api.FinanceCenter.AuditSettlementBillPayload) {
  return request({
    url: `${SETTLEMENT_BASE}/bill/audit`,
    method: 'put',
    data,
  });
}

export function fetchExecuteSettlementBill(data: Api.FinanceCenter.ExecuteSettlementBillPayload) {
  return request({
    url: `${SETTLEMENT_BASE}/bill/execute`,
    method: 'put',
    data,
  });
}

export function fetchGetStatementBatchList(params?: Api.FinanceCenter.StatementBatchSearchParams) {
  return request<Api.FinanceCenter.StatementBatchList>({
    url: `${SETTLEMENT_BASE}/statement/batch/list`,
    method: 'get',
    params,
  });
}

export function fetchGetStatementBatchDetail(id: string) {
  return request<Api.FinanceCenter.StatementBatchDetail>({
    url: `${SETTLEMENT_BASE}/statement/batch/detail/${id}`,
    method: 'get',
  });
}

export function fetchGetStatementLineList(params?: Api.FinanceCenter.StatementLineSearchParams) {
  return request<Api.FinanceCenter.StatementLineList>({
    url: `${SETTLEMENT_BASE}/statement/line/list`,
    method: 'get',
    params,
  });
}

export function fetchImportStatementBatch(data: Api.FinanceCenter.ImportStatementPayload) {
  return request<Api.FinanceCenter.StatementBatch>({
    url: `${SETTLEMENT_BASE}/statement/import`,
    method: 'post',
    data,
  });
}

export function fetchReparseStatementBatch(batchId: string, data: Api.FinanceCenter.ReparseStatementBatchPayload) {
  return request<Api.FinanceCenter.StatementBatch>({
    url: `${SETTLEMENT_BASE}/statement/reparse/${batchId}`,
    method: 'put',
    data,
  });
}

export function fetchGetReconciliationBatchList(params?: Api.FinanceCenter.ReconciliationBatchSearchParams) {
  return request<Api.FinanceCenter.ReconciliationBatchList>({
    url: `${SETTLEMENT_BASE}/reconcile/batch/list`,
    method: 'get',
    params,
  });
}

export function fetchGetReconciliationBatchDetail(id: string) {
  return request<Api.FinanceCenter.ReconciliationBatchDetail>({
    url: `${SETTLEMENT_BASE}/reconcile/batch/detail/${id}`,
    method: 'get',
  });
}

export function fetchRunReconciliationBatch(data: Api.FinanceCenter.RunReconciliationBatchPayload) {
  return request<Api.FinanceCenter.ReconciliationBatch>({
    url: `${SETTLEMENT_BASE}/reconcile/run`,
    method: 'post',
    data,
  });
}

export function fetchRerunReconciliationBatch(
  batchId: string,
  data: Api.FinanceCenter.RerunReconciliationBatchPayload,
) {
  return request<Api.FinanceCenter.ReconciliationBatch>({
    url: `${SETTLEMENT_BASE}/reconcile/rerun/${batchId}`,
    method: 'post',
    data,
  });
}

export function fetchGetReconciliationResultList(params?: Api.FinanceCenter.ReconciliationResultSearchParams) {
  return request<Api.FinanceCenter.ReconciliationResultList>({
    url: `${SETTLEMENT_BASE}/reconcile/result/list`,
    method: 'get',
    params,
  });
}

export function fetchGetReconciliationResultDetail(id: string) {
  return request<Api.FinanceCenter.ReconciliationResult>({
    url: `${SETTLEMENT_BASE}/reconcile/result/detail/${id}`,
    method: 'get',
  });
}

export function fetchExportReconciliationResults(params?: Api.FinanceCenter.ReconciliationResultSearchParams) {
  return request<Api.FinanceCenter.ReconciliationResult[]>({
    url: `${SETTLEMENT_BASE}/reconcile/result/export`,
    method: 'get',
    params,
  });
}

export function fetchGetReconciliationBufferList(params?: Api.FinanceCenter.ReconciliationBufferSearchParams) {
  return request<Api.FinanceCenter.ReconciliationBufferList>({
    url: `${SETTLEMENT_BASE}/reconcile/buffer/list`,
    method: 'get',
    params,
  });
}

export function fetchGetReconciliationBufferDetail(id: string) {
  return request<Api.FinanceCenter.ReconciliationBuffer>({
    url: `${SETTLEMENT_BASE}/reconcile/buffer/detail/${id}`,
    method: 'get',
  });
}

export function fetchRecheckReconciliationBuffer(data: Api.FinanceCenter.HandleReconciliationBufferPayload) {
  return request({
    url: `${SETTLEMENT_BASE}/reconcile/buffer/recheck`,
    method: 'put',
    data,
  });
}

export function fetchEscalateReconciliationBuffer(data: Api.FinanceCenter.HandleReconciliationBufferPayload) {
  return request({
    url: `${SETTLEMENT_BASE}/reconcile/buffer/escalate`,
    method: 'put',
    data,
  });
}

export function fetchIgnoreReconciliationBuffer(data: Api.FinanceCenter.HandleReconciliationBufferPayload) {
  return request({
    url: `${SETTLEMENT_BASE}/reconcile/buffer/ignore`,
    method: 'put',
    data,
  });
}

export function fetchGetReconciliationIssueList(params?: Api.FinanceCenter.ReconciliationIssueSearchParams) {
  return request<Api.FinanceCenter.ReconciliationIssueList>({
    url: `${SETTLEMENT_BASE}/reconcile/issue/list`,
    method: 'get',
    params,
  });
}

export function fetchGetReconciliationIssueDetail(id: string) {
  return request<Api.FinanceCenter.ReconciliationIssueDetail>({
    url: `${SETTLEMENT_BASE}/reconcile/issue/detail/${id}`,
    method: 'get',
  });
}

export function fetchHandleReconciliationIssue(data: Api.FinanceCenter.HandleReconciliationIssuePayload) {
  return request({
    url: `${SETTLEMENT_BASE}/reconcile/issue/handle`,
    method: 'put',
    data,
  });
}

export function fetchGetAdminCommissionStats() {
  return request<Api.FinanceCenter.DistributionCommissionStats>({
    url: `${ADMIN_FINANCE_BASE}/commission/stats`,
    method: 'get',
  });
}

export function fetchGetAdminCommissionList(params?: Api.FinanceCenter.DistributionCommissionSearchParams) {
  return request<Api.FinanceCenter.DistributionCommissionList>({
    url: `${ADMIN_FINANCE_BASE}/commission/list`,
    method: 'get',
    params,
  });
}

export function fetchGetAdminWithdrawalStats() {
  return request<Api.FinanceCenter.DistributionWithdrawalStats>({
    url: `${ADMIN_FINANCE_BASE}/withdrawal/stats`,
    method: 'get',
  });
}

function normalizeAdminWithdrawalSearchParams(
  params?: Api.FinanceCenter.DistributionWithdrawalSearchParams,
): Api.Finance.WithdrawalSearchParams | undefined {
  if (!params) {
    return undefined;
  }

  const { isAsc, ...rest } = params;
  let normalizedIsAsc: Api.Finance.WithdrawalSearchParams['isAsc'];

  if (isAsc === 'ascending') {
    normalizedIsAsc = 'asc';
  } else if (isAsc === 'descending') {
    normalizedIsAsc = 'desc';
  }

  return {
    ...rest,
    isAsc: normalizedIsAsc,
  };
}

export function fetchGetAdminWithdrawalList(params?: Api.FinanceCenter.DistributionWithdrawalSearchParams) {
  return fetchGetWithdrawalList(normalizeAdminWithdrawalSearchParams(params));
}

export const fetchAuditAdminWithdrawal = fetchAuditWithdrawal;

export function fetchGetAdminWalletStats() {
  return request<Api.FinanceCenter.WalletStats>({
    url: `${ADMIN_FINANCE_BASE}/wallet/stats`,
    method: 'get',
  });
}

export function fetchGetAdminWalletList(params?: Api.FinanceCenter.WalletSearchParams) {
  return request<Api.FinanceCenter.WalletList>({
    url: `${ADMIN_FINANCE_BASE}/wallet/list`,
    method: 'get',
    params,
  });
}

export function fetchFreezeAdminWallet(data: Api.FinanceCenter.FreezeWalletPayload) {
  return request({
    url: `${ADMIN_FINANCE_BASE}/wallet/freeze`,
    method: 'post',
    data,
  });
}

export function fetchUnfreezeAdminWallet(walletId: string) {
  return request({
    url: `${ADMIN_FINANCE_BASE}/wallet/unfreeze`,
    method: 'post',
    data: { walletId },
  });
}

export function fetchGetSettlementOverview() {
  return request<Api.FinanceCenter.SettlementOverview>({
    url: `${ADMIN_FINANCE_BASE}/settlement/overview`,
    method: 'get',
  });
}

export function fetchGetSettlementLogList(params?: Api.FinanceCenter.SettlementLogSearchParams) {
  return request<Api.FinanceCenter.SettlementLogList>({
    url: `${ADMIN_FINANCE_BASE}/settlement/logs`,
    method: 'get',
    params,
  });
}
