<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import {
  NAlert,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NForm,
  NFormItemGi,
  NGrid,
  NInput,
  NInputNumber,
  NSpace,
  NTag,
} from 'naive-ui';
import { type ResolutionTraceDiagnostic, fetchResolutionTraceDiagnostic } from '@/service/api/marketing/resolution';

defineOptions({ name: 'ResolutionTraceDiagnosticPanel' });

// Trace 诊断面板对应 ResolutionDiagnosticController，只聚合最近采样、长期审计、事件目录和关联工单。
// 这里不能触发缓存失效或重新裁决，否则排障页面会改变线上出数状态。
type SceneResolveSample = ResolutionTraceDiagnostic['sceneResolve'][number];
type CacheInvalidationSample = ResolutionTraceDiagnostic['cacheInvalidation'][number];
type PersistentTraceSample = ResolutionTraceDiagnostic['persistentTrace'][number];
type RelatedEvent = ResolutionTraceDiagnostic['relatedEvents'][number];
type RelatedIncident = ResolutionTraceDiagnostic['relatedIncidents'][number];
type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';

interface ExplainSnapshotSummary {
  sceneCode: string;
  releaseNo: string;
  status: string;
  failureReason: string;
  moduleCount: string;
  candidateCount: string;
  filteredCount: string;
  selectedCount: string;
}

interface ExplainModuleRow {
  moduleCode: string;
  moduleName: string;
  status: string;
  sourcePolicyCode: string;
  resolverPolicyCode: string;
  audiencePolicyCode: string;
  sortPolicyCode: string;
  failureReason: string;
  candidateCount: number;
  filteredCount: number;
  selectedCount: number;
  visibleProductIds: string;
  selectedProducts: string;
}

type TagMeta = {
  label: string;
  type: TagType;
};

interface SummaryItem {
  label: string;
  value: string;
  tagType?: TagType;
}

const props = withDefaults(
  defineProps<{
    selectedTraceId?: string;
    selectedVersion?: number;
  }>(),
  {
    selectedTraceId: '',
    selectedVersion: 0,
  },
);

const loading = ref(false);
const traceId = ref('');
const days = ref<number | null>(7);
const diagnostic = ref<ResolutionTraceDiagnostic | null>(null);
const queriedTraceId = ref('');

const statusMeta: Record<string, TagMeta> = {
  SUCCESS: { label: '成功', type: 'success' },
  FAILED: { label: '失败', type: 'error' },
};

const eventStatusMeta: Record<string, TagMeta> = {
  ACTIVE: { label: '启用', type: 'success' },
  DRAFT: { label: '草稿', type: 'warning' },
  DEPRECATED: { label: '废弃', type: 'default' },
};

const incidentStatusMeta: Record<string, TagMeta> = {
  OPEN: { label: '待处理', type: 'warning' },
  ACK: { label: '已确认', type: 'info' },
  RESOLVED: { label: '已解决', type: 'success' },
  IGNORED: { label: '已忽略', type: 'default' },
};

const incidentLevelMeta: Record<string, TagMeta> = {
  LOW: { label: '低', type: 'default' },
  MEDIUM: { label: '中', type: 'info' },
  HIGH: { label: '高', type: 'warning' },
  CRITICAL: { label: '严重', type: 'error' },
};

const incidentTypeMeta: Record<string, TagMeta> = {
  METRIC_ALERT: { label: '指标告警', type: 'error' },
  PROBE_STEP_MISSING: { label: '探针缺失', type: 'warning' },
  TEAM_PROJECTION_DRIFT: { label: '拼课投影漂移', type: 'warning' },
  TEAM_EFFECT_APPLY_FAILED: { label: '拼课效果失败', type: 'error' },
  TEAM_COURSE_ARTIFACT_MISSING: { label: '课程产物缺失', type: 'error' },
  TEAM_FINANCE_EVIDENCE_MISSING: { label: '财务凭证缺失', type: 'error' },
  TEAM_MANUAL_REVIEW_REQUIRED: { label: '人工复核', type: 'info' },
};

const summaryItems = computed<SummaryItem[]>(() => {
  if (!diagnostic.value) {
    return [];
  }

  return [
    {
      label: '命中状态',
      value: diagnostic.value.found ? '已命中' : '未命中',
      tagType: diagnostic.value.found ? 'success' : 'warning',
    },
    { label: 'Trace ID', value: diagnostic.value.traceId },
    { label: '租户', value: diagnostic.value.tenantId },
    { label: '回看日期', value: diagnostic.value.dates.join('、') || '-' },
    { label: '裁决样本', value: String(diagnostic.value.sceneResolve.length) },
    { label: '缓存失效', value: String(diagnostic.value.cacheInvalidation.length) },
    { label: '长期审计', value: String(diagnostic.value.persistentTrace.length) },
    { label: '关联事件', value: String(diagnostic.value.relatedEvents.length) },
    { label: '关联工单', value: String(diagnostic.value.relatedIncidents.length) },
  ];
});

const latestExplainSnapshot = computed(() => {
  // Explain 快照优先取场景裁决样本，缺失时回退长期审计，用于解释一次出数为何命中或过滤。
  const sceneSnapshot = diagnostic.value?.sceneResolve.map(readExplainSnapshot).find(Boolean);
  if (sceneSnapshot) {
    return sceneSnapshot;
  }
  return diagnostic.value?.persistentTrace.map(readExplainSnapshot).find(Boolean) ?? null;
});

const latestExplainSnapshotSummary = computed<ExplainSnapshotSummary | null>(() => {
  const snapshot = latestExplainSnapshot.value;
  if (!snapshot) {
    return null;
  }

  const modules = readRecordArray(snapshot.modules);
  return {
    sceneCode: formatLooseValue(snapshot.sceneCode),
    releaseNo: formatLooseValue(snapshot.releaseNo),
    status: formatLooseValue(snapshot.status),
    failureReason: formatLooseValue(snapshot.failureReason),
    moduleCount: String(modules.length),
    candidateCount: String(sumModuleArrayLength(modules, 'candidateSnapshot')),
    filteredCount: String(sumModuleArrayLength(modules, 'filterReasonSnapshot')),
    selectedCount: String(sumModuleArrayLength(modules, 'selectedSnapshot')),
  };
});

const latestExplainModuleRows = computed<ExplainModuleRow[]>(() => {
  const snapshot = latestExplainSnapshot.value;
  if (!snapshot) {
    return [];
  }

  return readRecordArray(snapshot.modules).map((module) => {
    const selectedSnapshot = readRecordArray(module.selectedSnapshot);
    return {
      moduleCode: formatLooseValue(module.moduleCode),
      moduleName: formatLooseValue(module.moduleName),
      status: formatLooseValue(module.status),
      sourcePolicyCode: formatLooseValue(module.sourcePolicyCode),
      resolverPolicyCode: formatLooseValue(module.resolverPolicyCode),
      audiencePolicyCode: formatLooseValue(module.audiencePolicyCode),
      sortPolicyCode: formatLooseValue(module.sortPolicyCode),
      failureReason: formatLooseValue(module.failureReason),
      candidateCount: readRecordArray(module.candidateSnapshot).length,
      filteredCount: readRecordArray(module.filterReasonSnapshot).length,
      selectedCount: selectedSnapshot.length,
      visibleProductIds: formatStringList(module.visibleProductIds),
      selectedProducts: formatSelectedProducts(selectedSnapshot),
    };
  });
});

const sceneResolveColumns: DataTableColumns<SceneResolveSample> = [
  { key: 'date', title: '日期', width: 110 },
  { key: 'sceneCode', title: '场景', minWidth: 150, ellipsis: { tooltip: true } },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => renderTag(row.status, statusMeta),
  },
  { key: 'releaseNo', title: '发布号', width: 90, render: (row) => row.releaseNo ?? '-' },
  { key: 'channel', title: '渠道', width: 120, ellipsis: { tooltip: true } },
  { key: 'moduleCount', title: '模块数', width: 90 },
  { key: 'emptyModuleCount', title: '空模块', width: 90 },
  { key: 'hitCount', title: '命中', width: 80 },
  { key: 'durationMs', title: '耗时', width: 100, render: (row) => formatDuration(row.durationMs) },
  { key: 'recordedAt', title: '记录时间', minWidth: 170, ellipsis: { tooltip: true } },
];

const cacheInvalidationColumns: DataTableColumns<CacheInvalidationSample> = [
  { key: 'date', title: '日期', width: 110 },
  { key: 'eventType', title: '事件', minWidth: 220, ellipsis: { tooltip: true } },
  {
    key: 'sceneCode',
    title: '场景',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => row.sceneCode ?? '-',
  },
  { key: 'deletedKeys', title: '删除 Key', width: 100 },
  { key: 'hitCount', title: '命中', width: 80 },
  { key: 'durationMs', title: '耗时', width: 100, render: (row) => formatDuration(row.durationMs) },
  { key: 'recordedAt', title: '记录时间', minWidth: 170, ellipsis: { tooltip: true } },
];

const persistentTraceColumns: DataTableColumns<PersistentTraceSample> = [
  { key: 'date', title: '日期', width: 110 },
  { key: 'traceKind', title: '类型', width: 130, render: (row) => formatTraceKind(row.traceKind) },
  {
    key: 'sceneCode',
    title: '场景',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => row.sceneCode ?? '-',
  },
  {
    key: 'eventType',
    title: '事件',
    minWidth: 220,
    ellipsis: { tooltip: true },
    render: (row) => row.eventType ?? '-',
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => renderTag(row.status, statusMeta),
  },
  { key: 'releaseNo', title: '发布号', width: 90, render: (row) => row.releaseNo ?? '-' },
  { key: 'channel', title: '渠道', width: 100, render: (row) => row.channel ?? '-' },
  { key: 'moduleCount', title: '模块数', width: 90, render: (row) => row.moduleCount ?? '-' },
  { key: 'deletedKeys', title: '删除 Key', width: 100, render: (row) => row.deletedKeys ?? '-' },
  { key: 'durationMs', title: '耗时', width: 100, render: (row) => formatDuration(row.durationMs) },
  { key: 'recordedAt', title: '记录时间', minWidth: 170, ellipsis: { tooltip: true } },
];

const eventColumns: DataTableColumns<RelatedEvent> = [
  { key: 'eventType', title: '事件编码', minWidth: 220, ellipsis: { tooltip: true } },
  { key: 'displayName', title: '事件名称', minWidth: 160, ellipsis: { tooltip: true } },
  { key: 'category', title: '分类', width: 110 },
  { key: 'usableScopes', title: '可用范围', minWidth: 180, render: (row) => row.usableScopes.join('、') || '-' },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => renderTag(row.status, eventStatusMeta),
  },
];

const incidentColumns: DataTableColumns<RelatedIncident> = [
  { key: 'title', title: '工单标题', minWidth: 220, ellipsis: { tooltip: true } },
  {
    key: 'type',
    title: '类型',
    width: 140,
    render: (row) => renderTag(row.type, incidentTypeMeta),
  },
  {
    key: 'level',
    title: '等级',
    width: 100,
    render: (row) => renderTag(row.level, incidentLevelMeta),
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    render: (row) => renderTag(row.status, incidentStatusMeta),
  },
  { key: 'code', title: '编码', minWidth: 150, ellipsis: { tooltip: true }, render: (row) => row.code ?? '-' },
  { key: 'occurredAt', title: '发生时间', minWidth: 170, ellipsis: { tooltip: true } },
];

const explainModuleColumns: DataTableColumns<ExplainModuleRow> = [
  { key: 'moduleCode', title: '模块编码', minWidth: 140, ellipsis: { tooltip: true } },
  { key: 'moduleName', title: '模块名称', minWidth: 150, ellipsis: { tooltip: true } },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => renderTag(row.status, statusMeta),
  },
  { key: 'candidateCount', title: '候选', width: 80 },
  { key: 'filteredCount', title: '过滤', width: 80 },
  { key: 'selectedCount', title: '选中', width: 80 },
  { key: 'sourcePolicyCode', title: '来源策略', minWidth: 140, ellipsis: { tooltip: true } },
  { key: 'resolverPolicyCode', title: '解析策略', minWidth: 140, ellipsis: { tooltip: true } },
  { key: 'audiencePolicyCode', title: '人群策略', minWidth: 140, ellipsis: { tooltip: true } },
  { key: 'sortPolicyCode', title: '排序策略', minWidth: 140, ellipsis: { tooltip: true } },
  { key: 'selectedProducts', title: '选中商品', minWidth: 220, ellipsis: { tooltip: true } },
  { key: 'visibleProductIds', title: '可见商品', minWidth: 220, ellipsis: { tooltip: true } },
  { key: 'failureReason', title: '失败原因', minWidth: 180, ellipsis: { tooltip: true } },
];

watch(
  () => [props.selectedTraceId, props.selectedVersion] as const,
  ([nextTraceId]) => {
    const normalizedTraceId = nextTraceId.trim();
    if (!normalizedTraceId) {
      return;
    }
    traceId.value = normalizedTraceId;
    queryDiagnostic();
  },
);

function renderTag(value: string | undefined, meta: Record<string, TagMeta>) {
  const current = value ? meta[value] : undefined;

  return h(
    NTag,
    { type: current?.type ?? 'default', size: 'small', bordered: false },
    { default: () => current?.label ?? value ?? '-' },
  );
}

function normalizeDays() {
  const current = days.value ?? 7;
  const normalized = Math.min(7, Math.max(1, Math.trunc(current)));
  days.value = normalized;
  return normalized;
}

function formatDuration(value: number) {
  return `${value}ms`;
}

function formatTraceKind(value: string) {
  if (value === 'SCENE_RESOLVE') return '场景裁决';
  if (value === 'CACHE_INVALIDATION') return '缓存失效';
  return value;
}

function readExplainSnapshot(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }
  const snapshot = (item as { explainSnapshot?: unknown }).explainSnapshot;
  return snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)
    ? (snapshot as Record<string, unknown>)
    : null;
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item),
  );
}

function formatLooseValue(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '-';
}

function formatStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return '-';
  }
  const values = value.map(formatLooseValue).filter((item) => item !== '-');
  return values.join('、') || '-';
}

function formatSelectedProducts(products: Record<string, unknown>[]) {
  const summaries = products.map((product) => {
    const productName = formatLooseValue(product.productName);
    const productId = formatLooseValue(product.productId);
    if (productName !== '-' && productId !== '-') {
      return `${productName}(${productId})`;
    }
    return productName !== '-' ? productName : productId;
  });

  return summaries.filter((item) => item !== '-').join('、') || '-';
}

function sumModuleArrayLength(modules: Record<string, unknown>[], field: string) {
  return modules.reduce((sum, module) => sum + readRecordArray(module[field]).length, 0);
}

async function queryDiagnostic() {
  const normalizedTraceId = traceId.value.trim();
  if (!normalizedTraceId) {
    window.$message?.warning('请输入 Trace ID');
    return;
  }

  loading.value = true;
  try {
    // 回看窗口限制在 1-7 天，跟后端采样保留窗口保持一致，避免运营误以为历史永久可查。
    diagnostic.value = await fetchResolutionTraceDiagnostic({
      traceId: normalizedTraceId,
      days: normalizeDays(),
    });
    queriedTraceId.value = normalizedTraceId;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NCard title="Trace 诊断" :bordered="false" size="small" class="card-wrapper">
    <NCollapse :default-expanded-names="['trace-diagnostic']">
      <NCollapseItem title="场景出数 Trace 聚合" name="trace-diagnostic">
        <!-- Trace 诊断只读读取采样事实，不触发重新裁决，避免排障操作改变线上运行态。 -->
        <NForm label-placement="left" :label-width="100">
          <NGrid responsive="screen" item-responsive>
            <NFormItemGi span="24 s:14 m:12" label="Trace ID" class="pr-24px">
              <NInput v-model:value="traceId" clearable placeholder="请输入 Trace ID" @keyup.enter="queryDiagnostic" />
            </NFormItemGi>
            <NFormItemGi span="12 s:5 m:4" label="回看天数" class="pr-24px">
              <NInputNumber v-model:value="days" :min="1" :max="7" :precision="0" class="w-full" />
            </NFormItemGi>
            <NFormItemGi span="12 s:5 m:4">
              <NSpace class="w-full" justify="end">
                <NButton type="primary" ghost :loading="loading" @click="queryDiagnostic">
                  <template #icon>
                    <icon-ic-round-search class="text-icon" />
                  </template>
                  查询
                </NButton>
              </NSpace>
            </NFormItemGi>
          </NGrid>
        </NForm>

        <div v-if="diagnostic" class="mt-12px flex-col gap-12px">
          <NAlert v-if="!diagnostic.found" type="warning" title="未命中采样" :bordered="false">
            当前 Trace 在所选时间窗内没有场景裁决或缓存失效样本，请检查 Trace、租户或采样保留窗口。
          </NAlert>

          <NDescriptions label-placement="left" bordered size="small" :column="4">
            <NDescriptionsItem v-for="item in summaryItems" :key="item.label" :label="item.label">
              <NTag v-if="item.tagType" :type="item.tagType" size="small" :bordered="false">
                {{ item.value }}
              </NTag>
              <template v-else>{{ item.value }}</template>
            </NDescriptionsItem>
          </NDescriptions>

          <NDivider title-placement="left">场景裁决样本</NDivider>
          <NDataTable
            :columns="sceneResolveColumns"
            :data="diagnostic.sceneResolve"
            :loading="loading"
            :pagination="false"
            :scroll-x="1200"
            size="small"
          />

          <NDivider title-placement="left">缓存失效样本</NDivider>
          <NDataTable
            :columns="cacheInvalidationColumns"
            :data="diagnostic.cacheInvalidation"
            :loading="loading"
            :pagination="false"
            :scroll-x="1100"
            size="small"
          />

          <NDivider title-placement="left">长期审计样本</NDivider>
          <NDataTable
            :columns="persistentTraceColumns"
            :data="diagnostic.persistentTrace"
            :loading="loading"
            :pagination="false"
            :scroll-x="1500"
            size="small"
          />

          <template v-if="latestExplainSnapshotSummary">
            <NDivider title-placement="left">Explain 快照</NDivider>
            <NDescriptions label-placement="left" bordered size="small" :column="4">
              <NDescriptionsItem label="场景">{{ latestExplainSnapshotSummary.sceneCode }}</NDescriptionsItem>
              <NDescriptionsItem label="发布号">{{ latestExplainSnapshotSummary.releaseNo }}</NDescriptionsItem>
              <NDescriptionsItem label="状态">
                <NTag
                  size="small"
                  :type="statusMeta[latestExplainSnapshotSummary.status]?.type ?? 'default'"
                  :bordered="false"
                >
                  {{ statusMeta[latestExplainSnapshotSummary.status]?.label ?? latestExplainSnapshotSummary.status }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem label="失败原因">{{ latestExplainSnapshotSummary.failureReason }}</NDescriptionsItem>
              <NDescriptionsItem label="模块数">{{ latestExplainSnapshotSummary.moduleCount }}</NDescriptionsItem>
              <NDescriptionsItem label="候选数">{{ latestExplainSnapshotSummary.candidateCount }}</NDescriptionsItem>
              <NDescriptionsItem label="过滤数">{{ latestExplainSnapshotSummary.filteredCount }}</NDescriptionsItem>
              <NDescriptionsItem label="选中数">{{ latestExplainSnapshotSummary.selectedCount }}</NDescriptionsItem>
            </NDescriptions>
            <NDataTable
              class="mt-12px"
              :columns="explainModuleColumns"
              :data="latestExplainModuleRows"
              :loading="loading"
              :pagination="false"
              :scroll-x="2000"
              size="small"
            />
          </template>

          <NDivider title-placement="left">关联事件目录</NDivider>
          <NDataTable
            :columns="eventColumns"
            :data="diagnostic.relatedEvents"
            :loading="loading"
            :pagination="false"
            :scroll-x="900"
            size="small"
          />

          <NDivider title-placement="left">关联排障工单</NDivider>
          <NDataTable
            :columns="incidentColumns"
            :data="diagnostic.relatedIncidents"
            :loading="loading"
            :pagination="false"
            :scroll-x="900"
            size="small"
          />
        </div>

        <div v-else-if="queriedTraceId" class="mt-12px">
          <NAlert type="default" :bordered="false">Trace {{ queriedTraceId }} 暂无诊断数据。</NAlert>
        </div>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

<style scoped></style>
