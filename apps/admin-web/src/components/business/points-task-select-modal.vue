<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NSelect, NSpace, NTag } from 'naive-ui';
import { fetchGetPointTaskList } from '@/service/api/marketing/points';
import EntityPickerModalShell from './entity-picker-modal-shell.vue';
import { type PointsTaskPickerSelection, buildPointsTaskSelection } from './entity-picker.shared';

defineOptions({ name: 'PointsTaskSelectModal' });

// 积分任务选择器给营销编排返回 taskId/taskKey 摘要，不触发积分发放。
// 任务是否启用和奖励值最终由编译或后端执行链路确认。
interface Props {
  visible: boolean;
  selected?: Partial<PointsTaskPickerSelection> | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', row: PointsTaskPickerSelection): void;
}

const emit = defineEmits<Emits>();

type EnabledFilter = 'ALL' | 'ENABLED' | 'DISABLED';

const show = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const loading = ref(false);
const tempSelected = ref<PointsTaskPickerSelection | null>(null);
const searchForm = reactive<{ enabledFilter: EnabledFilter }>({
  enabledFilter: 'ALL',
});
const data = ref<Api.Marketing.PointTask[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});

const enabledOptions: NaiveUI.SelectOption[] = [
  { label: '全部状态', value: 'ALL' },
  { label: '启用', value: 'ENABLED' },
  { label: '停用', value: 'DISABLED' },
];

const columns: NaiveUI.TableColumns<Api.Marketing.PointTask> = [
  {
    key: 'taskName',
    title: '任务名称',
    minWidth: 180,
    ellipsis: { tooltip: true },
  },
  {
    key: 'taskKey',
    title: '任务标识',
    width: 180,
    ellipsis: { tooltip: true },
  },
  {
    key: 'pointsReward',
    title: '积分奖励',
    width: 100,
    render: (row) => row.pointsReward ?? '-',
  },
  {
    key: 'isRepeatable',
    title: '可重复',
    width: 90,
    render: (row) => <NTag type={row.isRepeatable ? 'success' : 'default'}>{row.isRepeatable ? '是' : '否'}</NTag>,
  },
  {
    key: 'maxCompletions',
    title: '最多次数',
    width: 100,
    render: (row) => (row.maxCompletions !== null && row.maxCompletions !== undefined ? row.maxCompletions : '不限'),
  },
  {
    key: 'isEnabled',
    title: '状态',
    width: 90,
    render: (row) => <NTag type={row.isEnabled ? 'success' : 'warning'}>{row.isEnabled ? '启用' : '停用'}</NTag>,
  },
  {
    key: 'taskDescription',
    title: '任务描述',
    minWidth: 200,
    ellipsis: { tooltip: true },
    render: (row) => row.taskDescription || '-',
  },
];

function resolveEnabledParam(filter: EnabledFilter) {
  if (filter === 'ENABLED') return true;
  if (filter === 'DISABLED') return false;
  return undefined;
}

function getEnabledLabel(value: boolean | undefined) {
  if (value === true) return '启用';
  if (value === false) return '停用';
  return '-';
}

function getRepeatableLabel(value: boolean | undefined) {
  if (value === true) return '是';
  if (value === false) return '否';
  return '-';
}

async function fetchData() {
  loading.value = true;

  try {
    const { data: response, error } = await fetchGetPointTaskList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      isEnabled: resolveEnabledParam(searchForm.enabledFilter),
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
  searchForm.enabledFilter = 'ALL';
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData().catch(() => {});
}

function handleSelectRow(row: Api.Marketing.PointTask) {
  // 方法职责：通过 shared builder 统一积分任务展示名优先级，避免各业务抽屉重复拼字段。
  tempSelected.value = buildPointsTaskSelection(row);
}

function handleConfirm() {
  if (!tempSelected.value) return;
  emit('select', tempSelected.value);
  show.value = false;
}

watch(
  () => props.selected,
  (value) => {
    tempSelected.value = value ? buildPointsTaskSelection(value) : null;
  },
  { immediate: true },
);

watch(show, (value) => {
  if (value) {
    tempSelected.value = props.selected ? buildPointsTaskSelection(props.selected) : null;
    fetchData().catch(() => {});
  }
});
</script>

<template>
  <!-- 积分任务选择弹窗：按任务状态检索并返回标准化任务摘要给业务抽屉。 -->
  <EntityPickerModalShell
    v-model:visible="show"
    title="选择积分任务"
    selected-title="已选任务"
    :confirm-disabled="!tempSelected"
    @confirm="handleConfirm"
  >
    <template #search>
      <!-- 检索区：只过滤任务启停状态，不在选择器内改变任务配置。 -->
      <NSpace>
        <NSelect
          v-model:value="searchForm.enabledFilter"
          :options="enabledOptions"
          placeholder="任务状态"
          class="w-180px"
        />
        <NButton type="primary" @click="handleSearch">搜索</NButton>
        <NButton @click="handleResetSearch">重置</NButton>
      </NSpace>
    </template>

    <template #table>
      <!-- 结果表格区：单选积分任务并高亮当前临时选择。 -->
      <NDataTable
        remote
        size="small"
        :loading="loading"
        :columns="columns"
        :data="data"
        :pagination="pagination"
        :row-key="(row) => row.id"
        :row-props="
          (row) => ({
            onClick: () => handleSelectRow(row),
            style:
              row.id === tempSelected?.taskId ? 'cursor:pointer;background:rgba(24,160,88,0.08);' : 'cursor:pointer;',
          })
        "
        :max-height="430"
        @update:page="handlePageChange"
      />
    </template>

    <template #selected>
      <!-- 已选摘要区：展示任务标识、奖励和启停信息供提交前确认。 -->
      <div v-if="tempSelected" class="flex flex-col gap-3 rounded-12px bg-white p-12px">
        <div class="min-w-0">
          <div class="truncate font-medium">{{ tempSelected.displayName }}</div>
          <div class="truncate text-xs text-gray-500">{{ tempSelected.taskKey || tempSelected.taskId }}</div>
        </div>
        <div class="rounded-8px bg-slate-50 p-10px text-sm text-slate-600">
          <div>任务ID：{{ tempSelected.taskId }}</div>
          <div>任务标识：{{ tempSelected.taskKey || '-' }}</div>
          <div>积分奖励：{{ tempSelected.pointsReward ?? '-' }}</div>
          <div>可重复：{{ getRepeatableLabel(tempSelected.isRepeatable) }}</div>
          <div>状态：{{ getEnabledLabel(tempSelected.isEnabled) }}</div>
        </div>
      </div>
      <NEmpty v-else description="请选择积分任务" class="h-full flex items-center justify-center" />
    </template>
  </EntityPickerModalShell>
</template>
