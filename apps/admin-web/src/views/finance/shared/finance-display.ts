type LabelMap = Record<string, string>;

function toOptions<T extends string>(labelMap: Record<T, string>) {
  return Object.entries(labelMap).map(([value, label]) => ({
    label,
    value,
  })) as Array<{ label: string; value: T }>;
}

const financeChannelLabelMap: LabelMap = {
  WECHAT_PAY: '微信支付',
  WECHAT_PROFITSHARING: '微信官方分账',
  WECHAT_TRANSFER: '微信零钱转账',
  BANK_TRANSFER: '银行卡转账',
  OFFLINE_TRANSFER: '线下人工打款',
};

const settlementBillStatusLabelMap: LabelMap = {
  INIT: '初始化',
  PENDING_REVIEW: '待审核',
  REJECTED: '已驳回',
  APPROVED: '已审核',
  EXECUTING: '执行中',
  SUCCESS: '已成功',
  FAILED: '已失败',
  RECONCILING: '对账中',
  CLOSED: '已关闭',
};

const reconciliationResultStatusLabelMap: LabelMap = {
  MATCHED: '已匹配',
  UNMATCHED: '正式异常',
  BUFFERED: '缓冲中',
  IGNORED: '已忽略',
};

const reconciliationBatchStatusLabelMap: LabelMap = {
  INIT: '初始化',
  RUNNING: '执行中',
  COMPLETED: '已完成',
  FAILED: '执行失败',
};

const reconciliationBufferStatusLabelMap: LabelMap = {
  WAITING: '待复核',
  RECHECKING: '复核中',
  MATCHED: '已消除',
  EXPIRED: '已过期',
  IGNORED: '已忽略',
};

const reconciliationIssueStatusLabelMap: LabelMap = {
  WAITING: '待处理',
  MATCHED: '已匹配',
  UNMATCHED: '差异待处理',
  HANDLED: '已处理',
};

const statementBatchStatusLabelMap: LabelMap = {
  INIT: '初始化',
  NORMALIZED: '已标准化',
  FAILED: '处理失败',
};

const statementSourceTypeLabelMap: LabelMap = {
  GENERATED: '系统生成',
  IMPORTED: '文件导入',
  MANUAL: '人工录入',
};

const bizScopeLabelMap: LabelMap = {
  PAYMENT: '支付',
  REFUND: '退款',
  SETTLEMENT: '结算',
  WITHDRAWAL: '提现',
};

const receiverTypeLabelMap: LabelMap = {
  TENANT: '租户主体',
  MEMBER: '会员',
  MERCHANT: '商户号',
  BANK_ACCOUNT: '银行账户',
};

const profileStatusLabelMap: LabelMap = {
  DRAFT: '草稿',
  ACTIVE: '已启用',
  DISABLED: '已停用',
};

const paymentStatusLabelMap: LabelMap = {
  PENDING: '待支付',
  SUCCESS: '支付成功',
  FAILED: '支付失败',
  REFUNDED: '已退款',
  CLOSED: '已关闭',
};

const settlementExecutionStatusLabelMap: LabelMap = {
  PENDING: '待执行',
  PROCESSING: '处理中',
  SUCCESS: '执行成功',
  FAILED: '执行失败',
  CLOSED: '已关闭',
};

const issueTypeLabelMap: LabelMap = {
  MATCHED: '已匹配',
  LOCAL_MISSING: '本地缺单',
  CHANNEL_MISSING: '渠道缺单',
  AMOUNT_MISMATCH: '金额不一致',
  STATUS_MISMATCH: '状态不一致',
  EXECUTION_PENDING: '执行处理中',
  CHANNEL_FAILED: '渠道执行失败',
  CHANNEL_PROCESSING: '渠道处理中',
  TIME_WINDOW_BUFFERED: '边缘时间待复核',
  STATEMENT_DELAY: '账单延迟',
  REFUND_AMOUNT_BREAKDOWN_MISMATCH: '退款金额口径不一致',
  REFUND_NOT_SUCCESS_IGNORED: '退款未成功忽略',
};

/** 内网结算日志：触发方式筛选 */
const settlementLogTriggerLabelMap: LabelMap = {
  SCHEDULED: '定时任务',
  MANUAL: '手动触发',
};

/** 内网钱包列表：状态筛选 */
const adminWalletStatusLabelMap: LabelMap = {
  NORMAL: '正常',
  FROZEN: '冻结',
  DISABLED: '禁用',
};

/** 对账异常处理动作 */
const reconciliationIssueHandleActionLabelMap: LabelMap = {
  MARK_SUCCESS: '确认成功',
  MARK_FAILED: '确认失败',
  MARK_HANDLED: '关闭异常',
};

export const financeChannelOptions = toOptions(financeChannelLabelMap);
export const financeSettlementBillStatusOptions = toOptions(settlementBillStatusLabelMap);
export const financeReconciliationResultStatusOptions = toOptions(reconciliationResultStatusLabelMap);
export const financeReconciliationBatchStatusOptions = toOptions(reconciliationBatchStatusLabelMap);
export const financeReconciliationBufferStatusOptions = toOptions(reconciliationBufferStatusLabelMap);
export const financeReconciliationIssueStatusOptions = toOptions(reconciliationIssueStatusLabelMap);
export const financeSettlementLogTriggerOptions = toOptions(settlementLogTriggerLabelMap);
export const financeAdminWalletStatusOptions = toOptions(adminWalletStatusLabelMap);
export const financeReconciliationIssueHandleActionOptions = toOptions(reconciliationIssueHandleActionLabelMap);
export const financeStatementBatchStatusOptions = toOptions(statementBatchStatusLabelMap);
export const financeStatementSourceTypeOptions = toOptions(statementSourceTypeLabelMap);
export const financeBizScopeOptions = toOptions(bizScopeLabelMap);
export const financeReceiverTypeOptions = toOptions(receiverTypeLabelMap);
export const financeProfileStatusOptions = toOptions(profileStatusLabelMap);
export const financePaymentStatusOptions = toOptions(paymentStatusLabelMap);
export const financeSettlementExecutionStatusOptions = toOptions(settlementExecutionStatusLabelMap);

function getLabel(value: string | null | undefined, labelMap: LabelMap): string {
  if (!value) return '-';
  return labelMap[value] ?? value;
}

export function getFinanceChannelLabel(value: string | null | undefined) {
  return getLabel(value, financeChannelLabelMap);
}

export function getFinanceSettlementBillStatusLabel(value: string | null | undefined) {
  return getLabel(value, settlementBillStatusLabelMap);
}

export function getFinanceReconciliationResultStatusLabel(value: string | null | undefined) {
  return getLabel(value, reconciliationResultStatusLabelMap);
}

export function getFinanceReconciliationBatchStatusLabel(value: string | null | undefined) {
  return getLabel(value, reconciliationBatchStatusLabelMap);
}

export function getFinanceReconciliationBufferStatusLabel(value: string | null | undefined) {
  return getLabel(value, reconciliationBufferStatusLabelMap);
}

export function getFinanceReconciliationIssueStatusLabel(value: string | null | undefined) {
  return getLabel(value, reconciliationIssueStatusLabelMap);
}

export function getFinanceStatementBatchStatusLabel(value: string | null | undefined) {
  return getLabel(value, statementBatchStatusLabelMap);
}

export function getFinanceStatementSourceTypeLabel(value: string | null | undefined) {
  return getLabel(value, statementSourceTypeLabelMap);
}

export function getFinanceBizScopeLabel(value: string | null | undefined) {
  return getLabel(value, bizScopeLabelMap);
}

export function getFinanceReceiverTypeLabel(value: string | null | undefined) {
  return getLabel(value, receiverTypeLabelMap);
}

export function getFinanceProfileStatusLabel(value: string | null | undefined) {
  return getLabel(value, profileStatusLabelMap);
}

export function getFinancePaymentStatusLabel(value: string | null | undefined) {
  return getLabel(value, paymentStatusLabelMap);
}

export function getFinanceSettlementExecutionStatusLabel(value: string | null | undefined) {
  return getLabel(value, settlementExecutionStatusLabelMap);
}

export function getFinanceIssueTypeLabel(value: string | null | undefined) {
  return getLabel(value, issueTypeLabelMap);
}

export function getFinanceReasonCodeLabel(value: string | null | undefined) {
  return getLabel(value, issueTypeLabelMap);
}

export function buildTenantLabelMap(
  rows: Array<{ tenantId: string; companyName?: string | null }>,
): Record<string, string> {
  return rows.reduce<Record<string, string>>((acc, item) => {
    const name = item.companyName?.trim();
    acc[item.tenantId] = name || item.tenantId;
    return acc;
  }, {});
}

export function getFinanceTenantLabel(tenantId: string | null | undefined, labelMap: Record<string, string>) {
  if (!tenantId) return '-';
  return labelMap[tenantId] || tenantId;
}
