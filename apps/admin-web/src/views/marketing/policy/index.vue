<script setup lang="tsx">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { type LocationQueryRaw, useRoute, useRouter } from 'vue-router';
import { NButton, NTag } from 'naive-ui';
import {
  fetchPolicyList,
  fetchSaveAudiencePolicy,
  fetchSaveCardTemplate,
  fetchSaveResolverPolicy,
  fetchSaveSortPolicy,
  fetchSaveSourcePolicy,
} from '@/service/api/marketing/policy';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import ResolutionPriority from '../resolution/priority/index.vue';
import ResolutionSimulator from '../resolution/simulator/index.vue';
import {
  buildObjectFromEditableText,
  buildObjectSummary,
  formatObjectEditorText,
  toPlainRecord,
} from '../shared/object-summary';
import EventCatalogPanel from './modules/event-catalog-panel.vue';
import PolicySearch from './modules/policy-search.vue';

defineOptions({ name: 'MarketingPolicy' });

// 策略中心对应 PolicyController，并内嵌裁决优先级、模拟器和事件目录。
// 前端只维护策略配置形态，真实裁决、冲突处理和场景出数解释由后端 resolution 链路完成。
const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
type PolicyTab = 'list' | 'priority' | 'simulator' | 'eventCatalog';

const activeTab = ref<PolicyTab>('list');
const editVisible = ref(false);
const submitting = ref(false);
const detailVisible = ref(false);
const advancedConfigMode = ref(false);
const detailRow = ref<Api.Marketing.MarketingPolicy | null>(null);
const detailUpdateTime = computed(() => (detailRow.value as { updateTime?: string } | null)?.updateTime ?? '-');
const editingType = ref<string>('');
const editingConfigBase = ref<Record<string, unknown>>({});
const editForm = reactive({
  policyCode: '',
  policyName: '',
  status: 'ACTIVE',
  configText: '',
});

const configLabelMap: Record<string, string> = {
  clauses: '条款',
  primaryOfferTypes: '主优惠类型',
  conflictMatrix: '冲突矩阵',
  rules: '受众规则',
  sortRules: '排序规则',
  templateConfig: '卡片模板',
};

const detailConfigSummary = computed(() =>
  buildObjectSummary(detailRow.value?.config ?? {}, { labelMap: configLabelMap }),
);

const { data, loading, getData, getDataByPage, columns, searchParams, resetSearchParams, mobilePagination, scrollX } =
  useTable({
    apiFn: fetchPolicyList,
    apiParams: { pageNum: 1, pageSize: 20, policyType: null, status: null },
    columns: () => [
      {
        key: 'policyCode',
        title: '策略编码',
        align: 'center',
        minWidth: 160,
        render: (row) => (
          <NTag type="info" bordered={false} class="font-mono">
            {row.policyCode}
          </NTag>
        ),
      },
      { key: 'policyName', title: '策略名称', align: 'center', minWidth: 180 },
      { key: 'policyType', title: '策略类型', align: 'center', minWidth: 130 },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        width: 100,
        render: (row) => (
          <NTag type={row.status === 'ACTIVE' ? 'success' : 'default'} size="small">
            {row.status === 'ACTIVE' ? '启用' : '停用'}
          </NTag>
        ),
      },
      {
        key: 'operate',
        title: $t('common.operate'),
        align: 'center',
        width: 150,
        render: (row) => (
          <div class="flex-center gap-8px">
            <ButtonIcon
              type="default"
              class="text-primary"
              tooltipContent="详情"
              icon="material-symbols:info-outline"
              onClick={() => openDetail(row)}
            />
            <ButtonIcon
              type="primary"
              class="text-primary"
              tooltipContent={$t('common.edit')}
              icon="material-symbols:edit-square-outline"
              onClick={() => openEdit(row)}
            />
          </div>
        ),
      },
    ],
  });

const POLICY_TABS = new Set<PolicyTab>(['list', 'priority', 'simulator', 'eventCatalog']);

function resolvePolicyTab(value: unknown): PolicyTab {
  if (typeof value !== 'string') {
    return 'list';
  }
  const tab = value.trim();
  return POLICY_TABS.has(tab as PolicyTab) ? (tab as PolicyTab) : 'list';
}

function syncQueryTab(tab: PolicyTab) {
  const nextQuery: LocationQueryRaw = { ...route.query };
  if (tab === 'list') {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = tab;
  }
  router.replace({ query: nextQuery }).catch(() => {});
}

onMounted(() => {
  activeTab.value = resolvePolicyTab(route.query.tab);
});

watch(
  () => route.query.tab,
  (value) => {
    const nextTab = resolvePolicyTab(value);
    if (activeTab.value !== nextTab) {
      activeTab.value = nextTab;
    }
  },
);

watch(activeTab, (tab) => {
  if (resolvePolicyTab(route.query.tab) !== tab) {
    syncQueryTab(tab);
  }
});

function openCreate() {
  advancedConfigMode.value = false;
  editingType.value = 'SOURCE';
  editingConfigBase.value = { clauses: [] };
  Object.assign(editForm, {
    policyCode: '',
    policyName: '',
    status: 'ACTIVE',
    configText: formatObjectEditorText(editingConfigBase.value, { labelMap: configLabelMap }),
  });
  editVisible.value = true;
}

function openEdit(row: Api.Marketing.MarketingPolicy) {
  advancedConfigMode.value = false;
  editingType.value = row.policyType ?? 'SOURCE';
  editingConfigBase.value = toPlainRecord(row.config);
  Object.assign(editForm, {
    policyCode: row.policyCode,
    policyName: row.policyName,
    status: row.status ?? 'ACTIVE',
    configText: formatObjectEditorText(editingConfigBase.value, { labelMap: configLabelMap }),
  });
  editVisible.value = true;
}

function openDetail(row: Api.Marketing.MarketingPolicy) {
  detailRow.value = row;
  detailVisible.value = true;
}

function getConfigKeySummary(): string {
  const items = buildObjectSummary(buildObjectFromEditableText(editingConfigBase.value, editForm.configText), {
    labelMap: configLabelMap,
    maxItems: 8,
  });
  return items.length > 0 ? items.map((item) => item.label).join('、') : '无';
}

function parseConfigObject(): Record<string, unknown> {
  // 高级配置编辑器以原配置为基底解析增量文本，避免折叠状态下丢失未知策略字段。
  return buildObjectFromEditableText(editingConfigBase.value, editForm.configText);
}

async function handleSavePolicy() {
  if (!editForm.policyCode || !editForm.policyName) {
    window.$message?.warning('请填写策略编码和策略名称');
    return;
  }
  const config = parseConfigObject();
  submitting.value = true;
  try {
    // 不同策略类型对应不同保存接口，提交前拆成后端明确 DTO，避免把 SOURCE 字段写进 RESOLVER。
    if (editingType.value === 'SOURCE') {
      await fetchSaveSourcePolicy({
        policyCode: editForm.policyCode,
        policyName: editForm.policyName,
        status: editForm.status,
        clauses: Array.isArray(config.clauses) ? (config.clauses as Record<string, unknown>[]) : [],
      });
    } else if (editingType.value === 'RESOLVER') {
      await fetchSaveResolverPolicy({
        policyCode: editForm.policyCode,
        policyName: editForm.policyName,
        status: editForm.status,
        primaryOfferTypes: Array.isArray(config.primaryOfferTypes) ? (config.primaryOfferTypes as string[]) : [],
        conflictMatrix:
          config.conflictMatrix && typeof config.conflictMatrix === 'object'
            ? (config.conflictMatrix as Record<string, unknown>)
            : {},
      });
    } else if (editingType.value === 'AUDIENCE') {
      await fetchSaveAudiencePolicy({
        policyCode: editForm.policyCode,
        policyName: editForm.policyName,
        status: editForm.status,
        rules: config.rules && typeof config.rules === 'object' ? (config.rules as Record<string, unknown>) : {},
      });
    } else if (editingType.value === 'SORT') {
      await fetchSaveSortPolicy({
        policyCode: editForm.policyCode,
        policyName: editForm.policyName,
        status: editForm.status,
        sortRules: Array.isArray(config.sortRules) ? (config.sortRules as Record<string, unknown>[]) : [],
      });
    } else {
      await fetchSaveCardTemplate({
        policyCode: editForm.policyCode,
        policyName: editForm.policyName,
        status: editForm.status,
        templateConfig:
          config.templateConfig && typeof config.templateConfig === 'object'
            ? (config.templateConfig as Record<string, unknown>)
            : {},
      });
    }
    window.$message?.success('策略已保存');
    editVisible.value = false;
    getData();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 策略搜索区：仅在策略列表 tab 展示，筛选条件不影响内嵌裁决页。 -->
    <PolicySearch
      v-show="activeTab === 'list'"
      v-model:model="searchParams"
      @reset="resetSearchParams"
      @search="getDataByPage"
    />
    <!-- 策略工作区：承载策略列表、裁决优先级、模拟器和事件目录。 -->
    <NCard title="策略中心" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton v-if="activeTab === 'list'" type="primary" ghost size="small" @click="openCreate">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增策略
        </NButton>
      </template>
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="list" tab="策略列表">
          <div class="min-h-0 min-h-420px flex flex-col sm:h-full">
            <NDataTable
              :columns="columns"
              :data="data"
              :loading="loading"
              :pagination="mobilePagination"
              remote
              :row-key="(row) => row.id"
              :flex-height="!appStore.isMobile"
              :scroll-x="scrollX"
              class="min-h-0 flex-1 sm:h-full"
            >
              <template #empty>
                <div class="py-24px text-14px text-gray-500">{{ $t('datatable.empty') }}</div>
              </template>
            </NDataTable>
          </div>
        </NTabPane>
        <NTabPane name="priority" tab="裁决优先级">
          <ResolutionPriority :show-migrated-notice="false" />
        </NTabPane>
        <NTabPane name="simulator" tab="裁决模拟器">
          <ResolutionSimulator :show-migrated-notice="false" />
        </NTabPane>
        <NTabPane name="eventCatalog" tab="事件目录">
          <EventCatalogPanel />
        </NTabPane>
      </NTabs>
    </NCard>

    <!-- 策略编辑弹窗：按策略类型拆分 DTO，避免跨类型字段混写。 -->
    <NModal v-model:show="editVisible" preset="card" title="编辑策略" class="w-720px">
      <NForm :model="editForm" label-placement="left" :label-width="120">
        <!-- 基础字段区：维护策略类型、编码、名称和启停状态。 -->
        <NFormItem label="策略类型">
          <NSelect
            v-model:value="editingType"
            :options="[
              { label: '商品池策略(SOURCE)', value: 'SOURCE' },
              { label: '裁决策略(RESOLVER)', value: 'RESOLVER' },
              { label: '受众策略(AUDIENCE)', value: 'AUDIENCE' },
              { label: '排序策略(SORT)', value: 'SORT' },
              { label: '卡片模板(CARD_TEMPLATE)', value: 'CARD_TEMPLATE' },
            ]"
          />
        </NFormItem>
        <NFormItem label="策略编码">
          <NInput v-model:value="editForm.policyCode" />
        </NFormItem>
        <NFormItem label="策略名称">
          <NInput v-model:value="editForm.policyName" />
        </NFormItem>
        <NFormItem label="状态">
          <NSelect
            v-model:value="editForm.status"
            :options="[
              { label: '启用', value: 'ACTIVE' },
              { label: '停用', value: 'INACTIVE' },
            ]"
          />
        </NFormItem>
        <NFormItem label="配置字段摘要">
          <NInput :value="getConfigKeySummary()" readonly />
        </NFormItem>
        <NFormItem label="高级模式">
          <NButton quaternary @click="advancedConfigMode = !advancedConfigMode">
            {{ advancedConfigMode ? '收起配置字段' : '展开配置字段' }}
          </NButton>
        </NFormItem>
        <!-- 高级配置区：编辑未显式建模的策略配置字段。 -->
        <NFormItem v-if="advancedConfigMode" label="配置字段">
          <NInput
            v-model:value="editForm.configText"
            type="textarea"
            placeholder="每行填写 字段 = 值，复杂配置保留原值"
            :autosize="{ minRows: 8, maxRows: 16 }"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="editVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="handleSavePolicy">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 策略详情弹窗：只读展示策略基础信息和配置摘要。 -->
    <NModal v-model:show="detailVisible" preset="card" title="策略详情（只读）" class="w-760px">
      <NDescriptions :column="2" bordered label-placement="left" size="small">
        <NDescriptionsItem label="策略编码">{{ detailRow?.policyCode || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="策略名称">{{ detailRow?.policyName || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="策略类型">{{ detailRow?.policyType || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ detailRow?.status || '-' }}</NDescriptionsItem>
        <NDescriptionsItem label="更新时间">{{ detailUpdateTime }}</NDescriptionsItem>
      </NDescriptions>
      <NCard title="配置详情" :bordered="false" size="small" class="mt-12px">
        <NDescriptions v-if="detailConfigSummary.length" :column="2" bordered label-placement="left" size="small">
          <NDescriptionsItem v-for="item in detailConfigSummary" :key="item.key" :label="item.label">
            {{ item.value }}
          </NDescriptionsItem>
        </NDescriptions>
        <NEmpty v-else description="暂无配置详情" />
      </NCard>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="detailVisible = false">关闭</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped></style>
