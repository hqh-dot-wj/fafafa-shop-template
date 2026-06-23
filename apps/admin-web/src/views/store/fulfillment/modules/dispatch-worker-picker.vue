<script setup lang="ts">
import { computed, h, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import {
  type DataTableColumns,
  NButton,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NInput,
  NInputNumber,
  NPagination,
  NSpace,
} from 'naive-ui';
import { fetchListServiceWorkerCandidates } from '@/service/api/store/fulfillment';
import { $t } from '@/locales';

defineOptions({
  name: 'FulfillmentDispatchWorkerPicker',
});

const workerId = defineModel<number | null>('workerId', { required: true });

const props = defineProps<{
  /** 弹窗打开时为 true，用于拉取首屏列表 */
  active: boolean;
}>();

const keyword = ref('');
const loading = ref(false);
const rows = ref<Api.Order.DispatchWorkerCandidate[]>([]);
const total = ref(0);
const pageNum = ref(1);
const pageSize = ref(8);
const manualId = ref<number | null>(null);
const selectedLabel = ref('');

function workerStatusLabel(status: string): string {
  const map: Record<string, string> = {
    WORKING: $t('page.store_dispatch_worker_picker.workerStatus.WORKING'),
    RESTING: $t('page.store_dispatch_worker_picker.workerStatus.RESTING'),
    DISABLED: $t('page.store_dispatch_worker_picker.workerStatus.DISABLED'),
    FROZEN: $t('page.store_dispatch_worker_picker.workerStatus.DISABLED'),
    RESIGNED: $t('page.store_dispatch_worker_picker.workerStatus.RESIGNED'),
  };
  return map[status] ?? status;
}

const columns = computed<DataTableColumns<Api.Order.DispatchWorkerCandidate>>(() => [
  { key: 'workerId', title: $t('page.store_dispatch_worker_picker.columnId'), width: 72, align: 'center' },
  {
    key: 'name',
    title: $t('page.store_dispatch_worker_picker.columnName'),
    ellipsis: { tooltip: true },
    render: (row) => {
      const nick = row.nickName ? $t('page.store_dispatch_worker_picker.nickWrap', { nick: row.nickName }) : '';
      return h('span', null, [row.name, nick]);
    },
  },
  { key: 'phone', title: $t('page.store_dispatch_worker_picker.columnPhone'), width: 124 },
  {
    key: 'status',
    title: $t('page.store_dispatch_worker_picker.columnStatus'),
    width: 88,
    render: (row) => workerStatusLabel(row.status),
  },
  {
    key: 'isOnline',
    title: $t('page.store_dispatch_worker_picker.columnOnlineToggle'),
    width: 88,
    align: 'center',
    render: (row) =>
      row.isOnline
        ? $t('page.store_dispatch_worker_picker.onlineOn')
        : $t('page.store_dispatch_worker_picker.onlineOff'),
  },
]);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const { data, error } = await fetchListServiceWorkerCandidates({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      ...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
    });
    if (error || !data) {
      rows.value = [];
      total.value = 0;
      return;
    }
    rows.value = data.rows;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

const debouncedKeywordSearch = useDebounceFn(() => {
  pageNum.value = 1;
  load().catch(() => {});
}, 350);

watch(
  () => props.active,
  (v) => {
    if (v) {
      keyword.value = '';
      pageNum.value = 1;
      manualId.value = null;
      load().catch(() => {});
    }
  },
);

function rowProps(row: Api.Order.DispatchWorkerCandidate) {
  return {
    style: { cursor: 'pointer' },
    class: workerId.value === row.workerId ? 'dispatch-worker-picker__row--selected' : undefined,
    onClick: () => pickRow(row),
  };
}

function pickRow(row: Api.Order.DispatchWorkerCandidate): void {
  workerId.value = row.workerId;
  const nick = row.nickName ? $t('page.store_dispatch_worker_picker.nickWrap', { nick: row.nickName }) : '';
  selectedLabel.value = `${row.name}${nick}`;
}

function applyManualId(): void {
  if (manualId.value === null || manualId.value === undefined || manualId.value <= 0) {
    window.$message?.warning($t('page.store_dispatch_worker_picker.msgInvalidWorkerId'));
    return;
  }
  workerId.value = manualId.value;
  selectedLabel.value = $t('page.store_dispatch_worker_picker.manualSelectedLabel');
}

function onPageChange(p: number): void {
  pageNum.value = p;
  load().catch(() => {});
}

function onPageSizeChange(s: number): void {
  pageSize.value = s;
  pageNum.value = 1;
  load().catch(() => {});
}
</script>

<template>
  <div class="dispatch-worker-picker flex flex-col gap-12px">
    <NInput
      v-model:value="keyword"
      clearable
      :placeholder="$t('page.store_dispatch_worker_picker.searchPlaceholder')"
      @update:value="debouncedKeywordSearch"
    />
    <NDataTable
      size="small"
      :columns="columns"
      :data="rows"
      :loading="loading"
      :row-key="(row) => row.workerId"
      :scroll-x="560"
      :max-height="280"
      :row-props="rowProps"
      bordered
    />
    <NPagination
      :page="pageNum"
      :page-size="pageSize"
      :item-count="total"
      size="small"
      show-size-picker
      :page-sizes="[8, 10, 20]"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
    />
    <p v-if="workerId != null && workerId > 0" class="text-14px text-gray-700">
      {{ $t('page.store_dispatch_worker_picker.currentSelection', { id: workerId }) }}
      <span v-if="selectedLabel"> · {{ selectedLabel }}</span>
    </p>
    <NCollapse>
      <NCollapseItem :title="$t('page.store_dispatch_worker_picker.manualSectionTitle')" name="manual">
        <NSpace vertical class="w-full">
          <NInputNumber
            v-model:value="manualId"
            :min="1"
            class="w-full"
            :placeholder="$t('page.store_dispatch_worker_picker.manualIdPlaceholder')"
          />
          <NButton size="small" secondary @click="applyManualId">
            {{ $t('page.store_dispatch_worker_picker.applyManual') }}
          </NButton>
        </NSpace>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.dispatch-worker-picker :deep(tr.dispatch-worker-picker__row--selected td) {
  background-color: rgba(24, 160, 88, 0.12);
}
</style>
