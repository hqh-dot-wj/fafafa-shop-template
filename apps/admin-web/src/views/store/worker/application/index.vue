<script setup lang="tsx">
import { ref } from 'vue';
import { NButton, NDataTable, NSpace, NTag } from 'naive-ui';
import { fetchGetWorkerApplication, fetchGetWorkerApplicationList } from '@/service/api/store/worker';
import { useAppStore } from '@/store/modules/app';
import { useAuth } from '@/hooks/business/auth';
import { useTable, useTableProps } from '@/hooks/common/table';
import ButtonIcon from '@/components/custom/button-icon.vue';
import { $t } from '@/locales';
import { ApplicationStatusTag } from '../shared/application-status-tag';
import { ApplicationSourceTag } from '../shared/worker-source-tag';
import ApplicationReviewModal from './modules/application-review-modal.vue';
import WorkerApplicationDetailDrawer from './modules/worker-application-detail-drawer.vue';
import WorkerApplicationSearch from './modules/worker-application-search.vue';

defineOptions({
  name: 'StoreWorkerApplication',
});

type WorkerApplicationRow = Api.Store.WorkerApplication & { index: number };

const appStore = useAppStore();
const { hasAuth } = useAuth();
const tableProps = useTableProps();

const detailVisible = ref(false);
const detailData = ref<Api.Store.WorkerApplication | null>(null);
const reviewVisible = ref(false);
const reviewMode = ref<'approve' | 'reject'>('approve');
const reviewRow = ref<Api.Store.WorkerApplication | null>(null);

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
  apiFn: fetchGetWorkerApplicationList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    keyword: undefined,
    phone: undefined,
    applicationStatus: undefined,
    applicationSource: undefined,
  },
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64 },
    { key: 'applicationId', title: '申请编号', align: 'center', width: 110 },
    { key: 'name', title: '申请人姓名', align: 'center', minWidth: 120, ellipsis: true },
    { key: 'phone', title: '手机号', align: 'center', width: 130 },
    { key: 'tenantName', title: '目标租户', align: 'center', minWidth: 160, ellipsis: true },
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
      minWidth: 170,
      render: (row) => renderTags(row.serviceCategoryNames),
    },
    {
      key: 'applicationSource',
      title: '申请来源',
      align: 'center',
      width: 120,
      render: (row) => <ApplicationSourceTag source={row.applicationSource} />,
    },
    {
      key: 'applicationStatus',
      title: '申请状态',
      align: 'center',
      width: 110,
      render: (row) => <ApplicationStatusTag status={row.applicationStatus} />,
    },
    { key: 'createTime', title: '提交时间', align: 'center', width: 170 },
    { key: 'reviewBy', title: '审核人', align: 'center', width: 120, render: (row) => row.reviewBy || '-' },
    { key: 'reviewTime', title: '审核时间', align: 'center', width: 170, render: (row) => row.reviewTime || '-' },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      fixed: 'right',
      width: 190,
      render: (row) => (
        <NSpace justify="center" size={4}>
          <ButtonIcon
            text
            type="primary"
            icon="material-symbols:visibility-outline"
            tooltipContent="详情"
            onClick={() => handleView(row)}
          />
          {row.applicationStatus === 'PENDING' && hasAuth('store:worker:application:review') && (
            <>
              <NButton text type="primary" size="small" onClick={() => openReview(row, 'approve')}>
                通过
              </NButton>
              <NButton text type="error" size="small" onClick={() => openReview(row, 'reject')}>
                拒绝
              </NButton>
            </>
          )}
        </NSpace>
      ),
    },
  ],
});

function renderTags(tags: string[]) {
  if (!tags.length) return '-';
  return (
    <NSpace justify="center" size={4}>
      {tags.slice(0, 3).map((item) => (
        <NTag key={item} type="info">
          {item}
        </NTag>
      ))}
      {tags.length > 3 && <NTag>+{tags.length - 3}</NTag>}
    </NSpace>
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

async function handleView(row: WorkerApplicationRow) {
  const { data: detail } = await fetchGetWorkerApplication(row.applicationId);
  detailData.value = detail || row;
  detailVisible.value = true;
}

function openReview(row: Api.Store.WorkerApplication, mode: 'approve' | 'reject') {
  reviewRow.value = row;
  reviewMode.value = mode;
  reviewVisible.value = true;
}

function openReviewFromDetail(mode: 'approve' | 'reject') {
  if (!detailData.value) return;
  openReview(detailData.value, mode);
}

async function handleReviewSubmitted() {
  await getData();
  if (detailData.value) {
    const { data: detail } = await fetchGetWorkerApplication(detailData.value.applicationId);
    detailData.value = detail || null;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 工作者申请搜索区保留审核状态，用于处理待审核入驻申请。 -->
    <WorkerApplicationSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />

    <!-- 申请列表区只管理申请记录，通过后正式资料进入 worker profile 列表。 -->
    <NCard title="工作者申请列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <TableHeaderOperation
          v-model:columns="columnChecks"
          :loading="loading"
          :show-add="false"
          :show-delete="false"
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
        :row-key="(row: WorkerApplicationRow) => row.applicationId"
        :pagination="mobilePagination"
        :scroll-x="scrollX"
        class="sm:h-full"
      />
    </NCard>

    <WorkerApplicationDetailDrawer
      v-model:visible="detailVisible"
      :data="detailData"
      @approve="openReviewFromDetail('approve')"
      @reject="openReviewFromDetail('reject')"
    />
    <ApplicationReviewModal
      v-model:visible="reviewVisible"
      :mode="reviewMode"
      :row="reviewRow"
      @submitted="handleReviewSubmitted"
    />
  </div>
</template>
