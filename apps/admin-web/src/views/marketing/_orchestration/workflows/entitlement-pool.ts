import type { OrchestrationWorkflow } from '../types';

export const ENTITLEMENT_POOL_WORKFLOW: OrchestrationWorkflow = {
  code: 'ENTITLEMENT_POOL',
  name: '配置权益池',
  entryNode: 'select-pool-type',
  exitNode: 'publish',
  nodes: [
    {
      id: 'select-pool-type',
      label: '选择权益类型',
      required: true,
      schema: { source: 'static', schemaId: 'pool-type-select' },
    },
    {
      id: 'product-pool',
      label: '商品池',
      branchGroup: 'PRODUCT',
      required: true,
      schema: { source: 'static', schemaId: 'product-store-link' },
    },
    {
      id: 'coupon-pool',
      label: '券池',
      branchGroup: 'COUPON',
      required: true,
      schema: { source: 'static', schemaId: 'coupon-picker' },
    },
    {
      id: 'points-pool',
      label: '积分池',
      branchGroup: 'POINTS',
      required: true,
      schema: { source: 'static', schemaId: 'points-basic' },
    },
    { id: 'compile', label: '编译', required: true, schema: { source: 'static', schemaId: 'precheck-summary' } },
    {
      id: 'link-campaign',
      label: '关联活动',
      required: true,
      schema: { source: 'static', schemaId: 'activity-pool-picker' },
    },
    { id: 'publish', label: '发布', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'select-pool-type', to: 'product-pool', highlightOnComplete: true },
    { from: 'select-pool-type', to: 'coupon-pool', highlightOnComplete: true },
    { from: 'select-pool-type', to: 'points-pool', highlightOnComplete: true },
    { from: 'product-pool', to: 'compile', highlightOnComplete: true },
    { from: 'coupon-pool', to: 'compile', highlightOnComplete: true },
    { from: 'points-pool', to: 'compile', highlightOnComplete: true },
    { from: 'compile', to: 'link-campaign', highlightOnComplete: true },
    { from: 'link-campaign', to: 'publish', highlightOnComplete: true },
  ],
  branchRules: [
    {
      decidedBy: 'select-pool-type',
      field: 'poolType',
      routes: { PRODUCT: 'PRODUCT', COUPON: 'COUPON', POINTS: 'POINTS' },
    },
  ],
};
