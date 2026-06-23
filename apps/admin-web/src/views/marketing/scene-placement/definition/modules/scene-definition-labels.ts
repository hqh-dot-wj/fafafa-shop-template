import type { SelectOption } from 'naive-ui';

/**
 * 与平台字典 `marketing_scene_type`、湖南演示种子场景类型及卡片策略编码对齐。
 * 未命中时 UI 回退显示原始编码。
 */
export const SCENE_TYPE_LABEL: Record<string, string> = {
  HOMEPAGE: '首页场景',
  CATEGORY: '分类场景',
  COURSE_GROUP_RECOMMEND: '拼课推荐',
  FEATURED: '严选专区',
  PRODUCT_DETAIL: '商品详情',
  ACTIVITY_ZONE: '活动专区',
  SEARCH_RESULT: '搜索结果',
  FLASH_ZONE: '秒杀专区',
  NEWCOMER: '新人专区',
  COURSE: '课程/服务专区',
};

/** 表单/筛选项顺序，保持展示稳定 */
export const SCENE_TYPE_OPTION_VALUES: string[] = [
  'HOMEPAGE',
  'CATEGORY',
  'FEATURED',
  'COURSE_GROUP_RECOMMEND',
  'FLASH_ZONE',
  'NEWCOMER',
  'COURSE',
  'PRODUCT_DETAIL',
  'ACTIVITY_ZONE',
  'SEARCH_RESULT',
];

export const sceneTypeSelectOptions: SelectOption[] = SCENE_TYPE_OPTION_VALUES.map(value => ({
  value,
  label: SCENE_TYPE_LABEL[value] ?? value,
}));

export const sceneDefinitionStatusOptions: SelectOption[] = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '草稿', value: 'DRAFT' },
];

export const sceneDefinitionChannelOptions: SelectOption[] = [
  { label: '小程序', value: 'miniapp' },
  { label: 'H5', value: 'h5' },
  { label: '后台预览', value: 'admin' },
];

export const sceneDefinitionStoreMatchModeOptions: SelectOption[] = [
  { label: '当前定位门店', value: 'CURRENT_STORE' },
  { label: '全门店可见', value: 'ALL_STORES' },
];

export const sceneDefinitionSortModeOptions: SelectOption[] = [
  { label: '推荐权重', value: 'RECOMMEND_WEIGHT' },
  { label: '更新时间', value: 'UPDATE_TIME' },
];

/** defaultCardTemplateCode / 模块 cardTemplateCode 常见取值（与 mkt_policy.policy_code 一致） */
export const CARD_TEMPLATE_LABEL: Record<string, string> = {
  HF_CARD_HERO: '主视觉卡片',
  HF_CARD_SIMPLE: '简版卡片',
  NR_CARD_SIMPLE: '简版卡片模板',
  SYS_DEFAULT_CARD_SIMPLE: '平台默认简版卡片',
};

const CARD_TEMPLATE_OPTION_ORDER = ['SYS_DEFAULT_CARD_SIMPLE', 'HF_CARD_SIMPLE', 'HF_CARD_HERO', 'NR_CARD_SIMPLE'] as const;

export const cardTemplateSelectOptions: SelectOption[] = CARD_TEMPLATE_OPTION_ORDER.map(value => ({
  value,
  label: `${CARD_TEMPLATE_LABEL[value] ?? value}（${value}）`,
}));

export function formatSceneType(sceneType: string | null | undefined) {
  if (!sceneType) return '-';
  return SCENE_TYPE_LABEL[sceneType] ?? sceneType;
}

export function formatCardTemplate(code: string | null | undefined) {
  if (!code?.trim()) return '-';
  const trimmed = code.trim();
  return CARD_TEMPLATE_LABEL[trimmed] ?? trimmed;
}

/** 活动类型过滤列表展示，与门店活动等活动类型枚举部分重合 */
export const ACTIVITY_TYPE_FILTER_LABEL: Record<string, string> = {
  COURSE_GROUP: '拼课活动',
  COURSE_GROUP_BUY: '团课拼团',
  FLASH_SALE: '限时抢购',
  PROMOTION_PRICE: '促销价',
  NEWCOMER_EXCLUSIVE: '新人专享',
};

export function formatActivityTypeFilter(value: string | null | undefined) {
  if (!value) return '-';
  const key = value.trim();
  if (!key) return '-';
  return ACTIVITY_TYPE_FILTER_LABEL[key] ?? key;
}
