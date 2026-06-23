import type { SelectOption } from 'naive-ui';

export const navigationNodeTypeOptions: SelectOption[] = [
  { label: '分类节点', value: 'CATEGORY' },
  { label: '场景节点', value: 'SCENE' },
  { label: '跳转节点', value: 'LINK' },
];

export const navigationStatusOptions: SelectOption[] = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '草稿', value: 'DRAFT' },
];

export const navigationChannelScopeOptions: SelectOption[] = [
  { label: '小程序', value: 'miniapp' },
  { label: 'H5', value: 'h5' },
  { label: '后台预览', value: 'admin' },
];
