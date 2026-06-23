<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import AuditStatusTag from '@/components/custom/audit-status-tag.vue';
import { getRoutePath } from '@/router/elegant/transform';

interface Props {
  list?: Api.Finance.WithdrawalRecord[];
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  list: undefined,
  loading: false,
});

const router = useRouter();

const columns = computed<DataTableColumns<Api.Finance.WithdrawalRecord>>(() => [
  {
    key: 'member',
    title: '申请人',
    minWidth: 140,
    render: (row) => row.memberName || row.memberId,
  },
  {
    key: 'amount',
    title: '金额',
    width: 100,
    render: (row) => h('span', { class: 'text-error font-medium' }, `¥${row.amount}`),
  },
  {
    key: 'status',
    title: '状态',
    width: 100,
    render: (row) => h(AuditStatusTag, { status: row.status }),
  },
  {
    key: 'createTime',
    title: '申请时间',
    minWidth: 160,
  },
  {
    key: 'actions',
    title: '操作',
    width: 100,
    render: () =>
      h(
        NButton,
        {
          size: 'small',
          type: 'primary',
          quaternary: true,
          onClick: () => router.push({ path: getRoutePath('store_finance_withdrawal') }),
        },
        () => '去审核',
      ),
  },
]);

const tableData = computed(() => props.list ?? []);
</script>

<template>
  <NCard :bordered="false" size="small" class="h-full card-wrapper">
    <template #header>
      <div class="flex items-center justify-between">
        <span class="font-semibold">最近提现申请</span>
        <NButton text type="primary" @click="router.push({ path: getRoutePath('store_finance_withdrawal') })">
          全部提现
        </NButton>
      </div>
    </template>
    <NSpin :show="loading">
      <NDataTable :columns="columns" :data="tableData" :bordered="false" size="small" :single-line="false" />
    </NSpin>
  </NCard>
</template>

<style scoped>
.card-wrapper {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
</style>
