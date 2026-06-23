<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NCard, NGi, NGrid, NSpace, NStatistic, NTag } from 'naive-ui';
import { Money, type MoneyInput } from '@/utils/money';

defineOptions({ name: 'ActivityCommissionBudgetPanel' });

interface BudgetBreakdownItem {
  key: string;
  value: Money;
}

const props = defineProps<{
  budgetTotal?: number | null;
  budgetFrozen?: number | null;
  budgetConsumed?: number | null;
  budgetReleased?: number | null;
  budgetByLevel?: Record<string, number>;
  budgetByChannel?: Record<string, number>;
  budgetByActivityVersion?: Record<string, number>;
  budgetAlertThreshold?: number | null;
  budgetFuseThreshold?: number | null;
}>();

const budgetTotalValue = computed(() => new Money(props.budgetTotal));
const budgetFrozenValue = computed(() => new Money(props.budgetFrozen));
const budgetConsumedValue = computed(() => new Money(props.budgetConsumed));
const budgetReleasedValue = computed(() => new Money(props.budgetReleased));

// 预算占用率只基于后端快照金额计算，用于提示风险，不在前端冻结或释放佣金。
const consumedRate = computed(() => {
  if (budgetTotalValue.value.lte(0)) return null;
  return budgetConsumedValue.value.div(budgetTotalValue.value).mul(100).toNumber();
});

const budgetAlert = computed(() => toFiniteNumber(props.budgetAlertThreshold));
const budgetFuse = computed(() => toFiniteNumber(props.budgetFuseThreshold));

// 预算状态只解释预警/熔断阈值，真实预算拦截由后端预算服务执行。
const budgetStatus = computed(() => {
  if (budgetTotalValue.value.lte(0) || consumedRate.value === null) {
    return { type: 'warning' as const, text: '未配置可用预算总额，无法计算预算占用率' };
  }

  if (budgetFuse.value > 0 && consumedRate.value >= budgetFuse.value) {
    return { type: 'error' as const, text: `预算占用率 ${consumedRate.value}% ，已达到熔断阈值 ${budgetFuse.value}%` };
  }

  if (budgetAlert.value > 0 && consumedRate.value >= budgetAlert.value) {
    return {
      type: 'warning' as const,
      text: `预算占用率 ${consumedRate.value}% ，已达到预警阈值 ${budgetAlert.value}%`,
    };
  }

  return { type: 'success' as const, text: `预算占用率 ${consumedRate.value}% ，当前在安全区间` };
});

const levelItems = computed(() => toBreakdownItems(props.budgetByLevel));
const channelItems = computed(() => toBreakdownItems(props.budgetByChannel));
const versionItems = computed(() => toBreakdownItems(props.budgetByActivityVersion));

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBreakdownItems(input?: Record<string, number>): BudgetBreakdownItem[] {
  if (!input || typeof input !== 'object') return [];

  return Object.entries(input)
    .map(([key, raw]) => ({ key, value: new Money(raw) }))
    .filter((item) => item.value.isPositive());
}

function formatCurrency(value: MoneyInput | Money) {
  const amount = value instanceof Money ? value : new Money(value);
  return `¥${amount.toNumber().toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
</script>

<template>
  <!-- 佣金预算区：展示预算总额、占用状态和多维拆分。 -->
  <NCard title="佣金预算" :bordered="false" size="small">
    <!-- 预算摘要区：展示总额、冻结、消耗和释放金额。 -->
    <NGrid cols="1 s:2" responsive="screen" :x-gap="12" :y-gap="12">
      <NGi>
        <NStatistic label="预算总额" :value="formatCurrency(budgetTotalValue)" />
      </NGi>
      <NGi>
        <NStatistic label="已冻结" :value="formatCurrency(budgetFrozenValue)" />
      </NGi>
      <NGi>
        <NStatistic label="已消耗" :value="formatCurrency(budgetConsumedValue)" />
      </NGi>
      <NGi>
        <NStatistic label="已释放" :value="formatCurrency(budgetReleasedValue)" />
      </NGi>
    </NGrid>

    <!-- 预算风险区：按预警和熔断阈值解释当前占用率。 -->
    <NAlert class="mt-12px" :type="budgetStatus.type">{{ budgetStatus.text }}</NAlert>

    <!-- 预算拆分区：按等级、渠道和活动版本展示预算来源。 -->
    <div class="mt-12px flex-col-stretch gap-10px">
      <div>
        <div class="text-13px font-medium">按等级拆分</div>
        <div v-if="levelItems.length === 0" class="mt-4px text-12px text-gray-500">暂无数据</div>
        <NSpace v-else class="mt-6px" :wrap="true" size="small">
          <NTag v-for="item in levelItems" :key="`level-${item.key}`" size="small"
            >{{ item.key }}：{{ formatCurrency(item.value) }}</NTag
          >
        </NSpace>
      </div>

      <div>
        <div class="text-13px font-medium">按渠道拆分</div>
        <div v-if="channelItems.length === 0" class="mt-4px text-12px text-gray-500">暂无数据</div>
        <NSpace v-else class="mt-6px" :wrap="true" size="small">
          <NTag v-for="item in channelItems" :key="`channel-${item.key}`" size="small"
            >{{ item.key }}：{{ formatCurrency(item.value) }}</NTag
          >
        </NSpace>
      </div>

      <div>
        <div class="text-13px font-medium">按活动版本拆分</div>
        <div v-if="versionItems.length === 0" class="mt-4px text-12px text-gray-500">暂无数据</div>
        <NSpace v-else class="mt-6px" :wrap="true" size="small">
          <NTag v-for="item in versionItems" :key="`version-${item.key}`" size="small"
            >{{ item.key }}：{{ formatCurrency(item.value) }}</NTag
          >
        </NSpace>
      </div>
    </div>
  </NCard>
</template>
