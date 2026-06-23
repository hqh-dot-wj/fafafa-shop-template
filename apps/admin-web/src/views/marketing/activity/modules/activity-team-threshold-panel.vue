<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'ActivityTeamThresholdPanel' });

const props = defineProps<{
  activityVersionId?: string | null;
  teamThresholdRule?: Record<string, unknown> | null;
}>();

const TEAM_RULE_LABEL_MAP: Record<string, string> = {
  minTeamSize: '团队总人数门槛',
  teamSizeThreshold: '团队总人数门槛',
  minDirectCount: '直推人数门槛',
  directCountThreshold: '直推人数门槛',
  minIndirectCount: '间推人数门槛',
  indirectCountThreshold: '间推人数门槛',
  minTeamSales: '团队销售额门槛',
  salesThreshold: '团队销售额门槛',
  targetLevel: '达标目标等级',
  nextLevel: '达标后下一等级',
  estimatedCommissionRate: '预估佣金比例',
};

const minTeamSizeText = computed(() => {
  if (!props.teamThresholdRule) return '-';
  return formatValue(props.teamThresholdRule.minTeamSize ?? props.teamThresholdRule.teamSizeThreshold);
});

const minDirectText = computed(() => {
  if (!props.teamThresholdRule) return '-';
  return formatValue(props.teamThresholdRule.minDirectCount ?? props.teamThresholdRule.directCountThreshold);
});

const minSalesText = computed(() => {
  if (!props.teamThresholdRule) return '-';
  return formatAmount(props.teamThresholdRule.minTeamSales ?? props.teamThresholdRule.salesThreshold);
});

const nextLevelText = computed(() => {
  if (!props.teamThresholdRule) return '-';
  return formatValue(props.teamThresholdRule.nextLevel ?? props.teamThresholdRule.targetLevel);
});

// 团队阈值明细只格式化后端配置，不在前端判断团长是否达标。
const teamRuleEntries = computed(() => {
  if (!props.teamThresholdRule) return [];

  return Object.entries(props.teamThresholdRule)
    .map(([key, value]) => ({
      key,
      label: TEAM_RULE_LABEL_MAP[key] ?? key,
      value: key.toLowerCase().includes('sales') ? formatAmount(value) : formatValue(value),
    }))
    .filter((item) => item.value !== '-')
    .slice(0, 10);
});

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return `${value}`;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : '-';
  }
  if (Array.isArray(value)) {
    const values = value.map((item) => formatValue(item)).filter((item) => item !== '-');
    return values.length > 0 ? values.join('、') : '-';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, itemValue]) => `${TEAM_RULE_LABEL_MAP[key] ?? key}: ${formatValue(itemValue)}`)
      .filter((item) => !item.endsWith(': -'));
    return entries.length > 0 ? entries.join('；') : '-';
  }
  return '-';
}

function formatAmount(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return `¥${parsed.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }
  return '-';
}
</script>

<template>
  <!-- 团队阈值区：展示团队规模、直推人数、销售额和达标等级规则。 -->
  <NCard title="团队阈值" :bordered="false" size="small">
    <!-- 阈值摘要区：展示达标判断涉及的核心门槛。 -->
    <NDescriptions label-placement="left" :column="1" size="small">
      <NDescriptionsItem label="活动版本">{{ activityVersionId || '-' }}</NDescriptionsItem>
      <NDescriptionsItem label="团队规模门槛">{{ minTeamSizeText }}</NDescriptionsItem>
      <NDescriptionsItem label="直推门槛">{{ minDirectText }}</NDescriptionsItem>
      <NDescriptionsItem label="团队销售门槛">{{ minSalesText }}</NDescriptionsItem>
      <NDescriptionsItem label="达标后等级">{{ nextLevelText }}</NDescriptionsItem>
    </NDescriptions>

    <!-- 规则明细区：展示扩展阈值字段，便于排查后端规则配置。 -->
    <div class="mt-10px">
      <div class="text-13px font-medium">阈值规则明细</div>
      <NEmpty v-if="teamRuleEntries.length === 0" class="mt-8px" size="small" description="暂无团队阈值规则" />
      <NSpace v-else class="mt-8px" :wrap="true" size="small">
        <NTag v-for="item in teamRuleEntries" :key="item.key" size="small">{{ item.label }}：{{ item.value }}</NTag>
      </NSpace>
    </div>
  </NCard>
</template>
