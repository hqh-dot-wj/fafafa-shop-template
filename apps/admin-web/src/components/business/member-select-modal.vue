<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue';
import type { DataTableColumns } from 'naive-ui';
import { NAvatar, NButton, NDataTable, NEmpty, NInput, NSpace, NTag } from 'naive-ui';
import { fetchGetMemberList } from '@/service/api/member/member';
import EntityPickerModalShell from './entity-picker-modal-shell.vue';
import { type MemberPickerSelection, buildMemberSelection } from './entity-picker.shared';

defineOptions({ name: 'MemberSelectModal' });

interface Props {
  visible: boolean;
  selected?: Partial<MemberPickerSelection> | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', row: MemberPickerSelection): void;
}

const emit = defineEmits<Emits>();

const show = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const loading = ref(false);
const tempSelected = ref<MemberPickerSelection | null>(null);

const searchForm = reactive({
  nickname: '',
  mobile: '',
});

const data = ref<Api.Member.Member[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});

const columns: DataTableColumns<Api.Member.Member> = [
  {
    key: 'nickname',
    title: '会员',
    minWidth: 220,
    render: row => {
      const selected = buildMemberSelection(row);

      return (
        <div class="flex items-center gap-3">
          {row.avatar ? <NAvatar src={row.avatar} size="small" /> : <NAvatar size="small">{selected.displayName.slice(0, 1)}</NAvatar>}
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{selected.displayName}</div>
            <div class="truncate text-xs text-gray-500">{row.mobile || row.memberId}</div>
          </div>
        </div>
      );
    },
  },
  {
    key: 'levelName',
    title: '会员等级',
    width: 120,
    render: row => row.levelName || '-',
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: row => <NTag type={row.status === '1' ? 'success' : 'warning'}>{row.status === '1' ? '正常' : '停用'}</NTag>,
  },
  {
    key: 'memberId',
    title: '会员ID',
    width: 160,
    render: row => <span class="font-mono text-xs">{row.memberId}</span>,
  },
];

async function fetchData() {
  loading.value = true;
  try {
    const { data: response, error } = await fetchGetMemberList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      nickname: searchForm.nickname || undefined,
      mobile: searchForm.mobile || undefined,
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
  searchForm.nickname = '';
  searchForm.mobile = '';
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData().catch(() => {});
}

function handleSelectRow(row: Api.Member.Member) {
  tempSelected.value = buildMemberSelection(row);
}

function handleConfirm() {
  if (!tempSelected.value) return;
  emit('select', tempSelected.value);
  show.value = false;
}

watch(
  () => props.selected,
  value => {
    tempSelected.value = value ? buildMemberSelection(value) : null;
  },
  { immediate: true },
);

watch(show, value => {
  if (value) {
    tempSelected.value = props.selected ? buildMemberSelection(props.selected) : null;
    fetchData().catch(() => {});
  }
});
</script>

<template>
  <EntityPickerModalShell
    v-model:visible="show"
    title="选择会员"
    selected-title="已选会员"
    :confirm-disabled="!tempSelected"
    @confirm="handleConfirm"
  >
    <template #search>
      <NSpace>
        <NInput v-model:value="searchForm.nickname" clearable placeholder="会员昵称" @keyup.enter="handleSearch" />
        <NInput v-model:value="searchForm.mobile" clearable placeholder="手机号" @keyup.enter="handleSearch" />
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
        :row-key="row => row.memberId"
        :row-props="row => ({ onClick: () => handleSelectRow(row), style: row.memberId === tempSelected?.memberId ? 'cursor:pointer;background:rgba(24,160,88,0.08);' : 'cursor:pointer;' })"
        :max-height="430"
        @update:page="handlePageChange"
      />
    </template>

    <template #selected>
      <div v-if="tempSelected" class="flex flex-col gap-3 rounded-12px bg-white p-12px">
        <div class="flex items-center gap-3">
          <NAvatar v-if="tempSelected.avatar" :src="tempSelected.avatar" size="medium" />
          <NAvatar v-else size="medium">{{ tempSelected.displayName.slice(0, 1) }}</NAvatar>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ tempSelected.displayName }}</div>
            <div class="truncate text-xs text-gray-500">{{ tempSelected.mobile || tempSelected.memberId }}</div>
          </div>
        </div>
        <div class="rounded-8px bg-slate-50 p-10px text-sm text-slate-600">
          <div>会员ID：{{ tempSelected.memberId }}</div>
          <div>会员等级：{{ tempSelected.levelName || '-' }}</div>
          <div>手机号：{{ tempSelected.mobile || '-' }}</div>
        </div>
      </div>
      <NEmpty v-else description="请选择会员" class="h-full flex items-center justify-center" />
    </template>
  </EntityPickerModalShell>
</template>
