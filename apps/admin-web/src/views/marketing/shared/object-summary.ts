export type ObjectSummaryItem = {
  key: string;
  label: string;
  value: string;
};

type SummaryOptions = {
  labelMap?: Record<string, string>;
  emptyText?: string;
  maxItems?: number;
  maxValueLength?: number;
};

const defaultLabelMap: Record<string, string> = {
  id: 'ID',
  tenantId: '租户ID',
  memberId: '会员ID',
  productId: '商品ID',
  serviceId: '服务ID',
  configId: '配置ID',
  templateCode: '模板编码',
  policyCode: '策略编码',
  policyName: '策略名称',
  policyType: '策略类型',
  status: '状态',
  createTime: '创建时间',
  updateTime: '更新时间',
  orderId: '系统订单ID',
  orderSn: '订单号',
  traceId: 'Trace',
  sourceStep: '来源步骤',
  eventId: '事件ID',
  eventType: '事件类型',
  code: '编码',
  name: '名称',
  payload: '事件内容',
  instanceData: '实例业务数据',
  clauses: '条款',
  primaryOfferTypes: '主优惠类型',
  conflictMatrix: '冲突矩阵',
  rules: '规则',
  sortRules: '排序规则',
  templateConfig: '模板配置',
  outputSchema: '输出字段',
  maxLength: '字数建议',
};

function resolveLabel(key: string, labelMap?: Record<string, string>) {
  return labelMap?.[key] ?? defaultLabelMap[key] ?? key;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPrimitive(value: unknown) {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

export function toPlainRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}

export function formatSummaryValue(value: unknown, options: SummaryOptions = {}): string {
  const emptyText = options.emptyText ?? '暂无';
  const maxValueLength = options.maxValueLength ?? 80;

  if (value === null || value === undefined || value === '') {
    return emptyText;
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : emptyText;
  }
  if (typeof value === 'string') {
    return truncate(value.trim() || emptyText, maxValueLength);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return emptyText;
    const primitiveValues = value.filter(isPrimitive).map(item => formatSummaryValue(item, options));
    if (primitiveValues.length === value.length) {
      const visible = primitiveValues.slice(0, 3).join('、');
      return value.length > 3 ? `${visible} 等 ${value.length} 项` : visible;
    }
    return `${value.length} 项`;
  }
  if (isPlainRecord(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) return emptyText;
    const visible = keys.slice(0, 3).map(key => resolveLabel(key, options.labelMap)).join('、');
    return keys.length > 3 ? `已配置 ${visible} 等 ${keys.length} 项` : `已配置 ${visible}`;
  }

  return emptyText;
}

export function buildObjectSummary(value: unknown, options: SummaryOptions = {}): ObjectSummaryItem[] {
  const record = toPlainRecord(value);
  const maxItems = options.maxItems ?? 12;
  const entries = Object.entries(record).filter(([, item]) => item !== undefined && item !== null && item !== '');

  return entries.slice(0, maxItems).map(([key, item]) => ({
    key,
    label: resolveLabel(key, options.labelMap),
    value: formatSummaryValue(item, options),
  }));
}

export function formatObjectSummaryText(value: unknown, options: SummaryOptions = {}) {
  const items = buildObjectSummary(value, options);
  if (items.length === 0) return options.emptyText ?? '暂无';
  return items.map(item => `${item.label}：${item.value}`).join('\n');
}

export function formatObjectInlineSummary(value: unknown, options: SummaryOptions = {}) {
  const items = buildObjectSummary(value, { ...options, maxItems: options.maxItems ?? 4 });
  if (items.length === 0) return options.emptyText ?? '暂无';
  return items.map(item => `${item.label}: ${item.value}`).join('；');
}

export function formatObjectEditorText(value: unknown, options: SummaryOptions = {}) {
  const record = toPlainRecord(value);
  return Object.entries(record)
    .filter(([, item]) => item !== undefined && item !== null && item !== '')
    .map(([key, item]) => `${key} = ${formatSummaryValue(item, options)}`)
    .join('\n');
}

function parseScalarValue(value: string): unknown {
  const normalized = value.trim();
  if (!normalized || normalized === '暂无' || normalized === '-') return '';
  if (['true', '是'].includes(normalized.toLowerCase())) return true;
  if (['false', '否'].includes(normalized.toLowerCase())) return false;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  return normalized;
}

function isComplexValue(value: unknown) {
  return Boolean(value) && typeof value === 'object';
}

export function parseObjectEditorText(text: string): Record<string, unknown> {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .reduce<Record<string, unknown>>((acc, line) => {
      const separatorIndex = ['=', '：', ':']
        .map(separator => line.indexOf(separator))
        .filter(index => index > 0)
        .sort((a, b) => a - b)[0];
      if (!separatorIndex) return acc;
      const key = line.slice(0, separatorIndex).trim();
      if (!key) return acc;
      acc[key] = parseScalarValue(line.slice(separatorIndex + 1));
      return acc;
    }, {});
}

export function buildObjectFromEditableText(base: unknown, text: string): Record<string, unknown> {
  const baseRecord = toPlainRecord(base);
  const parsed = parseObjectEditorText(text);
  const next = { ...baseRecord };

  Object.entries(parsed).forEach(([key, value]) => {
    if (isComplexValue(baseRecord[key])) {
      return;
    }
    next[key] = value;
  });

  return next;
}
