<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import {
  type DataTableColumns,
  NCard,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpin,
  NTag,
} from 'naive-ui';
import { fetchCommissionAudit } from '@/service/api/marketing/resolution';
import { fetchGetOrderDetail } from '@/service/api/store/order';
import { $t } from '@/locales';

defineOptions({ name: 'CommissionAudit' });

const route = useRoute();

const orderId = ref('');
const orderItemId = ref<number | null>(null);
const orderItemOptions = ref<{ label: string; value: number }[]>([]);
const loading = ref(false);
const records = ref<Api.Marketing.CommissionAuditRecord[]>([]);

const showItemSelect = computed(() => orderItemOptions.value.length > 1);

const commissionStatusMap = computed<Record<string, { label: string; type: 'warning' | 'success' | 'error' }>>(() => ({
  FROZEN: { label: $t('page.store_commission_audit.status.FROZEN'), type: 'warning' },
  SETTLED: { label: $t('page.store_commission_audit.status.SETTLED'), type: 'success' },
  CANCELLED: { label: $t('page.store_commission_audit.status.CANCELLED'), type: 'error' },
}));

const columns = computed<DataTableColumns<Api.Marketing.CommissionAuditRecord>>(() => [
  {
    key: 'id',
    title: $t('page.store_commission_audit.columnId'),
    align: 'center',
    width: 80,
    ellipsis: { tooltip: true },
  },
  { key: 'level', title: $t('page.store_commission_audit.columnLevel'), align: 'center', width: 90 },
  {
    key: 'beneficiaryId',
    title: $t('page.store_commission_audit.columnBeneficiaryId'),
    align: 'center',
    ellipsis: { tooltip: true },
  },
  {
    key: 'amount',
    title: $t('page.store_commission_audit.columnAmount'),
    align: 'center',
    width: 110,
    render: (row) => <span class="text-success font-bold">¥{row.amount.toFixed(2)}</span>,
  },
  {
    key: 'rateSnapshot',
    title: $t('page.store_commission_audit.columnRateSnapshot'),
    align: 'center',
    width: 100,
    render: (row) => `${row.rateSnapshot}%`,
  },
  {
    key: 'status',
    title: $t('page.store_commission_audit.columnStatus'),
    align: 'center',
    width: 100,
    render: (row) => {
      const s = commissionStatusMap.value[row.status];
      return s ? (
        <NTag type={s.type} size="small">
          {s.label}
        </NTag>
      ) : (
        <span>{row.status}</span>
      );
    },
  },
  {
    key: 'explanation',
    title: $t('page.store_commission_audit.columnExplanation'),
    align: 'left',
    minWidth: 250,
    ellipsis: { tooltip: true },
  },
  {
    key: 'createTime',
    title: $t('page.store_commission_audit.columnCreateTime'),
    align: 'center',
    width: 170,
  },
]);

async function handleSearch() {
  if (!orderId.value) {
    window.$message?.warning($t('page.store_commission_audit.msgOrderIdRequired'));
    return;
  }
  if (orderItemId.value === null || orderItemId.value <= 0) {
    window.$message?.warning($t('page.store_commission_audit.msgOrderItemInvalid'));
    return;
  }
  loading.value = true;
  try {
    const { data } = await fetchCommissionAudit(orderId.value, orderItemId.value);
    records.value = data ?? [];
  } catch {
    records.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadOrderItemsForOrder(oid: string, preferredItemId?: number | null) {
  try {
    const { data } = await fetchGetOrderDetail(oid);
    const items = data?.order?.items ?? [];
    orderItemOptions.value = items.map((it) => ({
      label: $t('page.store_commission_audit.orderItemOptionLabel', {
        product: it.productName,
        id: String(it.id),
      }),
      value: Number(it.id),
    }));
    if (items.length === 0) {
      orderItemId.value = null;
      window.$message?.warning($t('page.store_commission_audit.msgNoItems'));
      records.value = [];
      return;
    }
    if (preferredItemId && items.some((it) => Number(it.id) === preferredItemId)) {
      orderItemId.value = preferredItemId;
    } else {
      orderItemId.value = Number(items[0].id);
    }
  } catch {
    orderItemOptions.value = [];
    orderItemId.value = null;
  }
}

/** 从路由 query 带入订单 ID；若无 orderItemId 则拉订单明细解析行 ID */
async function hydrateFromRouteQuery() {
  const oid = (route.query.orderId as string) || '';
  const rawItem = route.query.orderItemId;
  const parsedItem =
    rawItem === undefined || rawItem === null || rawItem === ''
      ? null
      : Number(Array.isArray(rawItem) ? rawItem[0] : rawItem);

  if (!oid) {
    orderItemOptions.value = [];
    return;
  }

  orderId.value = oid;

  if (parsedItem !== null && !Number.isNaN(parsedItem) && parsedItem > 0) {
    orderItemId.value = parsedItem;
    orderItemOptions.value = [];
    await handleSearch();
    return;
  }

  await loadOrderItemsForOrder(oid, null);
  await handleSearch();
}

watch(
  () => [route.query.orderId, route.query.orderItemId] as const,
  () => {
    hydrateFromRouteQuery().catch(() => {});
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex-col-stretch gap-16px">
    <NCard :title="$t('page.store_commission_audit.cardSearchTitle')" :bordered="false">
      <NForm label-placement="left" label-width="100" inline>
        <NFormItem :label="$t('page.store_commission_audit.orderId')">
          <NInput
            v-model:value="orderId"
            :placeholder="$t('page.store_commission_audit.placeholderOrderId')"
            class="w-260px"
            readonly
          />
        </NFormItem>
        <NFormItem v-if="showItemSelect" :label="$t('page.store_commission_audit.orderItemSelect')">
          <NSelect
            v-model:value="orderItemId"
            :options="orderItemOptions"
            :placeholder="$t('page.store_commission_audit.placeholderSelectLine')"
            class="min-w-280px"
            @update:value="handleSearch"
          />
        </NFormItem>
        <NFormItem v-else :label="$t('page.store_commission_audit.orderItemId')">
          <NInput :value="orderItemId ? String(orderItemId) : ''" readonly class="w-180px" />
        </NFormItem>
      </NForm>
    </NCard>

    <NCard :title="$t('page.store_commission_audit.cardRecordsTitle')" :bordered="false">
      <NSpin :show="loading">
        <NDataTable v-if="records.length > 0" :columns="columns" :data="records" :bordered="false" size="small" />
        <NEmpty v-else :description="$t('page.store_commission_audit.emptyHint')" />
      </NSpin>
    </NCard>
  </div>
</template>

<style scoped>
.text-success {
  color: #18a058;
}
</style>
