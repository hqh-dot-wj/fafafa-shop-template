<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import type { DataTableColumns, PaginationProps, SelectOption } from 'naive-ui';
import { NButton, NTag } from 'naive-ui';
import {
  type PointsConsumeAllocation,
  type PointsConsumeAllocationQuery,
  type PointsDebt,
  type PointsDebtQuery,
  type PointsFreezeAllocation,
  type PointsFreezeAllocationQuery,
  type PointsLot,
  type PointsLotQuery,
  type PointsRefundAllocation,
  type PointsRefundAllocationQuery,
  fetchGetPointsConsumeAllocations,
  fetchGetPointsDebts,
  fetchGetPointsFreezeAllocations,
  fetchGetPointsLots,
  fetchGetPointsRefundAllocations,
} from '@/service/api/marketing/points';
import MemberSelectModal from '@/components/business/member-select-modal.vue';
import type { MemberPickerSelection } from '@/components/business/entity-picker.shared';

defineOptions({ name: 'PointsAssetLedgerPanel' });

// 积分资产账面板只读展示 lot / freeze / consume / refund / debt 五类分摊视图。
// 这些表共同解释积分余额来源，前端不能在这里修改分摊或自行重算可用积分。
const props = defineProps<{
  memberId?: string;
  memberName?: string;
}>();

type LedgerTab = 'lots' | 'freeze' | 'consume' | 'refund' | 'debt';
type TagType = 'default' | 'info' | 'success' | 'warning' | 'error';
type LotStatus = PointsLot['status'];
type FreezeStatus = PointsFreezeAllocation['status'];
type ConsumeStatus = PointsConsumeAllocation['status'];
type RefundStrategy = PointsRefundAllocation['strategy'];
type DebtStatus = PointsDebt['status'];
type DebtReason = PointsDebt['reason'];

type LabelMeta = {
  label: string;
  type?: TagType;
};

type AssetFilters = {
  memberId: string | null;
  memberDisplayName: string;
  relatedId: string;
  lotStatus: '' | LotStatus;
  freezeStatus: '' | FreezeStatus;
  consumeStatus: '' | ConsumeStatus;
  refundStrategy: '' | RefundStrategy;
  debtStatus: '' | DebtStatus;
  debtReason: '' | DebtReason;
};

const lotStatusMeta: Record<LotStatus, LabelMeta> = {
  ACTIVE: { label: '可用', type: 'success' },
  EXHAUSTED: { label: '已耗尽', type: 'default' },
  EXPIRED: { label: '已过期', type: 'warning' },
  CANCELLED: { label: '已取消', type: 'error' },
};

const freezeStatusMeta: Record<FreezeStatus, LabelMeta> = {
  ACTIVE: { label: '冻结中', type: 'warning' },
  RELEASED: { label: '已释放', type: 'default' },
  CONSUMED: { label: '已结算', type: 'success' },
  CANCELLED: { label: '已取消', type: 'error' },
};

const consumeStatusMeta: Record<ConsumeStatus, LabelMeta> = {
  ACTIVE: { label: '可退款', type: 'success' },
  REFUNDED: { label: '已退款', type: 'default' },
  CANCELLED: { label: '已取消', type: 'error' },
};

const refundStrategyMeta: Record<RefundStrategy, LabelMeta> = {
  ORIGINAL_LOT_RESTORE: { label: '原批次恢复', type: 'success' },
  EXPIRED_LOT_COMPENSATION: { label: '过期补偿', type: 'warning' },
  NEW_REFUND_TRANSACTION: { label: '补偿批次', type: 'info' },
  MANUAL_REVIEW: { label: '人工复核', type: 'error' },
};

const debtStatusMeta: Record<DebtStatus, LabelMeta> = {
  OPEN: { label: '待处理', type: 'error' },
  PARTIAL: { label: '部分扣回', type: 'warning' },
  RESOLVED: { label: '已结清', type: 'success' },
  CANCELLED: { label: '已取消', type: 'default' },
};

const debtReasonMeta: Record<DebtReason, LabelMeta> = {
  ORDER_REFUND_CLAWBACK_INSUFFICIENT: { label: '退款扣回余额不足', type: 'warning' },
};

const sourceTypeMeta: Record<NonNullable<PointsLot['sourceType']>, LabelMeta> = {
  EARN_ORDER: { label: '订单发放', type: 'success' },
  EARN_SIGNIN: { label: '签到发放', type: 'success' },
  EARN_TASK: { label: '任务发放', type: 'success' },
  EARN_ADMIN: { label: '后台发放', type: 'info' },
  USE_ORDER: { label: '订单抵扣', type: 'warning' },
  USE_COUPON: { label: '优惠券使用', type: 'warning' },
  USE_PRODUCT: { label: '商品兑换', type: 'warning' },
  FREEZE: { label: '冻结', type: 'warning' },
  UNFREEZE: { label: '解冻', type: 'default' },
  EXPIRE: { label: '过期', type: 'default' },
  REFUND: { label: '退款返还', type: 'info' },
  DEDUCT_ADMIN: { label: '后台扣减', type: 'error' },
};

const activeTab = ref<LedgerTab>('lots');
const memberPickerVisible = ref(false);
const filters = reactive<AssetFilters>({
  memberId: null,
  memberDisplayName: '',
  relatedId: '',
  lotStatus: '',
  freezeStatus: '',
  consumeStatus: '',
  refundStrategy: '',
  debtStatus: '',
  debtReason: '',
});

const lots = ref<PointsLot[]>([]);
const freezeAllocations = ref<PointsFreezeAllocation[]>([]);
const consumeAllocations = ref<PointsConsumeAllocation[]>([]);
const refundAllocations = ref<PointsRefundAllocation[]>([]);
const debts = ref<PointsDebt[]>([]);
const lotsLoading = ref(false);
const freezeLoading = ref(false);
const consumeLoading = ref(false);
const refundLoading = ref(false);
const debtLoading = ref(false);
const lotsPage = ref(1);
const freezePage = ref(1);
const consumePage = ref(1);
const refundPage = ref(1);
const debtPage = ref(1);
const lotsPageSize = ref(10);
const freezePageSize = ref(10);
const consumePageSize = ref(10);
const refundPageSize = ref(10);
const debtPageSize = ref(10);
const lotsTotal = ref(0);
const freezeTotal = ref(0);
const consumeTotal = ref(0);
const refundTotal = ref(0);
const debtTotal = ref(0);

const pageSizes = [10, 20, 50];

const lotStatusOptions = computed(() => buildOptions(lotStatusMeta));
const freezeStatusOptions = computed(() => buildOptions(freezeStatusMeta));
const consumeStatusOptions = computed(() => buildOptions(consumeStatusMeta));
const refundStrategyOptions = computed(() => buildOptions(refundStrategyMeta));
const debtStatusOptions = computed(() => buildOptions(debtStatusMeta));
const debtReasonOptions = computed(() => buildOptions(debtReasonMeta));

const lotsPagination = computed(() => buildPagination(lotsPage.value, lotsPageSize.value, lotsTotal.value));
const freezePagination = computed(() => buildPagination(freezePage.value, freezePageSize.value, freezeTotal.value));
const consumePagination = computed(() => buildPagination(consumePage.value, consumePageSize.value, consumeTotal.value));
const refundPagination = computed(() => buildPagination(refundPage.value, refundPageSize.value, refundTotal.value));
const debtPagination = computed(() => buildPagination(debtPage.value, debtPageSize.value, debtTotal.value));

const lotColumns = computed<DataTableColumns<PointsLot>>(() => [
  { key: 'id', title: '批次ID', minWidth: 180, ellipsis: { tooltip: true }, render: (row) => renderMono(row.id) },
  {
    key: 'memberId',
    title: '会员ID',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.memberId),
  },
  {
    key: 'sourceType',
    title: '来源类型',
    width: 110,
    render: (row) => renderNullableMetaTag(row.sourceType, sourceTypeMeta),
  },
  {
    key: 'sourceTransactionId',
    title: '来源交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.sourceTransactionId),
  },
  { key: 'totalAmount', title: '总积分', align: 'right', width: 90 },
  { key: 'availableAmount', title: '可用', align: 'right', width: 80 },
  { key: 'frozenAmount', title: '冻结', align: 'right', width: 80 },
  { key: 'consumedAmount', title: '已消费', align: 'right', width: 90 },
  { key: 'expiredAmount', title: '已过期', align: 'right', width: 90 },
  { key: 'status', title: '状态', width: 90, render: (row) => renderMetaTag(row.status, lotStatusMeta) },
  { key: 'expireTime', title: '过期时间', minWidth: 160, render: (row) => row.expireTime || '-' },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
]);

const freezeColumns = computed<DataTableColumns<PointsFreezeAllocation>>(() => [
  { key: 'id', title: '分摊ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.id) },
  {
    key: 'memberId',
    title: '会员ID',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.memberId),
  },
  { key: 'lotId', title: '批次ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.lotId) },
  {
    key: 'freezeTransactionId',
    title: '冻结交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.freezeTransactionId),
  },
  {
    key: 'releaseTransactionId',
    title: '解冻交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.releaseTransactionId),
  },
  {
    key: 'relatedId',
    title: '关联业务',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.relatedId),
  },
  { key: 'amount', title: '分摊积分', align: 'right', width: 90 },
  { key: 'status', title: '状态', width: 90, render: (row) => renderMetaTag(row.status, freezeStatusMeta) },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
]);

const consumeColumns = computed<DataTableColumns<PointsConsumeAllocation>>(() => [
  { key: 'id', title: '分摊ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.id) },
  {
    key: 'memberId',
    title: '会员ID',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.memberId),
  },
  { key: 'lotId', title: '批次ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.lotId) },
  {
    key: 'spendTransactionId',
    title: '消费交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.spendTransactionId),
  },
  {
    key: 'sourceFreezeAllocationId',
    title: '来源冻结',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.sourceFreezeAllocationId),
  },
  {
    key: 'relatedId',
    title: '关联业务',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.relatedId),
  },
  { key: 'amount', title: '消费积分', align: 'right', width: 90 },
  { key: 'refundableAmount', title: '可退积分', align: 'right', width: 90 },
  { key: 'status', title: '状态', width: 90, render: (row) => renderMetaTag(row.status, consumeStatusMeta) },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
]);

const refundColumns = computed<DataTableColumns<PointsRefundAllocation>>(() => [
  { key: 'id', title: '分摊ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.id) },
  {
    key: 'memberId',
    title: '会员ID',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.memberId),
  },
  {
    key: 'refundTransactionId',
    title: '退款交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.refundTransactionId),
  },
  {
    key: 'sourceSpendTransactionId',
    title: '原消费交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.sourceSpendTransactionId),
  },
  {
    key: 'sourceLotId',
    title: '来源批次',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.sourceLotId),
  },
  {
    key: 'targetLotId',
    title: '目标批次',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.targetLotId),
  },
  {
    key: 'relatedId',
    title: '关联业务',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.relatedId),
  },
  { key: 'amount', title: '退款积分', align: 'right', width: 90 },
  { key: 'strategy', title: '退款策略', width: 120, render: (row) => renderMetaTag(row.strategy, refundStrategyMeta) },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
]);

const debtColumns = computed<DataTableColumns<PointsDebt>>(() => [
  { key: 'id', title: '欠账ID', minWidth: 170, ellipsis: { tooltip: true }, render: (row) => renderMono(row.id) },
  {
    key: 'memberId',
    title: '会员ID',
    minWidth: 140,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.memberId),
  },
  {
    key: 'relatedId',
    title: '关联订单',
    minWidth: 150,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.relatedId),
  },
  {
    key: 'sourceTransactionId',
    title: '来源发放交易',
    minWidth: 170,
    ellipsis: { tooltip: true },
    render: (row) => renderMono(row.sourceTransactionId),
  },
  { key: 'expectedAmount', title: '应扣', align: 'right', width: 80 },
  { key: 'deductedAmount', title: '已扣', align: 'right', width: 80 },
  { key: 'debtAmount', title: '欠账', align: 'right', width: 80 },
  { key: 'availableAtCreate', title: '创建时可用', align: 'right', width: 110 },
  { key: 'status', title: '状态', width: 110, render: (row) => renderMetaTag(row.status, debtStatusMeta) },
  { key: 'reason', title: '原因', width: 150, render: (row) => renderMetaTag(row.reason, debtReasonMeta) },
  { key: 'remark', title: '备注', minWidth: 160, render: (row) => row.remark || '-' },
  { key: 'createTime', title: '创建时间', minWidth: 160 },
]);

function buildOptions<T extends string>(metaMap: Record<T, LabelMeta>): SelectOption[] {
  return [
    { label: '全部', value: '' },
    ...Object.entries(metaMap).map(([value, meta]) => ({
      label: (meta as LabelMeta).label,
      value,
    })),
  ];
}

function buildPagination(page: number, pageSize: number, itemCount: number): PaginationProps {
  return {
    page,
    pageSize,
    itemCount,
    showSizePicker: true,
    pageSizes,
  };
}

function renderMetaTag<T extends string>(value: T, metaMap: Record<T, LabelMeta>) {
  const meta = metaMap[value];

  return h(NTag, { type: meta.type ?? 'default', size: 'small', bordered: false }, { default: () => meta.label });
}

function renderNullableMetaTag<T extends string>(value: T | null, metaMap: Record<T, LabelMeta>) {
  if (!value) return '-';

  return renderMetaTag(value, metaMap);
}

function renderMono(value?: string | null) {
  return value ? h('span', { class: 'font-mono text-xs' }, value) : '-';
}

function syncMemberFromProps() {
  filters.memberId = props.memberId || null;
  filters.memberDisplayName = props.memberName || props.memberId || '';
}

function buildCommonQuery() {
  // 所有资产账查询都共用会员与关联业务过滤，避免不同 tab 对同一笔订单查出不一致口径。
  return {
    memberId: filters.memberId || undefined,
    relatedId: filters.relatedId.trim() || undefined,
  };
}

async function loadLots(resetPage = false) {
  if (resetPage) lotsPage.value = 1;
  lotsLoading.value = true;
  try {
    const query: PointsLotQuery = {
      ...buildCommonQuery(),
      status: filters.lotStatus || undefined,
      pageNum: lotsPage.value,
      pageSize: lotsPageSize.value,
    };
    const { data } = await fetchGetPointsLots(query);
    lots.value = data?.rows ?? [];
    lotsTotal.value = data?.total ?? 0;
  } finally {
    lotsLoading.value = false;
  }
}

async function loadFreezeAllocations(resetPage = false) {
  if (resetPage) freezePage.value = 1;
  freezeLoading.value = true;
  try {
    const query: PointsFreezeAllocationQuery = {
      ...buildCommonQuery(),
      status: filters.freezeStatus || undefined,
      pageNum: freezePage.value,
      pageSize: freezePageSize.value,
    };
    const { data } = await fetchGetPointsFreezeAllocations(query);
    freezeAllocations.value = data?.rows ?? [];
    freezeTotal.value = data?.total ?? 0;
  } finally {
    freezeLoading.value = false;
  }
}

async function loadConsumeAllocations(resetPage = false) {
  if (resetPage) consumePage.value = 1;
  consumeLoading.value = true;
  try {
    const query: PointsConsumeAllocationQuery = {
      ...buildCommonQuery(),
      status: filters.consumeStatus || undefined,
      pageNum: consumePage.value,
      pageSize: consumePageSize.value,
    };
    const { data } = await fetchGetPointsConsumeAllocations(query);
    consumeAllocations.value = data?.rows ?? [];
    consumeTotal.value = data?.total ?? 0;
  } finally {
    consumeLoading.value = false;
  }
}

async function loadRefundAllocations(resetPage = false) {
  if (resetPage) refundPage.value = 1;
  refundLoading.value = true;
  try {
    const query: PointsRefundAllocationQuery = {
      ...buildCommonQuery(),
      strategy: filters.refundStrategy || undefined,
      pageNum: refundPage.value,
      pageSize: refundPageSize.value,
    };
    const { data } = await fetchGetPointsRefundAllocations(query);
    refundAllocations.value = data?.rows ?? [];
    refundTotal.value = data?.total ?? 0;
  } finally {
    refundLoading.value = false;
  }
}

async function loadDebts(resetPage = false) {
  if (resetPage) debtPage.value = 1;
  debtLoading.value = true;
  try {
    const query: PointsDebtQuery = {
      ...buildCommonQuery(),
      status: filters.debtStatus || undefined,
      reason: filters.debtReason || undefined,
      pageNum: debtPage.value,
      pageSize: debtPageSize.value,
    };
    const { data } = await fetchGetPointsDebts(query);
    debts.value = data?.rows ?? [];
    debtTotal.value = data?.total ?? 0;
  } finally {
    debtLoading.value = false;
  }
}

function loadCurrent(resetPage = false) {
  if (activeTab.value === 'lots') return loadLots(resetPage);
  if (activeTab.value === 'freeze') return loadFreezeAllocations(resetPage);
  if (activeTab.value === 'consume') return loadConsumeAllocations(resetPage);
  if (activeTab.value === 'refund') return loadRefundAllocations(resetPage);
  return loadDebts(resetPage);
}

function resetFilters() {
  // 重置只清本地查询条件，不清父页面传入的 memberId；父页面切换会员会通过 watcher 重新同步。
  filters.relatedId = '';
  filters.lotStatus = '';
  filters.freezeStatus = '';
  filters.consumeStatus = '';
  filters.refundStrategy = '';
  filters.debtStatus = '';
  filters.debtReason = '';
  filters.memberId = null;
  filters.memberDisplayName = '';
  loadCurrent(true);
}

function openMemberPicker() {
  memberPickerVisible.value = true;
}

function handleMemberSelect(member: MemberPickerSelection) {
  filters.memberId = member.memberId;
  filters.memberDisplayName = member.displayName || member.nickname || member.mobile || member.memberId;
  loadCurrent(true);
}

function clearMember() {
  filters.memberId = null;
  filters.memberDisplayName = '';
  loadCurrent(true);
}

function handlePageChange(tab: LedgerTab, page: number) {
  if (tab === 'lots') lotsPage.value = page;
  if (tab === 'freeze') freezePage.value = page;
  if (tab === 'consume') consumePage.value = page;
  if (tab === 'refund') refundPage.value = page;
  if (tab === 'debt') debtPage.value = page;
  loadCurrent();
}

function handlePageSizeChange(tab: LedgerTab, pageSize: number) {
  if (tab === 'lots') {
    lotsPageSize.value = pageSize;
    lotsPage.value = 1;
  }
  if (tab === 'freeze') {
    freezePageSize.value = pageSize;
    freezePage.value = 1;
  }
  if (tab === 'consume') {
    consumePageSize.value = pageSize;
    consumePage.value = 1;
  }
  if (tab === 'refund') {
    refundPageSize.value = pageSize;
    refundPage.value = 1;
  }
  if (tab === 'debt') {
    debtPageSize.value = pageSize;
    debtPage.value = 1;
  }
  loadCurrent();
}

watch(
  () => [props.memberId, props.memberName],
  () => {
    syncMemberFromProps();
    loadCurrent(true);
  },
);

watch(activeTab, () => {
  loadCurrent(true);
});

onMounted(() => {
  syncMemberFromProps();
  loadCurrent(true);
});
</script>

<template>
  <div class="min-h-0 flex flex-col gap-16px">
    <!-- 筛选区：会员选择只写入查询参数，不改变账户或分摊数据。 -->
    <NForm :model="filters" label-placement="left" :label-width="82">
      <NGrid responsive="screen" item-responsive :x-gap="12" :y-gap="8">
        <NFormItemGi span="24 s:12 m:6" label="会员">
          <NInput
            v-model:value="filters.memberDisplayName"
            clearable
            readonly
            placeholder="点击选择会员"
            @click="openMemberPicker"
            @clear="clearMember"
          />
        </NFormItemGi>
        <NFormItemGi span="24 s:12 m:6" label="关联业务">
          <NInput v-model:value="filters.relatedId" clearable placeholder="订单ID / 任务ID" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'lots'" span="24 s:12 m:5" label="批次状态">
          <NSelect v-model:value="filters.lotStatus" :options="lotStatusOptions" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'freeze'" span="24 s:12 m:5" label="冻结状态">
          <NSelect v-model:value="filters.freezeStatus" :options="freezeStatusOptions" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'consume'" span="24 s:12 m:5" label="消费状态">
          <NSelect v-model:value="filters.consumeStatus" :options="consumeStatusOptions" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'refund'" span="24 s:12 m:5" label="退款策略">
          <NSelect v-model:value="filters.refundStrategy" :options="refundStrategyOptions" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'debt'" span="24 s:12 m:5" label="欠账状态">
          <NSelect v-model:value="filters.debtStatus" :options="debtStatusOptions" />
        </NFormItemGi>
        <NFormItemGi v-if="activeTab === 'debt'" span="24 s:12 m:5" label="欠账原因">
          <NSelect v-model:value="filters.debtReason" :options="debtReasonOptions" />
        </NFormItemGi>
        <NFormItemGi span="24 s:24 m:7">
          <NSpace class="w-full" justify="end">
            <NButton type="primary" ghost @click="loadCurrent(true)">
              <template #icon>
                <icon-ic-round-search class="text-icon" />
              </template>
              查询
            </NButton>
            <NButton ghost @click="resetFilters">
              <template #icon>
                <icon-ic-round-refresh class="text-icon" />
              </template>
              重置
            </NButton>
          </NSpace>
        </NFormItemGi>
      </NGrid>
    </NForm>

    <!-- 资产账分页表：按资产批次、冻结、消费、退款分摊分开，只读解释账务来源。 -->
    <NTabs v-model:value="activeTab" type="line" animated>
      <NTabPane name="lots" tab="资产批次">
        <NDataTable
          :columns="lotColumns"
          :data="lots"
          :loading="lotsLoading"
          :pagination="lotsPagination"
          :row-key="(row) => row.id"
          :scroll-x="1460"
          remote
          size="small"
          @update:page="(page) => handlePageChange('lots', page)"
          @update:page-size="(pageSize) => handlePageSizeChange('lots', pageSize)"
        />
      </NTabPane>
      <NTabPane name="freeze" tab="冻结分摊">
        <NDataTable
          :columns="freezeColumns"
          :data="freezeAllocations"
          :loading="freezeLoading"
          :pagination="freezePagination"
          :row-key="(row) => row.id"
          :scroll-x="1460"
          remote
          size="small"
          @update:page="(page) => handlePageChange('freeze', page)"
          @update:page-size="(pageSize) => handlePageSizeChange('freeze', pageSize)"
        />
      </NTabPane>
      <NTabPane name="consume" tab="消费分摊">
        <NDataTable
          :columns="consumeColumns"
          :data="consumeAllocations"
          :loading="consumeLoading"
          :pagination="consumePagination"
          :row-key="(row) => row.id"
          :scroll-x="1500"
          remote
          size="small"
          @update:page="(page) => handlePageChange('consume', page)"
          @update:page-size="(pageSize) => handlePageSizeChange('consume', pageSize)"
        />
      </NTabPane>
      <NTabPane name="refund" tab="退款分摊">
        <NDataTable
          :columns="refundColumns"
          :data="refundAllocations"
          :loading="refundLoading"
          :pagination="refundPagination"
          :row-key="(row) => row.id"
          :scroll-x="1680"
          remote
          size="small"
          @update:page="(page) => handlePageChange('refund', page)"
          @update:page-size="(pageSize) => handlePageSizeChange('refund', pageSize)"
        />
      </NTabPane>
      <NTabPane name="debt" tab="欠账风险">
        <NDataTable
          :columns="debtColumns"
          :data="debts"
          :loading="debtLoading"
          :pagination="debtPagination"
          :row-key="(row) => row.id"
          :scroll-x="1600"
          remote
          size="small"
          @update:page="(page) => handlePageChange('debt', page)"
          @update:page-size="(pageSize) => handlePageSizeChange('debt', pageSize)"
        />
      </NTabPane>
    </NTabs>

    <MemberSelectModal
      v-model:visible="memberPickerVisible"
      :selected="filters.memberId ? { memberId: filters.memberId, displayName: filters.memberDisplayName } : null"
      @select="handleMemberSelect"
    />
  </div>
</template>
