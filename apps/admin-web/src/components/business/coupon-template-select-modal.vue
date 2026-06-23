<script setup lang="tsx">
import { computed, reactive, ref, watch } from 'vue';
import { NButton, NDataTable, NEmpty, NInput, NSelect, NSpace, NTag } from 'naive-ui';
import { fetchGetCouponTemplateList } from '@/service/api/marketing/coupon';
import EntityPickerModalShell from './entity-picker-modal-shell.vue';
import { type CouponTemplatePickerSelection, buildCouponTemplateSelection } from './entity-picker.shared';

defineOptions({ name: 'CouponTemplateSelectModal' });

// 营销编排里的券模板选择器只返回 templateId 和展示摘要。
// 券库存、限领、有效期是否仍可用，必须由保存或编译接口重新校验。
interface Props {
  visible: boolean;
  selected?: Partial<CouponTemplatePickerSelection> | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'select', row: CouponTemplatePickerSelection): void;
}

const emit = defineEmits<Emits>();

type CouponType = 'DISCOUNT' | 'PERCENTAGE' | 'EXCHANGE';
type CouponStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED';

interface CouponDisplayLike {
  type?: CouponType | string;
  discountAmount?: number;
  discountPercent?: number;
  minOrderAmount?: number;
  validDays?: number;
  startTime?: string | Date;
  endTime?: string | Date;
}

const show = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const loading = ref(false);
const tempSelected = ref<CouponTemplatePickerSelection | null>(null);
const searchForm = reactive<{
  name: string;
  type: CouponType | null;
  status: CouponStatus | null;
}>({
  name: '',
  type: null,
  status: null,
});
const data = ref<Api.Marketing.CouponTemplate[]>([]);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
});

const typeOptions: NaiveUI.SelectOption[] = [
  { label: '代金券', value: 'DISCOUNT' },
  { label: '折扣券', value: 'PERCENTAGE' },
  { label: '兑换券', value: 'EXCHANGE' },
];

const statusOptions: NaiveUI.SelectOption[] = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'INACTIVE' },
  { label: '已过期', value: 'EXPIRED' },
];

const columns: NaiveUI.TableColumns<Api.Marketing.CouponTemplate> = [
  {
    key: 'name',
    title: '模板名称',
    minWidth: 200,
    ellipsis: { tooltip: true },
  },
  {
    key: 'type',
    title: '类型',
    width: 110,
    render: (row) => {
      const type = row.type;
      const tagType = getCouponTypeTag(type);
      return <NTag type={tagType}>{getCouponTypeLabel(type)}</NTag>;
    },
  },
  {
    key: 'value',
    title: '面值',
    width: 120,
    render: (row) => getCouponValueLabel(row),
  },
  {
    key: 'minOrderAmount',
    title: '使用门槛',
    width: 120,
    render: (row) => getCouponThresholdLabel(row.minOrderAmount),
  },
  {
    key: 'validity',
    title: '有效期',
    minWidth: 220,
    render: (row) => getCouponValidityLabel(row),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => {
      const status = row.status;
      const tagType = getCouponStatusTag(status);
      return <NTag type={tagType}>{getCouponStatusLabel(status)}</NTag>;
    },
  },
];

function getCouponTypeLabel(type: CouponType | string | undefined) {
  if (type === 'DISCOUNT') return '代金券';
  if (type === 'PERCENTAGE') return '折扣券';
  if (type === 'EXCHANGE') return '兑换券';
  return '-';
}

function getCouponTypeTag(type: CouponType | string | undefined): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (type === 'DISCOUNT') return 'warning';
  if (type === 'PERCENTAGE') return 'success';
  return 'info';
}

function getCouponStatusLabel(status: CouponStatus | string | undefined) {
  if (status === 'ACTIVE') return '启用';
  if (status === 'INACTIVE') return '停用';
  if (status === 'EXPIRED') return '已过期';
  return '-';
}

function getCouponStatusTag(
  status: CouponStatus | string | undefined,
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'INACTIVE') return 'warning';
  return 'default';
}

function getCouponValueLabel(coupon: CouponDisplayLike) {
  if (coupon.type === 'DISCOUNT' && typeof coupon.discountAmount === 'number') {
    return `¥${coupon.discountAmount}`;
  }
  if (coupon.type === 'PERCENTAGE' && typeof coupon.discountPercent === 'number') {
    return `${coupon.discountPercent}%`;
  }
  return '-';
}

function getCouponThresholdLabel(minOrderAmount: number | undefined) {
  if (typeof minOrderAmount !== 'number' || minOrderAmount <= 0) {
    return '无门槛';
  }
  return `满${minOrderAmount}可用`;
}

function formatDateText(value: string | Date | undefined) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.split(' ')[0] ?? value;
  if (value instanceof Date) return value.toISOString().split('T')[0] ?? '';
  return String(value);
}

function getCouponValidityLabel(coupon: CouponDisplayLike) {
  if (typeof coupon.validDays === 'number' && coupon.validDays > 0) {
    return `领取后 ${coupon.validDays} 天有效`;
  }

  const start = formatDateText(coupon.startTime);
  const end = formatDateText(coupon.endTime);
  if (start && end) {
    return `${start} ~ ${end}`;
  }

  return '-';
}

async function fetchData() {
  loading.value = true;

  try {
    const { data: response, error } = await fetchGetCouponTemplateList({
      pageNum: pagination.page,
      pageSize: pagination.pageSize,
      name: searchForm.name || undefined,
      type: searchForm.type || undefined,
      status: searchForm.status || undefined,
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
  searchForm.name = '';
  searchForm.type = null;
  searchForm.status = null;
  handleSearch();
}

function handlePageChange(page: number) {
  pagination.page = page;
  fetchData().catch(() => {});
}

function handleSelectRow(row: Api.Marketing.CouponTemplate) {
  // 选择结果使用 shared builder，保证权益池、活动配置等页面拿到同一套字段别名。
  tempSelected.value = buildCouponTemplateSelection(row);
}

function handleConfirm() {
  if (!tempSelected.value) return;
  emit('select', tempSelected.value);
  show.value = false;
}

watch(
  () => props.selected,
  (value) => {
    tempSelected.value = value ? buildCouponTemplateSelection(value) : null;
  },
  { immediate: true },
);

watch(show, (value) => {
  if (value) {
    tempSelected.value = props.selected ? buildCouponTemplateSelection(props.selected) : null;
    fetchData().catch(() => {});
  }
});
</script>

<template>
  <EntityPickerModalShell
    v-model:visible="show"
    title="选择优惠券模板"
    selected-title="已选模板"
    :confirm-disabled="!tempSelected"
    @confirm="handleConfirm"
  >
    <template #search>
      <NSpace>
        <NInput v-model:value="searchForm.name" clearable placeholder="模板名称" @keyup.enter="handleSearch" />
        <NSelect
          v-model:value="searchForm.type"
          clearable
          :options="typeOptions"
          placeholder="优惠券类型"
          class="w-180px"
        />
        <NSelect
          v-model:value="searchForm.status"
          clearable
          :options="statusOptions"
          placeholder="状态"
          class="w-140px"
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
        :row-key="(row) => row.id"
        :row-props="
          (row) => ({
            onClick: () => handleSelectRow(row),
            style:
              row.id === tempSelected?.templateId
                ? 'cursor:pointer;background:rgba(24,160,88,0.08);'
                : 'cursor:pointer;',
          })
        "
        :max-height="430"
        @update:page="handlePageChange"
      />
    </template>

    <template #selected>
      <div v-if="tempSelected" class="flex flex-col gap-3 rounded-12px bg-white p-12px">
        <div class="min-w-0">
          <div class="truncate font-medium">{{ tempSelected.displayName }}</div>
          <div class="truncate text-xs text-gray-500">{{ tempSelected.templateId }}</div>
        </div>
        <div class="rounded-8px bg-slate-50 p-10px text-sm text-slate-600">
          <div>模板ID：{{ tempSelected.templateId }}</div>
          <div>类型：{{ getCouponTypeLabel(tempSelected.type) }}</div>
          <div>面值：{{ getCouponValueLabel(tempSelected) }}</div>
          <div>门槛：{{ getCouponThresholdLabel(tempSelected.minOrderAmount) }}</div>
          <div>有效期：{{ getCouponValidityLabel(tempSelected) }}</div>
        </div>
      </div>
      <NEmpty v-else description="请选择优惠券模板" class="h-full flex items-center justify-center" />
    </template>
  </EntityPickerModalShell>
</template>
