<script setup lang="tsx">
import { computed, onMounted, reactive, ref } from 'vue';
import type { PaginationProps, SelectOption } from 'naive-ui';
import { NButton, NCard, NTag } from 'naive-ui';
import type {
  CompileEntitlementPayload,
  EntitlementCompileData,
  EntitlementPoolCompileResult,
  EntitlementPoolListData,
  EntitlementPoolListParams,
  EntitlementPoolType,
  EntitlementTouchpoint,
  UpdateEntitlementPoolPayload,
} from '@/service/api/marketing';
import {
  fetchCompileEntitlementPool,
  fetchCreateEntitlementPool,
  fetchDeleteEntitlementPool,
  fetchEntitlementPoolList,
  fetchGetEntitlementDefinition,
  fetchUpdateEntitlementPool,
} from '@/service/api/marketing';
import { useAppStore } from '@/store/modules/app';
import ProductSelectModal from '@/components/business/product-select-modal.vue';
import CouponTemplateSelectModal from '@/components/business/coupon-template-select-modal.vue';
import PointsTaskSelectModal from '@/components/business/points-task-select-modal.vue';
import type {
  CouponTemplatePickerSelection,
  PointsTaskPickerSelection,
  ProductPickerSelection,
} from '@/components/business/entity-picker.shared';
import EntitlementPoolOperateDrawer from './modules/entitlement-pool-operate-drawer.vue';
import EntitlementPoolSearch from './modules/entitlement-pool-search.vue';
import EntitlementPoolTableCard from './modules/entitlement-pool-table-card.vue';
import ProductPoolPreviewDrawer from './modules/product-pool-preview-drawer.vue';
import {
  type EntitlementCompileApplyResult,
  type EntitlementPoolDraft,
  type EntitlementPoolListQuery,
  type EntitlementPoolRecord,
  type EntitlementPoolStatus,
  createDefaultDraft,
} from './modules/entitlement-pool.types';

defineOptions({ name: 'MarketingEntitlementPoolPage' });

// 权益池工作台对应 EntitlementController，连接商品池、券池、积分池与编译协议。
// 前端维护编排草稿和编译结果展示，运行 owner、风险摘要和权益发放资格由后端编译返回。
const appStore = useAppStore();

const definitionLoading = ref(false);
const definitionVersion = ref('-');
const disallowedScopes = ref<string[]>(['notification', 'share']);

const tableLoading = ref(false);
const saving = ref(false);
const compilingIds = reactive<Record<string, boolean>>({});

const rows = ref<EntitlementPoolRecord[]>([]);

const searchModel = reactive<EntitlementPoolListQuery>({
  keyword: '',
  poolType: null,
  status: null,
});

const poolTypeOptions: SelectOption[] = [
  { label: '商品池', value: 'PRODUCT' },
  { label: '券池', value: 'COUPON' },
  { label: '积分池', value: 'POINTS' },
];

const statusOptions: SelectOption[] = [
  { label: '草稿', value: 'DRAFT' },
  { label: '编译成功', value: 'COMPILED' },
  { label: '编译失败', value: 'FAILED' },
];

const drawerVisible = ref(false);
const drawerMode = ref<'create' | 'edit'>('create');
const drawerModel = ref<EntitlementPoolDraft | null>(null);
const editingId = ref<string | null>(null);

const productPickerVisible = ref(false);
const couponTemplatePickerVisible = ref(false);
const pointsTaskPickerVisible = ref(false);

const productPreviewVisible = ref(false);
const productPreviewRows = ref<Record<string, unknown>[]>([]);
const productPreviewTotal = ref(0);

const pagination = reactive<PaginationProps>({
  page: 1,
  pageSize: 10,
  showSizePicker: true,
  pageSizes: [10, 20, 30],
  itemCount: 0,
  onUpdatePage(page: number) {
    pagination.page = page;
    runAsyncTask(fetchRows);
  },
  onUpdatePageSize(pageSize: number) {
    pagination.pageSize = pageSize;
    pagination.page = 1;
    runAsyncTask(fetchRows);
  },
});

const pagedRows = computed(() => {
  const currentPage = Number(pagination.page || 1);
  const pageSize = Number(pagination.pageSize || 10);
  const start = (currentPage - 1) * pageSize;
  return rows.value.map((item, index) => ({
    ...item,
    index: start + index + 1,
  }));
});

const tableColumns = computed<NaiveUI.TableColumn<NaiveUI.TableDataWithIndex<EntitlementPoolRecord>>[]>(() => [
  {
    key: 'name',
    title: '权益池',
    minWidth: 220,
    render: (row) => (
      <div class="flex-col gap-4px">
        <span class="font-medium">{row.name}</span>
        <span class="text-xs text-gray-500 font-mono">{row.id}</span>
      </div>
    ),
  },
  {
    key: 'poolType',
    title: '类型',
    width: 100,
    render: (row) => renderPoolTypeTag(row.poolType),
  },
  {
    key: 'status',
    title: '状态',
    width: 110,
    render: (row) => renderStatusTag(row.status),
  },
  {
    key: 'owner',
    title: 'Owner',
    minWidth: 220,
    render: (row) => <span class="text-xs text-gray-600">{row.owner || '-'}</span>,
  },
  {
    key: 'touchpoints',
    title: '触点',
    minWidth: 180,
    render: (row) => (
      <div class="flex flex-wrap gap-4px">
        {row.touchpoints.map((item) => (
          <NTag key={item} size="small">
            {item}
          </NTag>
        ))}
      </div>
    ),
  },
  {
    key: 'summary',
    title: '池参数',
    minWidth: 240,
    render: (row) => renderPoolSummary(row),
  },
  {
    key: 'updatedAt',
    title: '更新时间',
    width: 170,
    render: (row) => formatDateTime(row.updatedAt),
  },
  {
    key: 'operate',
    title: '操作',
    width: 380,
    fixed: 'right',
    render: (row) => (
      <div class="flex-center flex-wrap gap-6px">
        <NButton size="small" onClick={() => openEdit(row)}>
          编辑
        </NButton>
        <NButton size="small" type="info" ghost onClick={() => copyRow(row)}>
          复制
        </NButton>
        <NButton
          size="small"
          type="primary"
          loading={Boolean(compilingIds[row.id])}
          onClick={() => {
            runAsyncTask(() => compileRow(row));
          }}
        >
          编译
        </NButton>
        <NButton
          size="small"
          ghost
          disabled={!hasProductPreview(row)}
          onClick={() => {
            runAsyncTask(() => openPreview(row));
          }}
        >
          预览
        </NButton>
        <NButton
          size="small"
          type="error"
          ghost
          onClick={() => {
            runAsyncTask(() => removeRow(row.id));
          }}
        >
          删除
        </NButton>
      </div>
    ),
  },
]);

const scrollX = computed(() =>
  tableColumns.value.reduce((sum, column) => {
    return sum + Number(column.width ?? column.minWidth ?? 120);
  }, 0),
);

const selectedCouponTemplate = computed<Partial<CouponTemplatePickerSelection> | null>(() => {
  if (!drawerModel.value?.templateId) return null;
  return {
    templateId: drawerModel.value.templateId,
    name: drawerModel.value.templateName || drawerModel.value.templateId,
  };
});

const selectedPointsTask = computed<Partial<PointsTaskPickerSelection> | null>(() => {
  if (!drawerModel.value?.taskId) return null;
  return {
    taskId: drawerModel.value.taskId,
    taskName: drawerModel.value.taskName || drawerModel.value.taskId,
  };
});

const selectedProduct = computed<Partial<ProductPickerSelection> | null>(() => {
  if (!drawerModel.value?.sourceKey) return null;
  return {
    productId: drawerModel.value.sourceKey,
    displayName: drawerModel.value.sourceKey,
    id: drawerModel.value.sourceKey,
    name: drawerModel.value.sourceKey,
  };
});

onMounted(() => {
  runAsyncTask(async () => {
    await Promise.all([loadDefinition(), fetchRows()]);
  });
});

async function loadDefinition() {
  definitionLoading.value = true;
  try {
    const { data } = await fetchGetEntitlementDefinition();
    definitionVersion.value = data?.version || '-';
    disallowedScopes.value = data?.disallowedScopes?.length ? [...data.disallowedScopes] : ['notification', 'share'];
  } finally {
    definitionLoading.value = false;
  }
}

async function fetchRows() {
  tableLoading.value = true;
  try {
    const params: EntitlementPoolListParams = {
      pageNum: Number(pagination.page || 1),
      pageSize: Number(pagination.pageSize || 10),
      ...(searchModel.keyword.trim() ? { keyword: searchModel.keyword.trim() } : {}),
      ...(searchModel.poolType ? { poolType: searchModel.poolType } : {}),
      ...(searchModel.status ? { status: searchModel.status } : {}),
    };
    const { data } = await fetchEntitlementPoolList(params);
    const pageData = (data || { rows: [], total: 0, pageNum: 1, pageSize: 10, pages: 0 }) as EntitlementPoolListData;
    rows.value = Array.isArray(pageData.rows) ? pageData.rows : [];
    pagination.itemCount = Number(pageData.total || 0);
  } finally {
    tableLoading.value = false;
  }
}

function runAsyncTask(task: () => Promise<unknown>) {
  task().catch(() => undefined);
}

function handleSearch() {
  pagination.page = 1;
  runAsyncTask(fetchRows);
}

function handleReset() {
  searchModel.keyword = '';
  searchModel.poolType = null;
  searchModel.status = null;
  pagination.page = 1;
  runAsyncTask(fetchRows);
}

function refreshWorkspace() {
  runAsyncTask(async () => {
    await Promise.all([loadDefinition(), fetchRows()]);
  });
}

function openCreate() {
  drawerMode.value = 'create';
  editingId.value = null;
  drawerModel.value = createDefaultDraft();
  drawerVisible.value = true;
}

function openEdit(row: EntitlementPoolRecord) {
  drawerMode.value = 'edit';
  editingId.value = row.id;
  drawerModel.value = {
    name: row.name,
    poolType: row.poolType,
    touchpoints: [...row.touchpoints],
    sourceType: row.sourceType || null,
    sourceKey: row.sourceKey || '',
    memberId: row.memberId || '',
    templateId: row.templateId || '',
    templateName: row.templateName || '',
    taskId: row.taskId || '',
    taskName: row.taskName || '',
  };
  drawerVisible.value = true;
}

async function copyRow(row: EntitlementPoolRecord) {
  // 复制时剔除协议禁止触点，避免把 notification/share 等不可运行范围带入新权益池。
  const touchpoints = row.touchpoints.filter((item) => !disallowedScopes.value.includes(item));
  await fetchCreateEntitlementPool({
    name: `${row.name}-副本`,
    poolType: row.poolType,
    touchpoints: touchpoints.length ? touchpoints : [getPoolTouchpoint(row.poolType)],
    sourceType: row.sourceType || undefined,
    sourceKey: row.sourceKey || '',
    memberId: row.memberId || '',
    templateId: row.templateId || '',
    templateName: row.templateName || '',
    taskId: row.taskId || '',
    taskName: row.taskName || '',
  });
  await fetchRows();
  window.$message?.success('权益池已复制');
}

async function removeRow(rowId: string) {
  const target = rows.value.find((item) => item.id === rowId);
  if (!target) return;

  window.$dialog?.warning({
    title: '删除权益池',
    content: `确认删除「${target.name}」吗？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await fetchDeleteEntitlementPool(rowId);
      await fetchRows();
      window.$message?.success('权益池已删除');
    },
  });
}

async function handleDrawerSubmit(draft: EntitlementPoolDraft) {
  saving.value = true;
  try {
    // 保存草稿前再次过滤禁止触点，并补齐当前池类型的主触点。
    const touchpoints = draft.touchpoints.filter((item) => !disallowedScopes.value.includes(item));
    const payload = {
      name: draft.name,
      poolType: draft.poolType,
      touchpoints: [...new Set(touchpoints.length ? touchpoints : [getPoolTouchpoint(draft.poolType)])],
      sourceType: draft.sourceType || undefined,
      sourceKey: draft.sourceKey || '',
      memberId: draft.memberId || '',
      templateId: draft.templateId || '',
      templateName: draft.templateName || '',
      taskId: draft.taskId || '',
      taskName: draft.taskName || '',
    };

    if (editingId.value && drawerMode.value === 'edit') {
      await fetchUpdateEntitlementPool(editingId.value, payload);
      window.$message?.success('权益池已更新');
    } else {
      await fetchCreateEntitlementPool(payload);
      window.$message?.success('权益池已创建');
    }

    await fetchRows();
    drawerVisible.value = false;
  } finally {
    saving.value = false;
  }
}

function getPoolTouchpoint(poolType: EntitlementPoolType): EntitlementTouchpoint {
  if (poolType === 'COUPON') return 'coupon';
  if (poolType === 'POINTS') return 'points';
  return 'product';
}

function applyCompileResult(
  row: EntitlementPoolRecord,
  result: EntitlementPoolCompileResult | null,
): EntitlementCompileApplyResult {
  const now = new Date().toISOString();
  if (!result) {
    return {
      result: null,
      next: {
        ...row,
        status: 'FAILED',
        updatedAt: now,
        riskSummary: ['编译结果为空，请检查后端返回结构'],
      },
    };
  }
  const next: EntitlementPoolRecord = {
    ...row,
    status: 'COMPILED',
    owner: result.compileTarget.owner || row.owner,
    compileArtifacts: result.compileTarget.runtimeArtifacts || [],
    riskSummary: result.riskSummary || [],
    compilePreview: result.preview,
    updatedAt: now,
    lastCompiledAt: now,
  };
  return { next, result };
}

function buildCompilePayload(row: EntitlementPoolRecord): CompileEntitlementPayload {
  // 编译请求只提交后端需要的池输入；预览、风险摘要、运行 artifacts 由编译接口生成。
  const touchpoints = row.touchpoints.filter((item) => !disallowedScopes.value.includes(item));
  const payload: CompileEntitlementPayload = {
    touchpoints: touchpoints.length ? touchpoints : [getPoolTouchpoint(row.poolType)],
    pools: [
      {
        poolType: row.poolType,
      },
    ],
  };
  const poolInput = payload.pools[0];
  if (row.poolType === 'PRODUCT') {
    poolInput.sourceType = row.sourceType || 'SCENE';
    poolInput.sourceKey = row.sourceKey || undefined;
    poolInput.memberId = row.memberId || undefined;
    poolInput.pageNum = 1;
    poolInput.pageSize = 20;
  } else if (row.poolType === 'COUPON') {
    poolInput.templateId = row.templateId || undefined;
  } else {
    poolInput.taskId = row.taskId || undefined;
  }
  return payload;
}

async function compileRow(row: EntitlementPoolRecord) {
  compilingIds[row.id] = true;
  try {
    // 编译失败也回写 FAILED 状态，避免运营误以为旧的 COMPILED 结果仍然可信。
    const payload = buildCompilePayload(row);
    const { data } = await fetchCompileEntitlementPool(payload);
    const compileData = (data || {}) as EntitlementCompileData;
    const result = compileData.pools?.[0] ?? null;
    const applied = applyCompileResult(row, result);
    const updatePayload: UpdateEntitlementPoolPayload = {
      status: applied.next.status,
      compileArtifacts: applied.next.compileArtifacts,
      riskSummary: applied.next.riskSummary,
      compilePreview: applied.next.compilePreview,
      lastCompiledAt: applied.next.lastCompiledAt || undefined,
    };
    await fetchUpdateEntitlementPool(row.id, updatePayload);
    await fetchRows();

    if (applied.result) {
      window.$message?.success('权益池编译完成');
      if (row.poolType === 'PRODUCT' && hasPreviewRows(applied.next.compilePreview)) {
        await openPreview(applied.next);
      }
    } else {
      window.$message?.warning('权益池编译未返回有效结果');
    }
  } catch {
    const now = new Date().toISOString();
    await fetchUpdateEntitlementPool(row.id, {
      status: 'FAILED',
      riskSummary: ['编译失败，请检查来源参数和后端日志'],
      lastCompiledAt: now,
    });
    await fetchRows();
  } finally {
    compilingIds[row.id] = false;
  }
}

function hasPreviewRows(preview: Record<string, unknown> | undefined) {
  if (!preview || typeof preview !== 'object') return false;
  const previewRows = (preview as Record<string, unknown>).rows;
  return Array.isArray(previewRows) && previewRows.length > 0;
}

function hasProductPreview(row: EntitlementPoolRecord) {
  return row.poolType === 'PRODUCT' && hasPreviewRows(row.compilePreview);
}

async function openPreview(row: EntitlementPoolRecord) {
  const preview = row.compilePreview;
  if (!preview || typeof preview !== 'object') {
    window.$message?.warning('该商品池还没有可预览的编译结果');
    return;
  }
  const record = preview as Record<string, unknown>;
  const rowsData = Array.isArray(record.rows) ? (record.rows as Record<string, unknown>[]) : [];
  productPreviewRows.value = rowsData;
  productPreviewTotal.value = typeof record.total === 'number' ? record.total : rowsData.length;
  productPreviewVisible.value = true;
}

function handlePickProduct() {
  productPickerVisible.value = true;
}

function handlePickCouponTemplate() {
  couponTemplatePickerVisible.value = true;
}

function handlePickPointsTask() {
  pointsTaskPickerVisible.value = true;
}

function handleProductSelect(row: ProductPickerSelection) {
  productPickerVisible.value = false;
  if (!drawerModel.value) return;
  drawerModel.value = {
    ...drawerModel.value,
    sourceKey: row.productId || row.id || '',
    sourceType: 'SCENE',
  };
}

function handleCouponTemplateSelect(row: CouponTemplatePickerSelection) {
  couponTemplatePickerVisible.value = false;
  if (!drawerModel.value) return;
  drawerModel.value = {
    ...drawerModel.value,
    templateId: row.templateId || '',
    templateName: row.name || row.displayName || '',
  };
}

function handlePointsTaskSelect(row: PointsTaskPickerSelection) {
  pointsTaskPickerVisible.value = false;
  if (!drawerModel.value) return;
  drawerModel.value = {
    ...drawerModel.value,
    taskId: row.taskId || row.id || '',
    taskName: row.taskName || row.displayName || '',
  };
}

function renderPoolTypeTag(poolType: EntitlementPoolType) {
  if (poolType === 'COUPON') return <NTag type="info">券池</NTag>;
  if (poolType === 'POINTS') return <NTag type="warning">积分池</NTag>;
  return <NTag type="success">商品池</NTag>;
}

function renderStatusTag(status: EntitlementPoolStatus) {
  if (status === 'COMPILED') return <NTag type="success">编译成功</NTag>;
  if (status === 'FAILED') return <NTag type="error">编译失败</NTag>;
  return <NTag>草稿</NTag>;
}

function renderPoolSummary(row: EntitlementPoolRecord) {
  if (row.poolType === 'PRODUCT') {
    return (
      <div class="flex-col gap-4px text-xs text-gray-600">
        <span>sourceType: {row.sourceType || '-'}</span>
        <span>sourceKey: {row.sourceKey || '-'}</span>
        <span>memberId: {row.memberId || '-'}</span>
      </div>
    );
  }
  if (row.poolType === 'COUPON') {
    return (
      <div class="flex-col gap-4px text-xs text-gray-600">
        <span>templateId: {row.templateId || '-'}</span>
        <span>{row.templateName || '-'}</span>
      </div>
    );
  }
  return (
    <div class="flex-col gap-4px text-xs text-gray-600">
      <span>taskId: {row.taskId || '-'}</span>
      <span>{row.taskName || '-'}</span>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 工作台摘要区：展示权益协议版本、禁用触点和刷新入口。 -->
    <NCard :bordered="false" size="small" class="card-wrapper">
      <div class="flex items-start justify-between gap-12px lt-sm:flex-col">
        <div class="flex-col gap-6px">
          <h2 class="text-18px font-semibold">权益池工作台</h2>
          <p class="text-13px text-gray-500">
            编排商品池、券池、积分池，统一通过 entitlement 协议编译输出运行 owner 和风险摘要。
          </p>
        </div>
        <div class="flex items-center gap-8px">
          <NTag :type="definitionLoading ? 'warning' : 'success'">协议版本 {{ definitionVersion }}</NTag>
          <NTag v-for="scope in disallowedScopes" :key="scope" type="warning">禁用: {{ scope }}</NTag>
          <NButton ghost @click="refreshWorkspace">刷新协议</NButton>
        </div>
      </div>
    </NCard>

    <!-- 搜索区：按权益池名称、类型和编译状态筛选。 -->
    <EntitlementPoolSearch
      :model="searchModel"
      :pool-type-options="poolTypeOptions"
      :status-options="statusOptions"
      @search="handleSearch"
      @reset="handleReset"
    />

    <!-- 权益池表格区：承载编辑、复制、编译、预览和删除入口。 -->
    <EntitlementPoolTableCard
      :columns="tableColumns"
      :data="pagedRows"
      :loading="tableLoading"
      :pagination="pagination"
      :flex-height="!appStore.isMobile"
      :scroll-x="scrollX"
      @create="openCreate"
      @refresh="refreshWorkspace"
    />

    <!-- 权益池编辑抽屉：维护草稿字段，编译前不生成运行产物。 -->
    <EntitlementPoolOperateDrawer
      v-model:visible="drawerVisible"
      :mode="drawerMode"
      :model="drawerModel"
      :submitting="saving"
      :disallowed-scopes="disallowedScopes"
      @submit="handleDrawerSubmit"
      @pick-product="handlePickProduct"
      @pick-coupon-template="handlePickCouponTemplate"
      @pick-points-task="handlePickPointsTask"
    />

    <!-- 商品池预览抽屉：展示最近一次编译返回的商品候选。 -->
    <ProductPoolPreviewDrawer
      v-model:visible="productPreviewVisible"
      :rows="productPreviewRows"
      :total="productPreviewTotal"
      :loading="false"
    />

    <!-- 业务选择器区：按池类型选择商品、券模板或积分任务。 -->
    <ProductSelectModal
      v-model:visible="productPickerVisible"
      :selected="selectedProduct"
      @select="handleProductSelect"
    />
    <CouponTemplateSelectModal
      v-model:visible="couponTemplatePickerVisible"
      :selected="selectedCouponTemplate"
      @select="handleCouponTemplateSelect"
    />
    <PointsTaskSelectModal
      v-model:visible="pointsTaskPickerVisible"
      :selected="selectedPointsTask"
      @select="handlePointsTaskSelect"
    />
  </div>
</template>
