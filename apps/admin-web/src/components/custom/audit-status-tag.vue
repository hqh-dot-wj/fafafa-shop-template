<script setup lang="ts">
/**
 * 统一审核状态标签组件
 *
 * 用于全站所有审核/审批场景的状态展示。
 * 确保提现审核、会员升级、分销申请、营销活动审批等模块的状态展示一致。
 */
import { computed } from 'vue';
import { NTag } from 'naive-ui';

defineOptions({
  name: 'AuditStatusTag',
});

const props = defineProps<{
  status: string;
}>();

const statusMap: Record<string, { label: string; type: NaiveUI.ThemeColor }> = {
  PENDING: { label: '待审核', type: 'warning' },
  PROCESSING: { label: '处理中', type: 'info' },
  REVIEWING: { label: '审核中', type: 'info' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'error' },
  CANCELLED: { label: '已撤回', type: 'default' },
  // 兼容提现打款失败等
  FAILED: { label: '打款失败', type: 'error' },
  // 兼容旧的营销活动状态
  DRAFT: { label: '草稿', type: 'default' },
};

const config = computed(() => statusMap[props.status] ?? { label: props.status, type: 'default' as const });
</script>

<template>
  <NTag :type="config.type" size="small">{{ config.label }}</NTag>
</template>
