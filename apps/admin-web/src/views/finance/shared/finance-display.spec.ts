import { describe, expect, it } from 'vitest';
import {
  buildTenantLabelMap,
  financeBizScopeOptions,
  financeChannelOptions,
  getFinanceChannelLabel,
  getFinanceIssueTypeLabel,
  getFinanceReasonCodeLabel,
  getFinanceReconciliationResultStatusLabel,
  getFinanceSettlementBillStatusLabel,
  getFinanceStatementSourceTypeLabel,
  getFinanceTenantLabel,
} from './finance-display';

describe('finance-display', () => {
  it('应把通道和状态枚举转换成后台可读中文', () => {
    expect(getFinanceChannelLabel('WECHAT_PROFITSHARING')).toBe('微信官方分账');
    expect(getFinanceChannelLabel('BANK_TRANSFER')).toBe('银行卡转账');
    expect(getFinanceSettlementBillStatusLabel('PENDING_REVIEW')).toBe('待审核');
    expect(getFinanceReconciliationResultStatusLabel('UNMATCHED')).toBe('正式异常');
    expect(getFinanceStatementSourceTypeLabel('GENERATED')).toBe('系统生成');
    expect(getFinanceIssueTypeLabel('AMOUNT_MISMATCH')).toBe('金额不一致');
    expect(getFinanceReasonCodeLabel('REFUND_AMOUNT_BREAKDOWN_MISMATCH')).toBe('退款金额口径不一致');
    expect(getFinanceReasonCodeLabel('TIME_WINDOW_BUFFERED')).toBe('边缘时间待复核');
  });

  it('应优先显示租户名称，其次显示租户编号', () => {
    const labelMap = buildTenantLabelMap([
      { tenantId: '000001', companyName: '湖南科技有限公司' },
      { tenantId: '000002', companyName: '' },
    ]);

    expect(getFinanceTenantLabel('000001', labelMap)).toBe('湖南科技有限公司');
    expect(getFinanceTenantLabel('000002', labelMap)).toBe('000002');
    expect(getFinanceTenantLabel('', labelMap)).toBe('-');
  });

  it('应提供可直接用于下拉框的中文选项', () => {
    expect(financeChannelOptions.find((item) => item.value === 'WECHAT_PAY')?.label).toBe('微信支付');
    expect(financeChannelOptions.find((item) => item.value === 'OFFLINE_TRANSFER')?.label).toBe('线下人工打款');
    expect(financeBizScopeOptions.find((item) => item.value === 'REFUND')?.label).toBe('退款');
    expect(financeBizScopeOptions.find((item) => item.value === 'SETTLEMENT')?.label).toBe('结算');
  });
});
