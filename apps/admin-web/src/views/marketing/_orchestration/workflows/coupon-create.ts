import type { OrchestrationWorkflow } from '../types';

export const COUPON_CREATE_WORKFLOW: OrchestrationWorkflow = {
  code: 'COUPON_CREATE',
  name: '创建优惠券模板',
  entryNode: 'coupon-basic',
  exitNode: 'publish',
  nodes: [
    { id: 'coupon-basic', label: '基础信息', required: true, schema: { source: 'coupon-dto' } },
    { id: 'coupon-limits', label: '领取限制', required: true, schema: { source: 'static', schemaId: 'coupon-limits' } },
    {
      id: 'grant-manual',
      label: '手动领取',
      branchGroup: 'MANUAL_CLAIM',
      required: true,
      schema: { source: 'static', schemaId: 'coupon-manual' },
    },
    {
      id: 'grant-activity',
      label: '活动发放',
      branchGroup: 'ACTIVITY_GRANT',
      required: true,
      schema: { source: 'static', schemaId: 'activity-pool-picker' },
    },
    {
      id: 'grant-signin',
      label: '签到发放',
      branchGroup: 'SIGNIN_GRANT',
      required: true,
      schema: { source: 'static', schemaId: 'signin-grant' },
    },
    { id: 'preview', label: '预览', required: true, schema: { source: 'static', schemaId: 'precheck-summary' } },
    { id: 'publish', label: '发布', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'coupon-basic', to: 'coupon-limits', highlightOnComplete: true },
    { from: 'coupon-limits', to: 'grant-manual', highlightOnComplete: true },
    { from: 'coupon-limits', to: 'grant-activity', highlightOnComplete: true },
    { from: 'coupon-limits', to: 'grant-signin', highlightOnComplete: true },
    { from: 'grant-manual', to: 'preview', highlightOnComplete: true },
    { from: 'grant-activity', to: 'preview', highlightOnComplete: true },
    { from: 'grant-signin', to: 'preview', highlightOnComplete: true },
    { from: 'preview', to: 'publish', highlightOnComplete: true },
  ],
  branchRules: [
    {
      decidedBy: 'coupon-limits',
      field: 'grantMode',
      routes: { MANUAL_CLAIM: 'MANUAL_CLAIM', ACTIVITY_GRANT: 'ACTIVITY_GRANT', SIGNIN_GRANT: 'SIGNIN_GRANT' },
    },
  ],
};
