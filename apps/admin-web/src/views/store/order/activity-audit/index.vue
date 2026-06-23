<script setup lang="tsx">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  type DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NSpin,
  NTag,
  NTimeline,
  NTimelineItem,
} from 'naive-ui';
import { fetchOrderActivityAudit } from '@/service/api/marketing/resolution';
import { $t } from '@/locales';

defineOptions({ name: 'OrderActivityAudit' });

/** 将后端 activity-audit 载荷转为页面使用的结构（resolutionAudits → auditRecords，行 id → orderItemId） */
function normalizeOrderActivityAudit(
  payload: Api.Marketing.OrderActivityAuditPayload,
): Api.Marketing.OrderActivityAudit {
  const items = (payload.items ?? []).map((it) => {
    const snap: Record<string, unknown> = {};
    if (it.resolutionSnapshot !== null && it.resolutionSnapshot !== undefined)
      snap.resolutionSnapshot = it.resolutionSnapshot;
    if (it.activityNameSnapshot !== null && it.activityNameSnapshot !== undefined)
      snap.activityNameSnapshot = it.activityNameSnapshot;
    if (it.activityPriceSnapshot !== null && it.activityPriceSnapshot !== undefined)
      snap.activityPriceSnapshot = it.activityPriceSnapshot;
    if (it.activityContextKey !== null && it.activityContextKey !== undefined)
      snap.activityContextKey = it.activityContextKey;
    const activitySnapshot = Object.keys(snap).length > 0 ? snap : undefined;

    return {
      orderItemId: it.id,
      productId: it.skuId ?? '-',
      productName: it.productName,
      activityType: it.activityType ?? undefined,
      activityConfigId: it.activityConfigId ?? undefined,
      activitySnapshot,
      commissionMode: it.activityCommissionModeSnapshot ?? undefined,
      commissionRate: it.activityCommissionRateSnapshot ?? undefined,
    };
  });

  const rawAudits = payload.resolutionAudits ?? payload.auditRecords ?? [];
  const auditRecords: Api.Marketing.OrderActivityAuditRecord[] = rawAudits.map((row) => {
    if ('timestamp' in row && 'action' in row && 'detail' in row) {
      return row as Api.Marketing.OrderActivityAuditRecord;
    }
    const r = row as Api.Marketing.OrderActivityAuditResolutionRow;
    const detailObj = {
      selectedActivityType: r.selectedActivityType,
      selectedConfigId: r.selectedConfigId,
      candidateSnapshot: r.candidateSnapshot,
      filteredSnapshot: r.filteredSnapshot,
    };
    let detail: string;
    try {
      detail = JSON.stringify(detailObj);
    } catch {
      detail = String(r.id);
    }
    return {
      timestamp: r.createTime,
      action: r.scene,
      detail,
    };
  });

  return {
    orderId: payload.orderId,
    orderSn: payload.orderSn,
    items,
    auditRecords,
  };
}

const route = useRoute();
const router = useRouter();

const orderIdFromQuery = computed(() => (route.query.orderId as string) || '');
const orderIdInput = ref('');
const loading = ref(false);
const auditData = ref<Api.Marketing.OrderActivityAudit | null>(null);

const itemColumns = computed<DataTableColumns<Api.Marketing.OrderActivityAuditItem>>(() => [
  {
    key: 'orderItemId',
    title: $t('page.store_order_activity_audit.columnOrderItemId'),
    align: 'center',
    width: 100,
  },
  { key: 'productId', title: $t('page.store_order_activity_audit.columnProductId'), align: 'center' },
  { key: 'productName', title: $t('page.store_order_activity_audit.columnProductName'), align: 'center' },
  {
    key: 'activityType',
    title: $t('page.store_order_activity_audit.columnActivityType'),
    align: 'center',
    render: (row) =>
      row.activityType ? <NTag type="info">{row.activityType}</NTag> : <span class="text-gray-400">-</span>,
  },
  {
    key: 'activityConfigId',
    title: $t('page.store_order_activity_audit.columnActivityConfigId'),
    align: 'center',
  },
  {
    key: 'commissionMode',
    title: $t('page.store_order_activity_audit.columnCommissionMode'),
    align: 'center',
    render: (row) =>
      row.commissionMode ? (
        <NTag type="success" size="small">
          {row.commissionMode}
        </NTag>
      ) : (
        <span>-</span>
      ),
  },
  {
    key: 'commissionRate',
    title: $t('page.store_order_activity_audit.columnCommissionRate'),
    align: 'center',
    render: (row) => (row.commissionRate !== undefined ? `${row.commissionRate}%` : '-'),
  },
  {
    key: 'activitySnapshot',
    title: $t('page.store_order_activity_audit.columnSnapshot'),
    align: 'center',
    width: 200,
    ellipsis: { tooltip: true },
    render: (row) => (row.activitySnapshot ? JSON.stringify(row.activitySnapshot) : '-'),
  },
]);

async function loadAudit(orderId: string) {
  if (!orderId) {
    window.$message?.warning($t('page.store_order_activity_audit.msgOrderIdRequired'));
    return;
  }
  loading.value = true;
  try {
    const { data } = await fetchOrderActivityAudit(orderId);
    auditData.value = normalizeOrderActivityAudit(data);
  } catch {
    auditData.value = null;
  } finally {
    loading.value = false;
  }
}

function handleBack() {
  router.back();
}

function syncFromRouteQuery() {
  const q = orderIdFromQuery.value;
  if (q) {
    orderIdInput.value = q;
    loadAudit(q);
  }
}

onMounted(syncFromRouteQuery);

watch(orderIdFromQuery, (id) => {
  if (id) {
    orderIdInput.value = id;
    loadAudit(id);
  }
});
</script>

<template>
  <div class="flex-col-stretch gap-16px">
    <div class="flex items-center gap-8px">
      <NButton text @click="handleBack">
        <template #icon>
          <icon-carbon-arrow-left />
        </template>
        {{ $t('page.store_order_activity_audit.back') }}
      </NButton>
    </div>

    <NCard :title="$t('page.store_order_activity_audit.cardTitle')" :bordered="false">
      <NForm :model="{ orderId: orderIdInput }" label-placement="left" label-width="80" inline>
        <NFormItem :label="$t('page.store_order_activity_audit.orderId')">
          <NInput
            v-model:value="orderIdInput"
            :placeholder="$t('page.store_order_activity_audit.placeholderOrderId')"
            class="w-300px"
            readonly
          />
        </NFormItem>
      </NForm>
    </NCard>

    <NSpin :show="loading">
      <template v-if="auditData">
        <div class="flex-col-stretch gap-16px">
          <NCard :bordered="false" size="small">
            <NDescriptions :column="1" label-placement="left">
              <NDescriptionsItem :label="$t('page.store_order_activity_audit.descOrderId')">
                {{ auditData.orderId }}
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>

          <NCard :title="$t('page.store_order_activity_audit.cardItemsTitle')" :bordered="false" size="small">
            <NDataTable
              v-if="auditData.items.length > 0"
              :columns="itemColumns"
              :data="auditData.items"
              :bordered="false"
              size="small"
            />
            <NEmpty v-else :description="$t('page.store_order_activity_audit.emptyNoItems')" />
          </NCard>

          <NCard :title="$t('page.store_order_activity_audit.cardAuditTitle')" :bordered="false" size="small">
            <NTimeline v-if="(auditData.auditRecords ?? []).length > 0">
              <NTimelineItem
                v-for="(record, idx) in auditData.auditRecords ?? []"
                :key="idx"
                :title="record.action"
                :content="record.detail"
                :time="record.timestamp"
                type="info"
              />
            </NTimeline>
            <NEmpty v-else :description="$t('page.store_order_activity_audit.emptyNoRecords')" />
          </NCard>
        </div>
      </template>

      <template v-else-if="!loading">
        <NEmpty :description="$t('page.store_order_activity_audit.emptyPrompt')" class="py-40px" />
      </template>
    </NSpin>
  </div>
</template>
