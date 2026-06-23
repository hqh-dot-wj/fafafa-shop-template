<script setup lang="ts">
import { computed } from 'vue';
import { NCard, NDescriptions, NDescriptionsItem, NEmpty, NSpace, NTag } from 'naive-ui';

defineOptions({ name: 'ActivityUpgradeTriggerPanel' });

const props = defineProps<{
  activityVersionId?: string | null;
  upgradeRule?: Record<string, unknown> | null;
}>();

const UPGRADE_RULE_LABEL_MAP: Record<string, string> = {
  triggerEvent: '触发事件',
  triggerEvents: '触发事件',
  sourceEvents: '触发来源',
  applyType: '申请类型',
  autoApprove: '自动审批',
  targetLevel: '目标等级',
  targetLevels: '目标等级',
  minOrderAmount: '升级门槛金额',
  orderAmountThreshold: '升级门槛金额',
  requireReferralCode: '是否要求推荐码',
  requireFirstOrder: '是否首单触发',
};

// 规则明细只展示后端返回的升级触发配置，不在前端推导会员是否可升级。
const upgradeRuleEntries = computed(() => {
  if (!props.upgradeRule) return [];

  return Object.entries(props.upgradeRule)
    .map(([key, value]) => ({ key, label: UPGRADE_RULE_LABEL_MAP[key] ?? key, value: formatValue(value) }))
    .filter((item) => item.value !== '-')
    .slice(0, 10);
});

const triggerEventText = computed(() => {
  if (!props.upgradeRule) return '-';
  const triggerEvents =
    props.upgradeRule.triggerEvents ?? props.upgradeRule.sourceEvents ?? props.upgradeRule.triggerEvent;
  return formatValue(triggerEvents);
});

const targetLevelText = computed(() => {
  if (!props.upgradeRule) return '-';
  return formatValue(props.upgradeRule.targetLevels ?? props.upgradeRule.targetLevel);
});

const approvalText = computed(() => {
  if (!props.upgradeRule) return '-';
  const autoApprove = props.upgradeRule.autoApprove;
  if (typeof autoApprove === 'boolean') {
    return autoApprove ? '自动审批' : '人工审批';
  }
  return formatValue(props.upgradeRule.approvalMode ?? autoApprove);
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
      .map(([key, itemValue]) => `${UPGRADE_RULE_LABEL_MAP[key] ?? key}: ${formatValue(itemValue)}`)
      .filter((item) => !item.endsWith(': -'));
    return entries.length > 0 ? entries.join('；') : '-';
  }
  return '-';
}
</script>

<template>
  <!-- 升级触发区：展示分销成长活动的触发事件、目标等级和审批模式。 -->
  <NCard title="升级触发" :bordered="false" size="small">
    <!-- 触发摘要区：突出运营最关心的版本、事件、等级和审批方式。 -->
    <NDescriptions label-placement="left" :column="1" size="small">
      <NDescriptionsItem label="活动版本">{{ activityVersionId || '-' }}</NDescriptionsItem>
      <NDescriptionsItem label="触发事件">{{ triggerEventText }}</NDescriptionsItem>
      <NDescriptionsItem label="目标等级">{{ targetLevelText }}</NDescriptionsItem>
      <NDescriptionsItem label="审批模式">{{ approvalText }}</NDescriptionsItem>
    </NDescriptions>

    <!-- 规则明细区：按标签展示后端扩展字段，空值不展示。 -->
    <div class="mt-10px">
      <div class="text-13px font-medium">触发规则明细</div>
      <NEmpty v-if="upgradeRuleEntries.length === 0" class="mt-8px" size="small" description="暂无升级触发规则" />
      <NSpace v-else class="mt-8px" :wrap="true" size="small">
        <NTag v-for="item in upgradeRuleEntries" :key="item.key" size="small">{{ item.label }}：{{ item.value }}</NTag>
      </NSpace>
    </div>
  </NCard>
</template>
