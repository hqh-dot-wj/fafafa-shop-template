import {
  fetchCampaignPolicySchema,
  fetchPlayRuleSchema,
  fetchSceneTemplateSchema,
} from '@/service/api/marketing/orchestration';
import type { JsonSchemaObject, NodeSchemaRef } from '@/views/marketing/_orchestration/types';

export interface ResolveSchemaContext {
  workflowData: Record<string, unknown>;
  nodeFormData?: Record<string, Record<string, unknown> | undefined>;
}

const EMPTY_SCHEMA: JsonSchemaObject = {
  type: 'object',
  title: '待选择',
  properties: {
    pending: {
      type: 'string',
      title: '提示',
      default: '',
      'ui:placeholder': '请先完成前置节点',
    },
  },
};

export const STATIC_SCHEMAS: Record<string, JsonSchemaObject> = {
  'campaign-type-select': {
    type: 'object',
    title: '选择活动类型',
    required: ['type'],
    properties: {
      type: {
        type: 'string',
        title: '活动类型',
        enum: [
          'FIRST_ORDER',
          'FULL_REDUCTION',
          'MEMBER_DAY',
          'PROMOTION_PRICE',
          'BIRTHDAY',
          'NEWCOMER_EXCLUSIVE',
          'DISTRIBUTION_GROWTH',
          'COURSE_GROUP_BUY',
          'FLASH_SALE',
          'MEMBER_UPGRADE',
        ],
        enumNames: [
          '首单优惠',
          '满减活动',
          '会员日',
          '促销价',
          '生日礼',
          '新人专享',
          '分销成长',
          '拼班课程',
          '限时秒杀',
          '会员升级',
        ],
      },
    },
  },
  'campaign-basic-info': {
    type: 'object',
    title: '基础信息',
    required: ['name', 'dateRange'],
    properties: {
      name: { type: 'string', title: '活动名称' },
      description: { type: 'string', title: '活动说明' },
      dateRange: { type: 'array', title: '活动时间', 'ui:widget': 'TimeRangePicker' },
    },
  },
  'audience-form': {
    type: 'object',
    title: '目标人群',
    required: ['audience'],
    properties: {
      audience: { type: 'array', title: '人群规则', 'ui:widget': 'MemberFilterEditor' },
    },
  },
  'rewards-form': {
    type: 'object',
    title: '奖励配置',
    properties: {
      couponTemplateIds: { type: 'array', title: '优惠券', 'ui:widget': 'CouponPicker' },
      pointsReward: { type: 'integer', title: '积分奖励', minimum: 0 },
    },
  },
  'product-store-link': {
    type: 'object',
    title: '关联商品/适用租户',
    required: ['products'],
    properties: {
      products: { type: 'array', title: '商品', 'ui:widget': 'ProductPicker' },
      stores: { type: 'array', title: '适用租户', 'ui:widget': 'StorePicker' },
    },
  },
  'precheck-summary': {
    type: 'object',
    title: '预检',
    properties: {
      remark: { type: 'string', title: '预检备注' },
    },
  },
  'publish-confirm': {
    type: 'object',
    title: '预览与发布',
    properties: {
      publishNow: { type: 'boolean', title: '立即发布', default: false },
    },
  },
  'scene-template-select': {
    type: 'object',
    title: '选择场景模板',
    required: ['templateCode'],
    properties: {
      templateCode: {
        type: 'string',
        title: '模板',
        enum: [
          'HOMEPAGE_PROMOTION_FEED',
          'NEW_CUSTOMER_ZONE',
          'MEMBER_DAY_BANNER',
          'FLASH_SALE_TIMEBOX',
          'DISTRIBUTION_LANDING',
        ],
      },
    },
  },
  'scene-basic-info': {
    type: 'object',
    title: '场景基础信息',
    required: ['sceneCode', 'sceneName'],
    properties: {
      sceneCode: { type: 'string', title: '场景编码' },
      sceneName: { type: 'string', title: '场景名称' },
    },
  },
  'activity-pool-picker': {
    type: 'object',
    title: '活动池',
    properties: {
      activityPool: { type: 'array', title: '活动池', 'ui:widget': 'ActivityPoolPicker' },
    },
  },
  'touchpoint-form': {
    type: 'object',
    title: '触点',
    properties: {
      route: { type: 'string', title: '页面路径' },
    },
  },
  'scene-preview': {
    type: 'object',
    title: '预览',
    properties: {
      remark: { type: 'string', title: '预览备注' },
    },
  },
  'virtual-fill-form': {
    type: 'object',
    title: '虚拟补位',
    properties: {
      enableVirtualFill: { type: 'boolean', title: '启用虚拟补位' },
      virtualFillWindowMinutes: { type: 'integer', title: '自动补位窗口（分钟）', minimum: 0 },
    },
  },
  'coupon-base-form': {
    type: 'object',
    title: '优惠券基础信息',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string', title: '优惠券名称' },
      type: { type: 'string', title: '优惠券类型', enum: ['DISCOUNT', 'PERCENTAGE', 'EXCHANGE'] },
    },
  },
};

export async function resolveNodeSchema(ref: NodeSchemaRef, ctx: ResolveSchemaContext): Promise<JsonSchemaObject> {
  switch (ref.source) {
    case 'static':
      return STATIC_SCHEMAS[ref.schemaId || ''] ?? EMPTY_SCHEMA;
    case 'coupon-dto':
      return STATIC_SCHEMAS['coupon-base-form'];
    case 'campaign-policy': {
      const type = readContextRef(ctx, ref.contextRef);
      if (!type) return EMPTY_SCHEMA;
      const { data } = await fetchCampaignPolicySchema(type);
      return data as JsonSchemaObject;
    }
    case 'play-rule': {
      const code = readContextRef(ctx, ref.contextRef);
      if (!code) return EMPTY_SCHEMA;
      const { data } = await fetchPlayRuleSchema(code);
      return data as JsonSchemaObject;
    }
    case 'scene-template': {
      const templateCode = readContextRef(ctx, ref.contextRef);
      if (!templateCode) return EMPTY_SCHEMA;
      const { data } = await fetchSceneTemplateSchema(templateCode);
      return data as JsonSchemaObject;
    }
    default:
      return EMPTY_SCHEMA;
  }
}

export function readContextRef(ctx: ResolveSchemaContext, contextRef?: string): string {
  if (!contextRef) return '';
  const direct = readDottedValue(ctx.workflowData, contextRef);
  if (direct !== null && direct !== undefined) return String(direct);

  const nodeData = ctx.nodeFormData ?? {};
  const fallbackMap: Record<string, [string, string]> = {
    'campaign.type': ['select-type', 'type'],
    'scene.templateCode': ['select-template', 'templateCode'],
    'play.code': ['select-play', 'code'],
  };
  const fallback = fallbackMap[contextRef];
  if (!fallback) return '';
  const value = nodeData[fallback[0]]?.[fallback[1]];
  return value === null || value === undefined ? '' : String(value);
}

function readDottedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}
