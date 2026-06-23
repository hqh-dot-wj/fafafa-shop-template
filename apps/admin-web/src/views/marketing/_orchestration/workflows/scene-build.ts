import type { OrchestrationWorkflow } from '../types';

const templateRoutes = {
  HOMEPAGE_PROMOTION_FEED: 'HOMEPAGE_PROMOTION_FEED',
  NEW_CUSTOMER_ZONE: 'NEW_CUSTOMER_ZONE',
  MEMBER_DAY_BANNER: 'MEMBER_DAY_BANNER',
  FLASH_SALE_TIMEBOX: 'FLASH_SALE_TIMEBOX',
  DISTRIBUTION_LANDING: 'DISTRIBUTION_LANDING',
};

export const SCENE_BUILD_WORKFLOW: OrchestrationWorkflow = {
  code: 'SCENE_BUILD',
  name: '搭建营销场景',
  entryNode: 'select-template',
  exitNode: 'publish',
  nodes: [
    {
      id: 'select-template',
      label: '选择模板',
      required: true,
      schema: { source: 'static', schemaId: 'scene-template-select' },
    },
    {
      id: 'scene-basic',
      label: '基础信息',
      required: true,
      schema: { source: 'static', schemaId: 'scene-basic-info' },
    },
    ...Object.keys(templateRoutes).flatMap((templateCode) => [
      {
        id: `${templateCode.toLowerCase()}-layout`,
        label: '配置版式',
        branchGroup: templateCode,
        required: true,
        schema: { source: 'scene-template' as const, contextRef: 'scene.templateCode' },
      },
      {
        id: `${templateCode.toLowerCase()}-pool`,
        label: '选择活动池',
        branchGroup: templateCode,
        required: true,
        schema: { source: 'static' as const, schemaId: 'activity-pool-picker' },
      },
    ]),
    { id: 'touchpoint', label: '绑定触点', required: false, schema: { source: 'static', schemaId: 'touchpoint-form' } },
    { id: 'preview', label: '预览', required: true, schema: { source: 'static', schemaId: 'scene-preview' } },
    { id: 'publish', label: '发布', required: true, schema: { source: 'static', schemaId: 'publish-confirm' } },
  ],
  edges: [
    { from: 'select-template', to: 'scene-basic', highlightOnComplete: true },
    ...Object.keys(templateRoutes).flatMap((templateCode) => [
      { from: 'scene-basic', to: `${templateCode.toLowerCase()}-layout`, highlightOnComplete: true },
      {
        from: `${templateCode.toLowerCase()}-layout`,
        to: `${templateCode.toLowerCase()}-pool`,
        highlightOnComplete: true,
      },
      { from: `${templateCode.toLowerCase()}-pool`, to: 'touchpoint', highlightOnComplete: true },
    ]),
    { from: 'touchpoint', to: 'preview', highlightOnComplete: true },
    { from: 'preview', to: 'publish', highlightOnComplete: true },
  ],
  branchRules: [{ decidedBy: 'select-template', field: 'templateCode', routes: templateRoutes }],
};
