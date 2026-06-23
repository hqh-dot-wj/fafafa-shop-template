<script setup lang="ts">
import { NBadge, NSpin } from 'naive-ui';
import SvgIcon from '@/components/custom/svg-icon.vue';
import type { NodeStatus } from '@/views/marketing/_orchestration/types';

defineOptions({ name: 'WorkflowNode' });

defineProps<{
  data: {
    label: string;
    hint?: string;
    status: NodeStatus;
    recommended?: boolean;
    stepIndex?: number;
  };
}>();
</script>

<template>
  <div class="orchestration-node" :class="[`is-${data.status}`, data.recommended ? 'is-recommended' : '']">
    <div v-if="data.stepIndex" class="node-step-index">{{ data.stepIndex }}</div>
    <div class="node-status-icon">
      <SvgIcon v-if="data.status === 'completed'" icon="material-symbols:check-circle-outline" />
      <NSpin v-else-if="data.status === 'in_progress'" :size="14" />
      <SvgIcon v-else-if="data.status === 'error'" icon="material-symbols:error-outline-rounded" />
      <span v-else class="placeholder">○</span>
    </div>
    <div class="node-main">
      <div class="node-label">{{ data.label }}</div>
      <div v-if="data.hint" class="node-hint">{{ data.hint }}</div>
    </div>
    <NBadge v-if="data.recommended" type="info" dot processing class="recommend-badge" />
  </div>
</template>

<style scoped>
.orchestration-node {
  min-width: 180px;
  max-width: 240px;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  background: #fff;
  padding: 10px 12px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s;
}

.node-step-index {
  min-width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #f0f3f9;
  color: #4b5563;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

.is-completed .node-step-index {
  background: #18a058;
  color: #fff;
}

.is-in_progress .node-step-index {
  background: #2080f0;
  color: #fff;
}

.is-error .node-step-index {
  background: #d03050;
  color: #fff;
}

.is-completed {
  border-color: #18a058;
  background: #edf8f1;
}

.is-in_progress {
  border-color: #2080f0;
  background: #eef5ff;
}

.is-error {
  border-color: #d03050;
  background: #fff1f3;
}

.is-recommended {
  box-shadow: 0 0 0 2px rgba(32, 128, 240, 0.24);
}

.node-status-icon {
  width: 18px;
  display: flex;
  justify-content: center;
  color: #2080f0;
}

.node-main {
  min-width: 0;
  flex: 1;
}

.node-label {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
}

.node-hint {
  margin-top: 2px;
  color: #6b7280;
  font-size: 12px;
}
</style>
