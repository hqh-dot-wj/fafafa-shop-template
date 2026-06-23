<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NDataTable, NPopconfirm, NProgress, NSpace, NTag } from 'naive-ui';
import {
  fetchGetWorkerProfile,
  fetchGetWorkerProfileList,
  fetchUpdateWorkerProfileStatus,
} from '@/service/api/store/worker';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableProps } from '@/hooks/common/table';
import ButtonIcon from '@/components/custom/button-icon.vue';
import { $t } from '@/locales';
import { OnlineStatusTag, WorkerStatusTag } from '../shared/worker-status-tag';
import { WorkerSourceTag } from '../shared/worker-source-tag';
import WorkerDetailDrawer from './modules/worker-detail-drawer.vue';
import WorkerProfileOperateDrawer from './modules/worker-profile-operate-drawer.vue';
import WorkerProfileSearch from './modules/worker-profile-search.vue';

defineOptions({
  name: 'StoreWorkerProfile',
});

type WorkerProfileRow = Api.Store.WorkerProfile & { index: number };

const appStore = useAppStore();
const { hasAuth } = useAuth();
const tableProps = useTableProps();

const operateVisible = ref(false);
const operateType = ref<'add' | 'edit'>('add');
const currentRow = ref<Api.Store.WorkerProfile | null>(null);
const detailVisible = ref(false);
const detailData = ref<Api.Store.WorkerProfile | null>(null);

const {
  columns,
  columnChecks,
  data,
  getData,
  getDataByPage,
  loading,
  mobilePagination,
  resetSearchParams,
  searchParams,
  scrollX,
} = useTable({
  apiFn: fetchGetWorkerProfileList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    keyword: undefined,
    phone: undefined,
    status: undefined,
    isOnline: undefined,
    source: undefined,
  },
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64 },
    { key: 'tenantName', title: '所属租户', align: 'center', minWidth: 160, ellipsis: true },
    { key: 'name', title: '工作者姓名', align: 'center', minWidth: 110, ellipsis: true },
    {
      key: 'nickName',
      title: '昵称',
      align: 'center',
      minWidth: 100,
      ellipsis: true,
      render: (row) => row.nickName || '-',
    },
    { key: 'phone', title: '手机号', align: 'center', width: 130 },
    {
      key: 'serviceArea',
      title: '服务地区',
      align: 'center',
      minWidth: 180,
      ellipsis: true,
      render: (row) => formatAddress(row.serviceArea),
    },
    {
      key: 'serviceCategoryNames',
      title: '服务类目',
      align: 'center',
      minWidth: 180,
      render: (row) => renderTags(row.serviceCategoryNames, 'info'),
    },
    {
      key: 'skillTags',
      title: '技能标签',
      align: 'center',
      minWidth: 180,
      render: (row) => renderTags(row.skillTags),
    },
    {
      key: 'status',
      title: '接单状态',
      align: 'center',
      width: 110,
      render: (row) => <WorkerStatusTag status={row.status} />,
    },
    {
      key: 'isOnline',
      title: '在线状态',
      align: 'center',
      width: 100,
      render: (row) => <OnlineStatusTag isOnline={row.isOnline} />,
    },
    {
      key: 'completionScore',
      title: '资料完整度',
      align: 'center',
      width: 130,
      render: (row) => <NProgress type="line" percentage={row.completionScore} indicator-placement="inside" />,
    },
    {
      key: 'source',
      title: '来源',
      align: 'center',
      width: 110,
      render: (row) => <WorkerSourceTag source={row.source} />,
    },
    { key: 'createTime', title: '入驻时间', align: 'center', width: 170 },
    { key: 'updateTime', title: '最近更新时间', align: 'center', width: 170 },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      fixed: 'right',
      width: 210,
      render: (row) => (
        <NSpace justify="center" size={4}>
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:visibility-outline"
            tooltipContent="详情"
            onClick={() => handleView(row)}
          />
          {hasAuth('store:worker:profile:edit') && (
            <ButtonIcon
              text
              type="primary"
              icon="material-symbols:edit-outline"
              tooltipContent="编辑"
              onClick={() => handleEdit(row)}
            />
          )}
          {hasAuth('store:worker:profile:status') && renderStatusActions(row)}
        </NSpace>
      ),
    },
  ],
});

function renderTags(tags: string[], type: 'default' | 'info' = 'default') {
  if (!tags.length) return '-';
  return (
    <NSpace justify="center" size={4}>
      {tags.slice(0, 3).map((item) => (
        <NTag key={item} type={type}>
          {item}
        </NTag>
      ))}
      {tags.length > 3 && <NTag>+{tags.length - 3}</NTag>}
    </NSpace>
  );
}

function renderStatusActions(row: WorkerProfileRow) {
  const disabled = row.status === 'DISABLED';
  return (
    <>
      <NPopconfirm onPositiveClick={() => updateStatus(row, disabled ? 'RESTING' : 'DISABLED', false)}>
        {{
          trigger: () => (
            <NButton text type={disabled ? 'success' : 'error'} size="small">
              {disabled ? '启用' : '停用'}
            </NButton>
          ),
          default: () => (disabled ? '确认启用该工作者资料？' : '确认停用该工作者资料？'),
        }}
      </NPopconfirm>
      {!disabled && (
        <NButton
          text
          size="small"
          type="primary"
          onClick={() => updateStatus(row, row.status === 'WORKING' ? 'RESTING' : 'WORKING', row.status !== 'WORKING')}
        >
          {row.status === 'WORKING' ? '休息' : '接单'}
        </NButton>
      )}
    </>
  );
}

function formatAddress(address?: Api.Store.WorkerAddress) {
  if (!address) return '-';
  return (
    address.formattedAddress ||
    [address.provinceName, address.cityName, address.districtName, address.addressDetail].filter(Boolean).join('') ||
    '-'
  );
}

function handleAdd() {
  operateType.value = 'add';
  currentRow.value = null;
  operateVisible.value = true;
}

function handleEdit(row: WorkerProfileRow) {
  operateType.value = 'edit';
  currentRow.value = row;
  operateVisible.value = true;
}

async function handleView(row: WorkerProfileRow) {
  const { data: detail } = await fetchGetWorkerProfile(row.workerId);
  detailData.value = detail || row;
  detailVisible.value = true;
}

async function updateStatus(
  row: WorkerProfileRow,
  status: Api.Store.UpdateWorkerStatusDto['status'],
  isOnline: boolean,
) {
  await fetchUpdateWorkerProfileStatus(row.workerId, { status, isOnline });
  window.$message?.success('状态已更新');
  getData();
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 工作者资料搜索区，仅筛选正式 worker，不出现审核状态。 -->
    <WorkerProfileSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />

    <!-- 工作者资料列表区承载正式资料管理入口。 -->
    <NCard title="工作者资料列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-delete="false"
          :show-add="hasAuth('store:worker:profile:add')"
          @add="handleAdd"
          @refresh="getData"
        />
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        v-bind="tableProps"
        :flex-height="!appStore.isMobile"
        :loading="loading"
        remote
        :row-key="(row: WorkerProfileRow) => row.workerId"
        :pagination="mobilePagination"
        :scroll-x="scrollX"
        class="sm:h-full"
      />
    </NCard>

    <WorkerProfileOperateDrawer
      v-model:visible="operateVisible"
      :operate-type="operateType"
      :row="currentRow"
      @submitted="getData"
    />
    <WorkerDetailDrawer v-model:visible="detailVisible" :data="detailData" />
  </div>
</template>
