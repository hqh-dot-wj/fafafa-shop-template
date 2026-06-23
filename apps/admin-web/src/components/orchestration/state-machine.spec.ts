import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CREATE_WORKFLOW } from '@/views/marketing/_orchestration/workflows/campaign-create';
import type { NodeStatusContext } from '@/views/marketing/_orchestration/types';
import { deriveNodeStatus, isNodeInActiveBranch, nextRecommended } from './state-machine';

function ctx(overrides: Partial<NodeStatusContext> = {}): NodeStatusContext {
  return {
    workflow: CAMPAIGN_CREATE_WORKFLOW,
    formData: { 'select-type': { type: 'FIRST_ORDER' } },
    validations: {},
    ...overrides,
  };
}

describe('orchestration state machine', () => {
  it('returns error before completed or reachable states', () => {
    const context = ctx({ validations: { 'select-type': { completed: true }, 'basic-info': { errors: ['name'] } } });
    const node = CAMPAIGN_CREATE_WORKFLOW.nodes.find((item) => item.id === 'basic-info')!;
    expect(deriveNodeStatus(node, context)).toBe('error');
    expect(nextRecommended(context)?.id).toBe('basic-info');
  });

  it('activates POLICY branch and idles handler branches', () => {
    const context = ctx();
    const policy = CAMPAIGN_CREATE_WORKFLOW.nodes.find((item) => item.id === 'policy-config')!;
    const heavy = CAMPAIGN_CREATE_WORKFLOW.nodes.find((item) => item.id === 'handler-heavy-rules')!;
    expect(isNodeInActiveBranch(policy, context)).toBe(true);
    expect(isNodeInActiveBranch(heavy, context)).toBe(false);
    expect(deriveNodeStatus(heavy, context)).toBe('idle');
  });

  it('recommends in-progress node after predecessor completes', () => {
    const context = ctx({ validations: { 'select-type': { completed: true } } });
    expect(nextRecommended(context)?.id).toBe('basic-info');
  });

  it('recommends publish when all non-exit nodes are completed', () => {
    const validations = Object.fromEntries(
      CAMPAIGN_CREATE_WORKFLOW.nodes
        .filter((node) => node.id !== CAMPAIGN_CREATE_WORKFLOW.exitNode)
        .map((node) => [node.id, { completed: true }]),
    );
    expect(nextRecommended(ctx({ validations }))?.id).toBe('publish');
  });

  it('returns null once exit node is completed', () => {
    const validations = Object.fromEntries(
      CAMPAIGN_CREATE_WORKFLOW.nodes.map((node) => [node.id, { completed: true }]),
    );
    expect(nextRecommended(ctx({ validations }))).toBeNull();
  });
});
