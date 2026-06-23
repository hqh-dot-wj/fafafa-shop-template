import dagre from 'dagre';
import type { Edge, Node } from '@vue-flow/core';
import type {
  NodeStatusContext,
  OrchestrationEdge,
  OrchestrationNode,
  OrchestrationWorkflow,
} from '@/views/marketing/_orchestration/types';
import { deriveNodeStatus, edgeIsHighlighted, isNodeInActiveBranch, nextRecommended } from './state-machine';

export function layoutDagre(workflow: OrchestrationWorkflow, ctx: NodeStatusContext): { nodes: Node[]; edges: Edge[] } {
  const activeNodes = workflow.nodes.filter((node) => isNodeInActiveBranch(node, ctx));
  const activeIds = new Set(activeNodes.map((node) => node.id));
  const activeEdges = workflow.edges.filter((edge) => activeIds.has(edge.from) && activeIds.has(edge.to));
  const stepIndexMap = computeStepIndex(activeNodes, activeEdges);

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: 'LR', nodesep: 56, ranksep: 112 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of activeNodes) {
    graph.setNode(node.id, { width: 200, height: 80 });
  }
  for (const edge of activeEdges) {
    graph.setEdge(edge.from, edge.to);
  }
  dagre.layout(graph);

  const recommendedId = nextRecommended(ctx)?.id;
  const nodes: Node[] = activeNodes.map((node) => {
    const position = graph.node(node.id);
    return {
      id: node.id,
      type: 'workflow',
      position: { x: position.x, y: position.y },
      data: {
        label: node.label,
        hint: node.hint,
        status: deriveNodeStatus(node, ctx),
        recommended: node.id === recommendedId,
        stepIndex: stepIndexMap[node.id],
      },
    };
  });

  const edges: Edge[] = activeEdges.map((edge) => {
    const highlighted = edgeIsHighlighted(edge, workflow, ctx);
    return {
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      animated: highlighted,
      style: { stroke: highlighted ? '#18a058' : '#d9d9d9', strokeWidth: highlighted ? 2 : 1 },
    };
  });

  return { nodes, edges };
}

function computeStepIndex(nodes: OrchestrationNode[], edges: OrchestrationEdge[]): Record<string, number> {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    if (incoming.has(edge.from) && incoming.has(edge.to)) {
      incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
      outgoing.get(edge.from)!.push(edge.to);
    }
  }
  const depth: Record<string, number> = {};
  const queue: string[] = [];
  for (const [id, count] of incoming) {
    if (count === 0) {
      depth[id] = 1;
      queue.push(id);
    }
  }
  while (queue.length) {
    const id = queue.shift()!;
    const current = depth[id] ?? 1;
    for (const next of outgoing.get(id) ?? []) {
      depth[next] = Math.max(depth[next] ?? 0, current + 1);
      incoming.set(next, (incoming.get(next) ?? 0) - 1);
      if (incoming.get(next) === 0) queue.push(next);
    }
  }
  return depth;
}
