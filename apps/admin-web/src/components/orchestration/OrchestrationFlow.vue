<script setup lang="ts">
import { computed } from 'vue';
import { VueFlow } from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import type { NodeStatusContext, OrchestrationWorkflow } from '@/views/marketing/_orchestration/types';
import WorkflowNode from './WorkflowNode.vue';
import { layoutDagre } from './layout-dagre';

defineOptions({ name: 'OrchestrationFlow' });

const props = defineProps<{
  workflow: OrchestrationWorkflow;
  ctx: NodeStatusContext;
}>();

const emit = defineEmits<{
  (e: 'nodeClick', nodeId: string): void;
}>();

const nodeTypes = { workflow: WorkflowNode };
const graph = computed(() => layoutDagre(props.workflow, props.ctx));
</script>

<template>
  <div
    class="orchestration-flow h-320px min-h-260px w-full overflow-hidden border border-gray-200 rounded-8px bg-white"
  >
    <VueFlow
      :nodes="graph.nodes"
      :edges="graph.edges"
      :node-types="nodeTypes"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :edges-updatable="false"
      :pan-on-drag="true"
      :pan-on-scroll="false"
      :zoom-on-scroll="true"
      :zoom-on-double-click="false"
      :min-zoom="0.5"
      :max-zoom="1.5"
      fit-view-on-init
      @node-click="(event) => emit('nodeClick', event.node.id)"
    />
  </div>
</template>

<style scoped>
.orchestration-flow :deep(.vue-flow__pane) {
  cursor: grab;
}
.orchestration-flow :deep(.vue-flow__pane.dragging) {
  cursor: grabbing;
}
</style>
