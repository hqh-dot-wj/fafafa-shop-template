<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NInput, NSpace } from 'naive-ui';
import { fetchGetTenantList } from '@/service/api/system/tenant';
import EntityPickerModalShell from './entity-picker-modal-shell.vue';
import { type TenantPickerSelection, buildTenantSelection } from './entity-picker.shared';

defineOptions({ name: 'TenantSelectModal' });

interface Props {
  visible: boolean;
  selected?: Partial<TenantPickerSelection> | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', row: TenantPickerSelection): void;
}

const emit = defineEmits<Emits>();

const show = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const loading = ref(false);
const tempSelected = ref<TenantPickerSelection | null>(null);
const searchForm = reactive({
  tenantId: '',
  companyName: '',
});
const data = ref<Api.System.Tenant[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});

const columns: NaiveUI.TableColumns<Api.System.Tenant> = [
  {
    title: '租户名称',
    key: 'companyName',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    title: '租户编号',
    key: 'tenantId',
    minWidth: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: '联系人',
    key: 'contactUserName',
    width: 120,
    ellipsis: { tooltip: true },
  },
  {
    title: '手机号',
    key: 'contactPhone',
    width: 140,
  },
];

async function fetchData() {
  loading.value = true;

  try {
    const { data: response, error } = await fetchGetTenantList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      tenantId: searchForm.tenantId || undefined,
      companyName: searchForm.companyName || undefined,
    });

    if (!error && response) {
      data.value = response.rows || [];
      pagination.itemCount = response.total || 0;
    }
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.page = 1;
  fetchData().catch(() => {});
}

function handleResetSearch() {
  searchForm.tenantId = '';
  searchForm.companyName = '';
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData().catch(() => {});
}

function handleSelectRow(row: Api.System.Tenant) {
  tempSelected.value = buildTenantSelection(row);
}

function handleConfirm() {
  if (!tempSelected.value) return;
  emit('select', tempSelected.value);
  show.value = false;
}

watch(
  () => props.selected,
  value => {
    tempSelected.value = value ? buildTenantSelection(value) : null;
  },
  { immediate: true },
);

watch(show, value => {
  if (value) {
    tempSelected.value = props.selected ? buildTenantSelection(props.selected) : null;
    fetchData().catch(() => {});
  }
});
</script>

<template>
  <EntityPickerModalShell
    v-model:visible="show"
    title="选择租户"
    selected-title="已选租户"
    :confirm-disabled="!tempSelected"
    @confirm="handleConfirm"
  >
    <template #search>
      <NSpace>
        <NInput v-model:value="searchForm.tenantId" placeholder="租户编号" clearable @keyup.enter="handleSearch" />
        <NInput
          v-model:value="searchForm.companyName"
          placeholder="租户名称"
          clearable
          @keyup.enter="handleSearch"
        />
        <NButton type="primary" @click="handleSearch">搜索</NButton>
        <NButton @click="handleResetSearch">重置</NButton>
      </NSpace>
    </template>

    <template #table>
      <NDataTable
        remote
        size="small"
        :loading="loading"
        :columns="columns"
        :data="data"
        :pagination="pagination"
        :row-key="row => row.tenantId"
        :row-props="row => ({ onClick: () => handleSelectRow(row), style: row.tenantId === tempSelected?.tenantId ? 'cursor:pointer;background:rgba(24,160,88,0.08);' : 'cursor:pointer;' })"
        :max-height="430"
        @update:page="handlePageChange"
      />
    </template>

    <template #selected>
      <div v-if="tempSelected" class="flex flex-col gap-3 rounded-12px bg-white p-12px">
        <div class="min-w-0">
          <div class="truncate font-medium">{{ tempSelected.displayName }}</div>
          <div class="truncate text-xs text-gray-500">{{ tempSelected.tenantId }}</div>
        </div>
        <div class="rounded-8px bg-slate-50 p-10px text-sm text-slate-600">
          <div>租户编号：{{ tempSelected.tenantId }}</div>
          <div>租户名称：{{ tempSelected.companyName || tempSelected.displayName }}</div>
          <div>联系人：{{ tempSelected.contactUserName || '-' }}</div>
          <div>手机号：{{ tempSelected.contactPhone || '-' }}</div>
        </div>
      </div>
      <NEmpty v-else description="请选择租户" class="h-full flex items-center justify-center" />
    </template>
  </EntityPickerModalShell>
</template>
