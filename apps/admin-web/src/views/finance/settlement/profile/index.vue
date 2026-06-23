<script setup lang="tsx">
import { reactive, ref } from 'vue';
import { NButton, NForm, NFormItem, NFormItemGi, NGrid, NInput, NModal, NSpace, NSelect, NSwitch, NTag } from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchGetTenantList } from '@/service/api/system/tenant';
import { fetchGetTenantSettlementProfile, fetchSaveTenantSettlementProfile } from '@/service/api/finance-center';
import { useAppStore } from '@/store/modules/app';
import { useTable, useTableProps } from '@/hooks/common/table';
import FinanceSearchCard from '../../shared/finance-search-card.vue';
import {
  financeChannelOptions,
  financeProfileStatusOptions,
  financeReceiverTypeOptions,
  getFinanceChannelLabel,
  getFinanceProfileStatusLabel,
  getFinanceReceiverTypeLabel,
} from '../../shared/finance-display';

defineOptions({
  name: 'FinanceSettlementProfile',
});

const appStore = useAppStore();
const tableProps = useTableProps();
const { bool: modalVisible, setTrue: openModal, setFalse: closeModal } = useBoolean(false);

const currentTenant = ref<Api.FinanceCenter.SettlementProfileRow | null>(null);
const saving = ref(false);

const statusTagMap: Record<Api.FinanceCenter.SettlementProfileStatus, NaiveUI.ThemeColor> = {
  DRAFT: 'warning',
  ACTIVE: 'success',
  DISABLED: 'default',
};

const formModel = reactive<Api.FinanceCenter.SaveSettlementProfilePayload>({
  enabled: false,
  defaultChannel: 'OFFLINE_TRANSFER',
  receiverType: 'TENANT',
  receiverAccount: '',
  receiverName: '',
  bankName: '',
  bankAccountNo: '',
  needManualReview: true,
  status: 'DRAFT',
  remark: '',
});

const {
  columns,
  columnChecks,
  data,
  loading,
  mobilePagination,
  searchParams,
  getData,
  getDataByPage,
  resetSearchParams,
} = useTable({
  apiFn: fetchGetTenantList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    tenantId: null,
    contactUserName: null,
    contactPhone: null,
    companyName: null,
  },
  columns: () => [
    {
      key: 'tenantId',
      title: '租户编号',
      width: 110,
      align: 'center',
    },
    {
      key: 'companyName',
      title: '租户名称',
      minWidth: 200,
      ellipsis: { tooltip: true },
    },
    {
      key: 'contactUserName',
      title: '联系人',
      width: 120,
      align: 'center',
      render: (row: Api.FinanceCenter.SettlementProfileRow) => row.contactUserName || '-',
    },
    {
      key: 'settlementEnabled',
      title: '已启用',
      align: 'center',
      width: 90,
      render: (row: Api.FinanceCenter.SettlementProfileRow) => (
        <NTag type={row.settlementEnabled ? 'success' : 'default'}>{row.settlementEnabled ? '是' : '否'}</NTag>
      ),
    },
    {
      key: 'settlementChannel',
      title: '默认结算方式',
      align: 'center',
      width: 140,
      render: (row: Api.FinanceCenter.SettlementProfileRow) => getFinanceChannelLabel(row.settlementChannel),
    },
    {
      key: 'settlementReceiverName',
      title: '收款方名称',
      minWidth: 180,
      ellipsis: { tooltip: true },
      render: (row: Api.FinanceCenter.SettlementProfileRow) => row.settlementReceiverName || row.companyName || '-',
    },
    {
      key: 'settlementReceiverType',
      title: '收款方类型',
      align: 'center',
      width: 120,
      render: (row: Api.FinanceCenter.SettlementProfileRow) => getFinanceReceiverTypeLabel(row.settlementReceiverType),
    },
    {
      key: 'settlementStatus',
      title: '配置状态',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementProfileRow) =>
        row.settlementStatus ? (
          <NTag type={statusTagMap[row.settlementStatus] ?? 'default'}>
            {getFinanceProfileStatusLabel(row.settlementStatus)}
          </NTag>
        ) : (
          '-'
        ),
    },
    {
      key: 'operate',
      title: '操作',
      align: 'center',
      width: 110,
      render: (row: Api.FinanceCenter.SettlementProfileRow) => (
        <NButton type="primary" text onClick={() => handleEdit(row)}>
          设置
        </NButton>
      ),
    },
  ],
});

async function handleEdit(row: Api.FinanceCenter.SettlementProfileRow) {
  currentTenant.value = row;
  const { data: profile } = await fetchGetTenantSettlementProfile(row.tenantId);

  Object.assign(formModel, {
    enabled: profile?.enabled ?? false,
    defaultChannel: profile?.defaultChannel ?? 'OFFLINE_TRANSFER',
    receiverType: profile?.receiverType ?? 'TENANT',
    receiverAccount: profile?.receiverAccount ?? '',
    receiverName: profile?.receiverName ?? '',
    bankName: profile?.bankName ?? '',
    bankAccountNo: profile?.bankAccountNo ?? '',
    needManualReview: profile?.needManualReview ?? true,
    status: profile?.status ?? 'DRAFT',
    remark: profile?.remark ?? '',
  });

  openModal();
}

async function handleSubmit() {
  if (!currentTenant.value) return;

  saving.value = true;
  try {
    await fetchSaveTenantSettlementProfile(currentTenant.value.tenantId, formModel);
    window.$message?.success('租户收款设置已保存');
    closeModal();
    await getData();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <FinanceSearchCard collapse-name="settlement-profile-search">
      <NForm :model="searchParams" label-placement="left" :label-width="92">
        <NGrid responsive="screen" item-responsive :x-gap="16">
          <NFormItemGi span="24 s:12 m:8 l:6" label="租户编号" path="tenantId">
            <NInput v-model:value="searchParams.tenantId" placeholder="请输入租户编号" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="租户名称" path="companyName">
            <NInput v-model:value="searchParams.companyName" placeholder="请输入租户名称" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="联系人" path="contactUserName">
            <NInput v-model:value="searchParams.contactUserName" placeholder="请输入联系人" clearable />
          </NFormItemGi>
          <NFormItemGi span="24 s:12 m:8 l:6" label="联系电话" path="contactPhone">
            <NInput v-model:value="searchParams.contactPhone" placeholder="请输入联系电话" clearable />
          </NFormItemGi>
          <NFormItemGi span="24">
            <NSpace class="w-full" justify="end">
              <NButton @click="resetSearchParams">重置</NButton>
              <NButton type="primary" ghost @click="getDataByPage">查询</NButton>
            </NSpace>
          </NFormItemGi>
        </NGrid>
      </NForm>
    </FinanceSearchCard>

    <NCard title="租户收款设置" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
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
        :pagination="mobilePagination"
        :row-key="row => row.id"
        remote
        class="sm:h-full"
      />
    </NCard>

    <NModal v-model:show="modalVisible" preset="card" title="设置租户收款方式" class="w-720px max-w-96%">
      <NForm :model="formModel" label-placement="left" label-width="110">
        <NFormItem label="启用收款">
          <NSwitch v-model:value="formModel.enabled" />
        </NFormItem>
        <NFormItem label="默认结算方式">
          <NSelect v-model:value="formModel.defaultChannel" :options="financeChannelOptions" />
        </NFormItem>
        <NFormItem label="收款方类型">
          <NSelect v-model:value="formModel.receiverType" :options="financeReceiverTypeOptions" />
        </NFormItem>
        <NFormItem label="收款账号">
          <NInput v-model:value="formModel.receiverAccount" placeholder="请输入商户号、银行卡号或内部账号" />
        </NFormItem>
        <NFormItem label="收款方名称">
          <NInput v-model:value="formModel.receiverName" placeholder="请输入收款方名称" />
        </NFormItem>
        <NFormItem label="开户银行">
          <NInput v-model:value="formModel.bankName" placeholder="银行卡结算时填写" />
        </NFormItem>
        <NFormItem label="银行卡号">
          <NInput v-model:value="formModel.bankAccountNo" placeholder="银行卡结算时填写" />
        </NFormItem>
        <NFormItem label="人工审核">
          <NSwitch v-model:value="formModel.needManualReview" />
        </NFormItem>
        <NFormItem label="配置状态">
          <NSelect v-model:value="formModel.status" :options="financeProfileStatusOptions" />
        </NFormItem>
        <NFormItem label="备注说明">
          <NInput v-model:value="formModel.remark" type="textarea" :rows="3" placeholder="请输入特殊说明或结算要求" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="closeModal">取消</NButton>
          <NButton type="primary" :loading="saving" @click="handleSubmit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
