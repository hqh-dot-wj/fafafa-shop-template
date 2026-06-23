<script setup lang="tsx">
import { NButton, NCard, NDataTable } from 'naive-ui';
import { fetchGetCouponUsageRecords } from '@/service/api/marketing/coupon';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { useDownload } from '@/hooks/business/download';
import { $t } from '@/locales';
import CouponUsageSearch from './modules/coupon-usage-search.vue';

defineOptions({
  name: 'CouponUsage',
});

type CouponUsageRow = Api.Marketing.CouponUsageRecord & { index: number };

const appStore = useAppStore();
const { getDownload } = useDownload();

const { columns, data, getData, getDataByPage, loading, searchParams, resetSearchParams, mobilePagination, scrollX } =
  useTable({
    apiFn: fetchGetCouponUsageRecords,
    apiParams: {
      pageNum: 1,
      pageSize: 10,
      memberId: null,
      templateId: null,
      startTime: null,
      endTime: null,
    },
    columns: () => [
      {
        key: 'index',
        title: $t('common.index'),
        align: 'center',
        width: 64,
        render: (row: CouponUsageRow) => row.index,
      },
      { key: 'usedTime', title: '使用时间', align: 'center', width: 170 },
      {
        key: 'member',
        title: '会员',
        align: 'left',
        minWidth: 180,
        render: (row: CouponUsageRow) => {
          const name = row.nickname || row.mobile || '未命名会员';
          const idText = row.mobile ? `${row.mobile} / ${row.memberId}` : row.memberId;
          return (
            <div class="flex flex-col items-start">
              <span class="truncate">{name}</span>
              <span class="font-mono text-xs text-gray-500">{idText}</span>
            </div>
          );
        },
      },
      {
        key: 'template',
        title: '优惠券',
        align: 'left',
        minWidth: 180,
        render: (row: CouponUsageRow) => {
          const name = row.templateName || '未命名模板';
          return (
            <div class="flex flex-col items-start">
              <span class="truncate">{name}</span>
              <span class="font-mono text-xs text-gray-500">{row.templateId}</span>
            </div>
          );
        },
      },
      { key: 'orderId', title: '订单号', align: 'center', minWidth: 180 },
    ],
  });

function buildExportParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const m = searchParams.memberId;
  const t = searchParams.templateId;
  const s = searchParams.startTime;
  const e = searchParams.endTime;
  if (m) params.memberId = String(m);
  if (t) params.templateId = String(t);
  if (s) params.startTime = String(s);
  if (e) params.endTime = String(e);
  return params;
}

function handleExport() {
  getDownload('/admin/marketing/coupon/export', buildExportParams(), `优惠券使用记录_${Date.now()}.xlsx`);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <CouponUsageSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard :title="$t('route.store_distribution_coupon-usage')" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton size="small" @click="handleExport">
          <template #icon>
            <icon-material-symbols-download-rounded class="text-icon" />
          </template>
          {{ $t('common.export') }}
        </NButton>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :flex-height="!appStore.isMobile"
        :loading="loading"
        :pagination="mobilePagination"
        :row-key="(row: CouponUsageRow) => row.id"
        remote
        :scroll-x="scrollX"
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>
