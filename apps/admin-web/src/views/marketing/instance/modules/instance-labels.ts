import type { SelectOption } from 'naive-ui';

export const instanceStatusOptions: SelectOption[] = [
  { label: '待支付', value: 'PENDING_PAY' },
  { label: '已支付', value: 'PAID' },
  { label: '进行中', value: 'ACTIVE' },
  { label: '成功', value: 'SUCCESS' },
  { label: '超时', value: 'TIMEOUT' },
  { label: '失败', value: 'FAILED' },
  { label: '已退款', value: 'REFUNDED' },
];
