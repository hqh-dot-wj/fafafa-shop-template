import type {
  NodeStatus,
  NodeStatusContext,
  OrchestrationEdge,
  OrchestrationNode,
  OrchestrationWorkflow,
} from '@/views/marketing/_orchestration/types';

export function isNodeInActiveBranch(node: OrchestrationNode, ctx: NodeStatusContext): boolean {
  if (!node.branchGroup) return true;
  const rule = ctx.workflow.branchRules.find((item) =>
    ctx.workflow.nodes.some((candidate) => candidate.id === item.decidedBy),
  );
  if (!rule) return true;
  const decidingValue = ctx.formData[rule.decidedBy]?.[rule.field];
  return rule.routes[String(decidingValue ?? '')] === node.branchGroup;
}

export function isReachable(node: OrchestrationNode, ctx: NodeStatusContext): boolean {
  if (node.id === ctx.workflow.entryNode) return true;
  const incoming = ctx.workflow.edges.filter((edge) => edge.to === node.id);
  return incoming.some((edge) => ctx.validations[edge.from]?.completed === true);
}

export function deriveNodeStatus(node: OrchestrationNode, ctx: NodeStatusContext): NodeStatus {
  if (!isNodeInActiveBranch(node, ctx)) return 'idle';
  const validation = ctx.validations[node.id];
  if (validation?.errors?.length) return 'error';
  if (validation?.completed) return 'completed';
  if (isReachable(node, ctx)) return 'in_progress';
  return 'idle';
}

export function nextRecommended(ctx: NodeStatusContext): OrchestrationNode | null {
  const activeNodes = ctx.workflow.nodes.filter((node) => isNodeInActiveBranch(node, ctx));
  const errored = activeNodes.find((node) => deriveNodeStatus(node, ctx) === 'error');
  if (errored) return errored;
  const inProgress = activeNodes.find((node) => deriveNodeStatus(node, ctx) === 'in_progress');
  if (inProgress) return inProgress;
  const exit = ctx.workflow.nodes.find((node) => node.id === ctx.workflow.exitNode) ?? null;
  if (!exit) return null;
  if (ctx.validations[exit.id]?.completed) return null;
  return exit;
}

export function edgeIsHighlighted(edge: OrchestrationEdge, workflow: OrchestrationWorkflow, ctx: NodeStatusContext) {
  const from = workflow.nodes.find((node) => node.id === edge.from);
  return Boolean(from && edge.highlightOnComplete && deriveNodeStatus(from, ctx) === 'completed');
}
