import type { OrchestrationWorkflow } from '../types';

export const POINTS_RULES_WORKFLOW: OrchestrationWorkflow = {
  code: 'POINTS_RULES',
  name: '配置积分规则',
  entryNode: 'basic',
  exitNode: 'publish',
  nodes: [
    { id: 'basic', label: '基础信息', required: true, schema: { source: 'static', schemaId: 'points-basic' } },
    { id: 'earn', label: '获取规则', required: true, schema: { source: 'static', schemaId: 'points-earn' } },
    { id: 'deduct', label: '抵扣规则', required: true, schema: { source: 'static', schemaId: 'points-deduct' } },
    { id: 'expire', label: '过期策略', required: true, schema: { source: 'static', schemaId: 'points-expire' } },
    { id: 'preview', label: '预览', required: true, schema: { source: 'static', schemaId: 'precheck-summary' } },
    { id: 'publish', label: '发布', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'basic', to: 'earn', highlightOnComplete: true },
    { from: 'earn', to: 'deduct', highlightOnComplete: true },
    { from: 'deduct', to: 'expire', highlightOnComplete: true },
    { from: 'expire', to: 'preview', highlightOnComplete: true },
    { from: 'preview', to: 'publish', highlightOnComplete: true },
  ],
  branchRules: [],
};
