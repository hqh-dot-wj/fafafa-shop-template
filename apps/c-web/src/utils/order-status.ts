/** 订单状态展示文案（与 miniapp order/list、detail 对齐）。 */

export const ORDER_STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'PENDING_PAY' },
  { label: '已支付', value: 'PAID' },
  { label: '已完成', value: 'COMPLETED' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAY: '待支付',
  PAID: '已支付',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
};

export function formatOrderStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function formatOrderTime(timeStr: string): string {
  const date = new Date(timeStr);
  if (Number.isNaN(date.getTime())) return timeStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}
