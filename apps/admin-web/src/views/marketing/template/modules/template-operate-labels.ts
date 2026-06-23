import type { SelectOption } from 'naive-ui';

export const templateFieldTypeOptions: SelectOption[] = [
  { label: '数字', value: 'number' },
  { label: '文本', value: 'string' },
  { label: '布尔', value: 'boolean' },
  { label: '日期时间', value: 'datetime' },
  { label: '日期', value: 'date' },
  { label: '时间', value: 'time' },
  { label: '地址', value: 'address' },
  { label: '日期范围', value: 'daterange' },
  { label: '日期时间范围', value: 'datetimerange' },
];
