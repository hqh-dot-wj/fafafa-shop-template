import type { OrchestrationWorkflow } from '../types';

export const PLAY_INSTANCE_WORKFLOW: OrchestrationWorkflow = {
  code: 'PLAY_INSTANCE',
  name: '配置玩法实例',
  entryNode: 'select-play',
  exitNode: 'online',
  nodes: [
    { id: 'select-play', label: '选择玩法', required: true, schema: { source: 'static', schemaId: 'play-select' } },
    {
      id: 'select-sku',
      label: '选择商品 SKU',
      required: true,
      schema: { source: 'static', schemaId: 'product-store-link' },
    },
    {
      id: 'course-group-schedule',
      label: '排课/地址/截止',
      branchGroup: 'COURSE_GROUP_BUY',
      required: true,
      schema: { source: 'play-rule', contextRef: 'play.code' },
    },
    {
      id: 'flash-sale-rules',
      label: '秒杀规则',
      branchGroup: 'FLASH_SALE',
      required: true,
      schema: { source: 'play-rule', contextRef: 'play.code' },
    },
    {
      id: 'member-upgrade-rules',
      label: '会员升级规则',
      branchGroup: 'MEMBER_UPGRADE',
      required: true,
      schema: { source: 'play-rule', contextRef: 'play.code' },
    },
    { id: 'preview', label: '预览', required: true, schema: { source: 'static', schemaId: 'precheck-summary' } },
    { id: 'online', label: '上线', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'select-play', to: 'select-sku', highlightOnComplete: true },
    { from: 'select-sku', to: 'course-group-schedule', highlightOnComplete: true },
    { from: 'select-sku', to: 'flash-sale-rules', highlightOnComplete: true },
    { from: 'select-sku', to: 'member-upgrade-rules', highlightOnComplete: true },
    { from: 'course-group-schedule', to: 'preview', highlightOnComplete: true },
    { from: 'flash-sale-rules', to: 'preview', highlightOnComplete: true },
    { from: 'member-upgrade-rules', to: 'preview', highlightOnComplete: true },
    { from: 'preview', to: 'online', highlightOnComplete: true },
  ],
  branchRules: [
    {
      decidedBy: 'select-play',
      field: 'code',
      routes: { COURSE_GROUP_BUY: 'COURSE_GROUP_BUY', FLASH_SALE: 'FLASH_SALE', MEMBER_UPGRADE: 'MEMBER_UPGRADE' },
    },
  ],
};
