<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue';
import { NCard, NDataTable, NTag } from 'naive-ui';
import { fetchBusinessDashboard } from '@/service/api/marketing/business-dashboard';
import DashboardAlertPanel from './modules/dashboard-alert-panel.vue';
import DashboardSummaryCard from './modules/dashboard-summary-card.vue';

defineOptions({
  name: 'MarketingClientRuntimeLedger',
});

// 运行态台账对应 BusinessDashboardController 的只读看板。
// platformValue、tenantValue、effectiveValue 只解释当前配置命中，修改必须回到 sys_config 或租户配置入口。
type LedgerRow = Api.Marketing.RuntimeLedgerEntry;

const loading = ref(false);
const dashboard = ref<Api.Marketing.BusinessDashboard | null>(null);
const rows = computed<LedgerRow[]>(() => dashboard.value?.sections.runtimeLedger ?? []);

const columns = computed<NaiveUI.TableColumn<LedgerRow>[]>(() => [
  { key: 'configKey', title: '配置键', minWidth: 220, ellipsis: { tooltip: true } },
  { key: 'displayName', title: '名称', width: 180 },
  {
    key: 'platformValue',
    title: '平台默认值',
    width: 140,
    render: (row: LedgerRow) =>
      row.platformValue === '' || row.platformValue === null || row.platformValue === undefined
        ? '—'
        : row.platformValue,
  },
  {
    key: 'tenantValue',
    title: '租户覆盖值',
    width: 140,
    render: (row: LedgerRow) =>
      row.tenantValue === '' || row.tenantValue === null || row.tenantValue === undefined ? '—' : row.tenantValue,
  },
  {
    key: 'effectiveValue',
    title: '当前生效值',
    width: 120,
    render: (row: LedgerRow) => h(NTag, { type: 'info' }, { default: () => row.effectiveValue }),
  },
  { key: 'remark', title: '说明', minWidth: 260, ellipsis: { tooltip: true } },
]);

async function load() {
  loading.value = true;
  try {
    // dashboard 一次返回运行台账、resolution 告警和概览，避免多个只读卡片各自打后端。
    const res = await fetchBusinessDashboard();
    dashboard.value = res.data ?? null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
});
</script>

<template>
  <!-- 多卡片纵向叠放：根容器 overflow-y-auto，避免 GlobalContent 下 flex 占位 + overflow-hidden 裁切且无滚动条 -->
  <div class="min-h-500px flex-col-stretch gap-16px overflow-y-auto">
    <DashboardSummaryCard :dashboard="dashboard" :loading="loading" />
    <DashboardAlertPanel :dashboard="dashboard" :loading="loading" />
    <NCard title="营销运行态台账" :bordered="false" size="small" class="card-wrapper">
      <template #header-extra>
        <span class="text-xs text-gray-500">
          只读；用于排查场景投放、聚合页与运行态开关命中。变更请在系统参数或租户级
          <code>sys_config</code>
          中维护
        </span>
      </template>
      <NDataTable :columns="columns" :data="rows" :loading="loading" :scroll-x="1100" />
    </NCard>
  </div>
</template>
