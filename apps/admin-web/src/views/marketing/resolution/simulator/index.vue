<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NForm,
  NFormItemGi,
  NGrid,
  NGridItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
  NTag,
} from 'naive-ui';
import {
  type ResolutionSimulateCandidate,
  type ResolutionSimulateFilteredItem,
  type ResolutionSimulateRequest,
  type ResolutionSimulateResult,
  type ResolutionSimulateTimelineStep,
  fetchSimulateResolution,
} from '@/service/api/marketing/resolution';
import { useAppStore } from '@/store/modules/app';
import { usePickerField } from '@/hooks/business/use-picker-field';
import { localStg } from '@/utils/storage';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import TenantSelectModal from '@/components/business/tenant-select-modal.vue';
import type {
  MemberPickerSelection,
  ProductPickerSelection,
  TenantPickerSelection,
} from '@/components/business/entity-picker.shared';
import { formatObjectInlineSummary } from '../../shared/object-summary';

defineOptions({ name: 'ResolutionSimulator' });

const appStore = useAppStore();
const defaultTenantId = String(localStg.get('tenantId') ?? '000000');

const form = reactive({
  tenantId: defaultTenantId,
  productId: '',
  memberId: '',
  simulateTime: '',
  isNewcomer: false,
  memberLevel: '',
  executionMode: 'PREVIEW' as ResolutionSimulateRequest['executionMode'],
  scenarioCode: 'RUN_CENTER_BASIC',
  sampleEventIds: ['entry_scan', 'share_click', 'pay_success'],
  delayCompression: {
    enabled: false,
    ratio: 0.5,
    maxGapMs: 3000,
  },
  probeEnabled: false,
});

const running = ref(false);
const result = ref<ResolutionSimulateResult | null>(null);
const tenantPickerVisible = ref(false);
const memberPickerVisible = ref(false);
const productPickerVisible = ref(false);

const executionModeOptions: SelectOption[] = [
  { label: '预览 PREVIEW', value: 'PREVIEW' },
  { label: '回放 REPLAY', value: 'REPLAY' },
  { label: '提交 COMMIT', value: 'COMMIT' },
];

const scenarioOptions: SelectOption[] = [{ label: 'RUN_CENTER_BASIC', value: 'RUN_CENTER_BASIC' }];
const sampleEventOptions: SelectOption[] = [
  { label: '入口扫码', value: 'entry_scan' },
  { label: '分享点击', value: 'share_click' },
  { label: '支付成功', value: 'pay_success' },
];

const {
  displayValue: memberDisplayValue,
  applySelection: applyMemberSelection,
  clearSelection: clearMemberSelection,
} = usePickerField({
  model: form,
  key: 'memberId',
  emptyValue: '',
});
const {
  displayValue: tenantDisplayValue,
  applySelection: applyTenantSelection,
  clearSelection: clearTenantSelection,
  setDisplayValue: setTenantDisplayValue,
} = usePickerField({
  model: form,
  key: 'tenantId',
  emptyValue: '',
  initialDisplayValue: defaultTenantId,
});
const {
  displayValue: productDisplayValue,
  applySelection: applyProductSelection,
  clearSelection: clearProductSelection,
} = usePickerField({
  model: form,
  key: 'productId',
  emptyValue: '',
});

const selectedMember = computed(() =>
  memberDisplayValue.value ? { memberId: form.memberId, displayName: memberDisplayValue.value } : null,
);
const selectedTenant = computed(() =>
  tenantDisplayValue.value ? { tenantId: form.tenantId, displayName: tenantDisplayValue.value } : null,
);
const selectedProduct = computed(() =>
  productDisplayValue.value ? { productId: form.productId, displayName: productDisplayValue.value } : null,
);

const selectedActivity = computed(() => result.value?.selectedActivity ?? result.value?.selected ?? null);
const timelineRows = computed(() => result.value?.timeline ?? []);
const candidateRows = computed(() => result.value?.candidates ?? []);
const eligibleRows = computed(() => result.value?.eligible ?? []);
const filteredRows = computed(() => result.value?.filtered ?? []);
const probeSteps = computed<Api.Marketing.SimulateProbeStep[]>(() => result.value?.probe?.steps ?? []);
const sideEffectsState = computed(() => result.value?.sideEffects ?? { executed: false, emittedCount: 0 });

const candidateColumns = computed<DataTableColumns<ResolutionSimulateCandidate>>(() => [
  {
    key: 'id',
    title: '配置 ID',
    ellipsis: { tooltip: true },
    render: (row) => row.id ?? row.configId ?? '—',
  },
  { key: 'type', title: '类型', width: 140, ellipsis: { tooltip: true } },
  {
    key: 'status',
    title: '状态',
    width: 120,
    render: (row) => renderSimpleTag(row.status),
  },
  { key: 'displayPriority', title: '展示优先级', width: 120 },
]);

const eligibleColumns = computed<DataTableColumns<{ id?: string; type: string }>>(() => [
  {
    key: 'id',
    title: '配置 ID',
    ellipsis: { tooltip: true },
    render: (row) => row.id ?? '—',
  },
  { key: 'type', title: '类型', width: 140, ellipsis: { tooltip: true } },
]);

const filteredColumns = computed<DataTableColumns<ResolutionSimulateFilteredItem>>(() => [
  { key: 'configId', title: '配置 ID', ellipsis: { tooltip: true } },
  { key: 'type', title: '类型', width: 140, ellipsis: { tooltip: true } },
  { key: 'reason', title: '原因', ellipsis: { tooltip: true } },
]);

const timelineColumns = computed<DataTableColumns<ResolutionSimulateTimelineStep>>(() => [
  { key: 'eventId', title: '事件 ID', width: 120, ellipsis: { tooltip: true } },
  { key: 'code', title: '事件码', width: 140, ellipsis: { tooltip: true } },
  { key: 'name', title: '事件名称', width: 140, ellipsis: { tooltip: true } },
  { key: 'eventType', title: '事件类型', width: 180, ellipsis: { tooltip: true } },
  { key: 'gapMs', title: '间隔(ms)', width: 100 },
  { key: 'offsetMs', title: '偏移(ms)', width: 100 },
  {
    key: 'payload',
    title: '事件摘要',
    ellipsis: { tooltip: true },
    render: (row) => formatPayload(row.payload),
  },
]);

const resultSummary = computed(() => [
  { label: '执行模式', value: result.value?.executionMode ?? form.executionMode },
  { label: '场景编码', value: result.value?.scenarioCode ?? form.scenarioCode },
  { label: '副作用执行', value: sideEffectsState.value.executed ? '是' : '否' },
  { label: '事件发射数', value: sideEffectsState.value.emittedCount },
  { label: '探针开关', value: form.probeEnabled ? '开启' : '关闭' },
]);

const selectedActivitySummary = computed(() => {
  if (!selectedActivity.value) {
    return [];
  }
  return [
    { label: '活动类型', value: selectedActivity.value.activityType },
    { label: '配置 ID', value: selectedActivity.value.configId },
    { label: '上下文 Key', value: selectedActivity.value.activityContextKey },
    { label: '佣金模式', value: selectedActivity.value.commissionMode },
  ];
});

function renderSimpleTag(value: string) {
  const labelMap: Record<string, { label: string; type: 'default' | 'info' | 'success' | 'warning' | 'error' }> = {
    ON_SHELF: { label: '上架', type: 'success' },
    OFF_SHELF: { label: '下架', type: 'warning' },
    OPEN: { label: '待处理', type: 'warning' },
    ACK: { label: '已确认', type: 'info' },
    RESOLVED: { label: '已解决', type: 'success' },
    IGNORED: { label: '已忽略', type: 'default' },
    METRIC_ALERT: { label: '指标告警', type: 'error' },
    PROBE_STEP_MISSING: { label: '探针缺失', type: 'warning' },
    LOW: { label: '低', type: 'default' },
    MEDIUM: { label: '中', type: 'info' },
    HIGH: { label: '高', type: 'warning' },
    CRITICAL: { label: '严重', type: 'error' },
  };
  const meta = labelMap[value] ?? { label: value, type: 'default' };
  return h(
    NTag,
    {
      type: meta.type,
      size: 'small',
      bordered: false,
    },
    {
      default: () => meta.label,
    },
  );
}

function formatPayload(payload: Record<string, unknown>) {
  return formatObjectInlineSummary(payload, { emptyText: '—' });
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function openTenantPicker() {
  tenantPickerVisible.value = true;
}

function openProductPicker() {
  productPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  applyMemberSelection({
    value: member.memberId,
    label: member.displayName || member.nickname || member.mobile || member.memberId,
  });
}

function handleTenantSelect(tenant: TenantPickerSelection) {
  applyTenantSelection({
    value: tenant.tenantId,
    label: tenant.displayName || tenant.companyName || tenant.tenantId,
  });
}

function handleProductSelect(product: ProductPickerSelection) {
  applyProductSelection({
    value: product.productId || '',
    label: product.displayName || product.name || product.productId || '',
  });
}

function handleMemberClear() {
  clearMemberSelection();
}

function handleTenantClear() {
  clearTenantSelection();
  setTenantDisplayValue('');
}

function handleProductClear() {
  clearProductSelection();
}

function buildPayload(): ResolutionSimulateRequest {
  const payload: ResolutionSimulateRequest = {
    tenantId: form.tenantId.trim() || '000000',
    productId: form.productId.trim(),
    executionMode: form.executionMode,
    scenarioCode: form.scenarioCode,
    probeEnabled: form.probeEnabled,
  };

  if (form.memberId.trim()) payload.memberId = form.memberId.trim();
  if (form.simulateTime.trim()) payload.simulateTime = form.simulateTime.trim();
  if (form.isNewcomer) payload.isNewcomer = true;
  if (form.memberLevel.trim()) payload.memberLevel = form.memberLevel.trim();
  if (form.sampleEventIds.length > 0) payload.sampleEventIds = [...form.sampleEventIds];

  payload.delayCompression = {
    enabled: form.delayCompression.enabled,
    ratio: form.delayCompression.ratio,
    maxGapMs: form.delayCompression.maxGapMs,
  };

  return payload;
}

async function runSimulate() {
  if (!form.productId.trim()) {
    window.$message?.warning('请先选择商品');
    return;
  }

  running.value = true;
  result.value = null;

  try {
    const { data } = await fetchSimulateResolution(buildPayload());
    result.value = data ?? null;
    window.$message?.success('模拟已完成');
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 页面摘要区：说明裁决模拟器的执行模式和探针能力。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">裁决模拟器</h2>
          <p class="text-13px text-gray-500">
            支持预览、回放和提交模式，默认使用 `RUN_CENTER_BASIC` 场景样例，支持压缩时间线与探针输出。
          </p>
        </div>
        <NSpace>
          <NTag type="info" size="small" :bordered="false">当前路由：resolution/simulator</NTag>
        </NSpace>
      </div>
    </NCard>

    <!-- 模拟参数区：选择租户、商品、会员、执行模式和样例事件。 -->
    <NCard title="模拟参数" :bordered="false" size="small" class="card-wrapper">
      <NForm :model="form" label-placement="left" :label-width="120">
        <NGrid responsive="screen" item-responsive>
          <NFormItemGi span="24 s:12 m:6" label="租户" class="pr-24px">
            <NInput
              v-model:value="tenantDisplayValue"
              placeholder="默认取当前登录租户，点击选择"
              clearable
              readonly
              @click="openTenantPicker"
              @clear="handleTenantClear"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="商品名称" class="pr-24px">
            <NInput
              v-model:value="productDisplayValue"
              placeholder="点击选择商品"
              clearable
              readonly
              @click="openProductPicker"
              @clear="handleProductClear"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="会员名称" class="pr-24px">
            <NInput
              v-model:value="memberDisplayValue"
              placeholder="可选，点击选择会员"
              clearable
              readonly
              @click="openMemberPicker"
              @clear="handleMemberClear"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="模拟时间" class="pr-24px">
            <NInput v-model:value="form.simulateTime" placeholder="可选，ISO 时间字符串" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="新客" class="pr-24px">
            <NSwitch v-model:value="form.isNewcomer" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="会员等级" class="pr-24px">
            <NInput v-model:value="form.memberLevel" placeholder="可选" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="执行模式" class="pr-24px">
            <NSelect v-model:value="form.executionMode" :options="executionModeOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="场景编码" class="pr-24px">
            <NSelect v-model:value="form.scenarioCode" :options="scenarioOptions" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:12" label="样例事件" class="pr-24px">
            <NSelect v-model:value="form.sampleEventIds" :options="sampleEventOptions" multiple />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:4" label="压缩开关" class="pr-24px">
            <NSwitch v-model:value="form.delayCompression.enabled" />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:4" label="压缩比例" class="pr-24px">
            <NInputNumber
              v-model:value="form.delayCompression.ratio"
              :min="0"
              :max="1"
              :step="0.1"
              :disabled="!form.delayCompression.enabled"
              class="w-full"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:4" label="最大间隔(ms)" class="pr-24px">
            <NInputNumber
              v-model:value="form.delayCompression.maxGapMs"
              :min="0"
              :step="100"
              :disabled="!form.delayCompression.enabled"
              class="w-full"
            />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:6" label="探针输出" class="pr-24px">
            <NSwitch v-model:value="form.probeEnabled" />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton type="primary" :loading="running" @click="runSimulate">
                <template #icon>
                  <icon-ic-round-play-arrow class="text-icon" />
                </template>
                运行模拟
              </NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </NCard>

    <!-- 模拟结果区：仅在接口返回结果后展示运行摘要和明细。 -->
    <template v-if="result">
      <!-- 运行摘要区：展示执行模式、副作用、探针开关和选中活动。 -->
      <NCard title="运行摘要" :bordered="false" size="small" class="card-wrapper">
        <NDescriptions label-placement="left" bordered size="small" :column="2">
          <NDescriptionsItem v-for="item in resultSummary" :key="item.label" :label="item.label">
            {{ item.value }}
          </NDescriptionsItem>
        </NDescriptions>
        <div class="mt-16px">
          <h3 class="mb-8px text-14px font-medium">选中活动</h3>
          <NDescriptions v-if="selectedActivitySummary.length" label-placement="left" bordered size="small" :column="2">
            <NDescriptionsItem v-for="item in selectedActivitySummary" :key="item.label" :label="item.label">
              {{ item.value }}
            </NDescriptionsItem>
          </NDescriptions>
          <div v-else class="rounded-8px bg-gray-50 px-12px py-16px text-14px text-gray-500">当前没有选中活动</div>
        </div>
      </NCard>

      <!-- 时间线区：展示模拟事件链路和压缩后的时间间隔。 -->
      <NCard title="时间线" :bordered="false" size="small" class="card-wrapper">
        <NDataTable
          :columns="timelineColumns"
          :data="timelineRows"
          :row-key="(row) => row.eventId"
          :loading="running"
          :pagination="false"
          :scroll-x="980"
          :flex-height="!appStore.isMobile"
          size="small"
          remote
        >
          <template #empty>
            <div class="py-24px text-14px text-gray-500">暂无时间线数据</div>
          </template>
        </NDataTable>
      </NCard>

      <!-- 活动裁决区：并列展示候选、有资格和被过滤活动。 -->
      <NGrid responsive="screen" item-responsive :x-gap="16" :y-gap="16">
        <NGridItem span="24 s:12 l:8">
          <NCard title="候选活动" :bordered="false" size="small" class="card-wrapper">
            <NDataTable
              :columns="candidateColumns"
              :data="candidateRows"
              :row-key="(row) => row.id || row.configId || row.type"
              :pagination="false"
              :scroll-x="520"
              size="small"
              remote
            >
              <template #empty>
                <div class="py-24px text-14px text-gray-500">暂无候选活动</div>
              </template>
            </NDataTable>
          </NCard>
        </NGridItem>

        <NGridItem span="24 s:12 l:8">
          <NCard title="有资格活动" :bordered="false" size="small" class="card-wrapper">
            <NDataTable
              :columns="eligibleColumns"
              :data="eligibleRows"
              :row-key="(row) => row.id || row.type"
              :pagination="false"
              :scroll-x="360"
              size="small"
              remote
            >
              <template #empty>
                <div class="py-24px text-14px text-gray-500">暂无有资格活动</div>
              </template>
            </NDataTable>
          </NCard>
        </NGridItem>

        <NGridItem span="24 s:12 l:8">
          <NCard title="过滤记录" :bordered="false" size="small" class="card-wrapper">
            <NDataTable
              :columns="filteredColumns"
              :data="filteredRows"
              :row-key="(row) => row.configId"
              :pagination="false"
              :scroll-x="520"
              size="small"
              remote
            >
              <template #empty>
                <div class="py-24px text-14px text-gray-500">暂无过滤记录</div>
              </template>
            </NDataTable>
          </NCard>
        </NGridItem>
      </NGrid>

      <!-- 探针步骤区：展示模拟接口返回的 probe step 摘要。 -->
      <NCard title="探针步骤" :bordered="false" size="small" class="card-wrapper">
        <NSpace v-if="probeSteps.length" wrap :size="8">
          <NTag
            v-for="step in probeSteps"
            :key="`${step.code}-${step.eventType}-${step.offsetMs}`"
            type="info"
            size="small"
          >
            {{ step.code }} / {{ step.eventType }} / {{ step.offsetMs }}ms
          </NTag>
        </NSpace>
        <div v-else class="rounded-8px bg-gray-50 px-12px py-16px text-14px text-gray-500">
          未开启探针输出或未返回步骤
        </div>
      </NCard>
    </template>

    <!-- 业务选择器区：回填模拟所需的会员、租户和商品标识。 -->
    <MemberSelectModal v-model:visible="memberPickerVisible" :selected="selectedMember" @select="handleMemberSelect" />
    <TenantSelectModal v-model:visible="tenantPickerVisible" :selected="selectedTenant" @select="handleTenantSelect" />
    <ProductSelectModal
      v-model:visible="productPickerVisible"
      :selected="selectedProduct"
      @select="handleProductSelect"
    />
  </div>
</template>

<style scoped></style>
