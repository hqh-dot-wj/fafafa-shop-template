<script setup lang="tsx">
import { onMounted, ref } from 'vue';
import { NButton, NTag } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchTenantList } from '@/service/api/auth';
import {
  fetchDeleteCouponTemplate,
  fetchGetCouponTemplateList,
  fetchUpdateCouponTemplateStatus,
} from '@/service/api/marketing/coupon';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ButtonIcon from '@/components/custom/button-icon.vue';
import StatusSwitch from '@/components/custom/status-switch.vue';
import TemplateSearch from './modules/template-search.vue';
import TemplateModal from './modules/template-modal.vue';

defineOptions({
  name: 'CouponTemplateList',
});

// 优惠券模板页对应 TemplateController。状态切换会影响 C 端可领券列表，
// 删除在后端按停用/软删除语义处理，前端不直接操作用户券实例。
function couponTemplateDatePart(value: string | Date | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.split(' ')[0] ?? value;
  if (value instanceof Date) return value.toISOString().split('T')[0] ?? '';
  return String(value);
}

const appStore = useAppStore();
const { bool: visible, setTrue: openModal } = useBoolean();
const operateType = ref<'add' | 'edit'>('add');
const rowData = ref<Api.Marketing.CouponTemplate | null>(null);
const tenantLabelMap = ref<Record<string, string>>({});

const { columns, data, getData, getDataByPage, loading, mobilePagination, searchParams, resetSearchParams } = useTable({
  apiFn: fetchGetCouponTemplateList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    name: null,
    type: null,
    status: null,
  },
  columns: () => [
    {
      key: 'tenantId',
      title: '租户',
      align: 'center',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row) => {
        const tenantId = row.tenantId;
        if (!tenantId) return '-';
        return tenantLabelMap.value[tenantId] || tenantId;
      },
    },
    {
      key: 'name',
      title: '模板名称',
      align: 'center',
      width: 150,
    },
    {
      key: 'type',
      title: '类型',
      align: 'center',
      width: 100,
      render: (row) => {
        const tagType = row.type === 'DISCOUNT' ? 'warning' : 'info';
        const labelMap = {
          DISCOUNT: '代金券',
          PERCENTAGE: '折扣券',
        } as const;
        const label = labelMap[row.type as keyof typeof labelMap] ?? '兑换券';
        return <NTag type={tagType}>{label}</NTag>;
      },
    },
    {
      key: 'value',
      title: '面值',
      align: 'center',
      width: 100,
      render: (row) => {
        const val = row.discountAmount ?? row.discountPercent;
        if (row.type === 'DISCOUNT' && val !== null && val !== undefined) return `¥${val}`;
        if (row.type === 'PERCENTAGE' && val !== null && val !== undefined) return `${val}%`;
        return '-';
      },
    },
    {
      key: 'minOrderAmount',
      title: '门槛',
      align: 'center',
      render: (row) => {
        const min = row.minOrderAmount ?? 0;
        return min > 0 ? `满${min}可用` : '无门槛';
      },
    },
    {
      key: 'count',
      title: '发放/领取/使用',
      align: 'center',
      width: 180,
      render: (row) => (
        <span>
          {row.totalStock === -1 ? '无限' : row.totalStock} / {row.distributedCount ?? 0} / {row.usedCount ?? 0}
        </span>
      ),
    },
    {
      key: 'validity',
      title: '有效期',
      align: 'center',
      minWidth: 260,
      width: 280,
      render: (row) => {
        if (row.validDays) {
          return `领取后 ${row.validDays} 天有效`;
        }
        const start = row.startTime;
        const end = row.endTime;
        if (start && end) {
          const s = couponTemplateDatePart(start);
          const e = couponTemplateDatePart(end);
          return (
            <span class="whitespace-nowrap text-13px">
              {s} ~ {e}
            </span>
          );
        }
        return '-';
      },
    },
    {
      key: 'status',
      title: '状态',
      align: 'center',
      width: 100,
      render: (row) => (
        <StatusSwitch
          value={row.status === 'ACTIVE' ? '0' : '1'}
          onSubmitted={(val, callback) => handleStatusChange(row, val, callback)}
        />
      ),
    },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 120,
      render: (row) => (
        <div class="flex-center gap-8px">
          <ButtonIcon
            type="primary"
            class="text-primary"
            tooltipContent={$t('common.edit')}
            icon="material-symbols:edit-square-outline"
            onClick={() => handleEdit(row)}
          />
          <ButtonIcon
            type="error"
            class="text-error"
            tooltipContent={$t('common.delete')}
            icon="material-symbols:delete-outline"
            onClick={() => handleDelete(row.id)}
          />
        </div>
      ),
    },
  ],
});

async function handleStatusChange(
  row: Api.Marketing.CouponTemplate,
  val: Api.Common.EnableStatus,
  callback: (flag: boolean) => void,
) {
  try {
    // StatusSwitch 使用通用 0/1 值，提交前必须映射成后端券模板枚举状态。
    const status = val === '0' ? 'ACTIVE' : 'INACTIVE';
    await fetchUpdateCouponTemplateStatus(row.id, status);
    window.$message?.success($t('common.updateSuccess'));
    callback(true);
    getData();
  } catch {
    callback(false);
  }
}

function handleEdit(row: Api.Marketing.CouponTemplate & Record<string, unknown>) {
  operateType.value = 'edit';
  rowData.value = row as Api.Marketing.CouponTemplate;
  openModal();
}

async function handleDelete(id: string) {
  window.$dialog?.warning({
    title: $t('common.tip'),
    content: $t('common.confirmDelete'),
    positiveText: $t('common.confirm'),
    negativeText: $t('common.cancel'),
    onPositiveClick: async () => {
      await fetchDeleteCouponTemplate(id);
      window.$message?.success($t('common.deleteSuccess'));
      getData();
    },
  });
}

function handleAdd() {
  operateType.value = 'add';
  rowData.value = null;
  openModal();
}

async function initTenantLabelMap() {
  // 券模板列表展示租户名称，但模板归属和越权校验仍以后端 tenantId 为准。
  const { data: tenantData, error } = await fetchTenantList();
  if (error || !tenantData?.voList) return;
  tenantLabelMap.value = tenantData.voList.reduce<Record<string, string>>((acc, item) => {
    acc[item.tenantId] = `${item.companyName} (${item.tenantId})`;
    return acc;
  }, {});
}

onMounted(() => {
  initTenantLabelMap().catch(() => {});
});
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <!-- 搜索区：按名称、类型和状态筛选券模板。 -->
    <TemplateSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <!-- 券模板表格区：展示库存、领取和状态入口，实例数据不在此处修改。 -->
    <NCard title="优惠券模板列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <template #header-extra>
        <NButton type="primary" ghost size="small" @click="handleAdd">
          <template #icon>
            <icon-ic-round-plus class="text-icon" />
          </template>
          新增模板
        </NButton>
      </template>
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :flex-height="!appStore.isMobile"
        class="sm:h-full"
      />
      <TemplateModal v-model:visible="visible" :operate-type="operateType" :row-data="rowData" @submitted="getData" />
    </NCard>
  </div>
</template>

<style scoped></style>
