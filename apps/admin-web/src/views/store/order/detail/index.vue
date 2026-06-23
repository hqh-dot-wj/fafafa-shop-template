<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NAvatar,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NInput,
  NInputNumber,
  NModal,
  NSpace,
  NSpin,
  NTable,
  NTag,
  NText,
  NTimeline,
  NTimelineItem,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import {
  fetchGetOrderDetail,
  fetchGetOrderOperationLogs,
  fetchPartialRefundOrder,
  fetchRefundOrder,
} from '@/service/api/store/order';
import { fetchAssignServiceFulfillment, fetchVerifyServiceFulfillment } from '@/service/api/store/fulfillment';
import { getAppErrorMessage, reportActionError, safeIgnoreActionError } from '@/service/request/error-monitoring';
import { useAuth } from '@/hooks/business/auth';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import { getRoutePath } from '@/router/elegant/transform';
import DispatchWorkerPicker from '../../fulfillment/modules/dispatch-worker-picker.vue';

defineOptions({
  name: 'OrderDetail',
});

const route = useRoute();
const router = useRouter();
const { hasAuth } = useAuth();
const orderId = computed(() => route.query.id as string);

const orderStatusRecord = computed<Record<string, { label: string; type: NaiveUI.ThemeColor }>>(() => ({
  PENDING_PAY: { label: $t('page.store_order_detail.orderStatus.PENDING_PAY'), type: 'warning' },
  PAID: { label: $t('page.store_order_detail.orderStatus.PAID'), type: 'info' },
  PENDING_SERVICE: { label: $t('page.store_order_detail.orderStatus.PENDING_SERVICE'), type: 'primary' },
  PENDING_DELIVERY: { label: $t('page.store_order_detail.orderStatus.PENDING_DELIVERY'), type: 'primary' },
  SHIPPED: { label: $t('page.store_order_detail.orderStatus.SHIPPED'), type: 'primary' },
  COMPLETED: { label: $t('page.store_order_detail.orderStatus.COMPLETED'), type: 'success' },
  CANCELLED: { label: $t('page.store_order_detail.orderStatus.CANCELLED'), type: 'default' },
  REFUNDED: { label: $t('page.store_order_detail.orderStatus.REFUNDED'), type: 'error' },
}));

const commissionStatusRecord = computed<Record<string, { label: string; type: NaiveUI.ThemeColor }>>(() => ({
  FROZEN: { label: $t('page.store_order_detail.commissionStatus.FROZEN'), type: 'warning' },
  SETTLED: { label: $t('page.store_order_detail.commissionStatus.SETTLED'), type: 'success' },
  CANCELLED: { label: $t('page.store_order_detail.commissionStatus.CANCELLED'), type: 'error' },
}));

// 数据状态
const loading = ref(true);
const orderData = ref<Api.Order.DetailResult | null>(null);

// 操作弹窗
const { bool: verifyModalVisible, setTrue: openVerifyModal, setFalse: closeVerifyModal } = useBoolean(false);
const { bool: refundModalVisible, setTrue: openRefundModal, setFalse: closeRefundModal } = useBoolean(false);
const {
  bool: partialRefundModalVisible,
  setTrue: openPartialRefundModal,
  setFalse: closePartialRefundModal,
} = useBoolean(false);
const { bool: reassignModalVisible, setTrue: openReassignModal, setFalse: closeReassignModal } = useBoolean(false);
const actionRemark = ref('');
const actionLoading = ref(false);
const newWorkerId = ref<number | null>(null);
// 部分退款：每项 { itemId, quantity }
const partialRefundItems = ref<Array<{ itemId: number; quantity: number; maxQty: number; productName: string }>>([]);

// 是否可核销：服务类订单且状态为 SHIPPED
const canVerify = computed(
  () =>
    orderData.value?.order?.orderType === 'SERVICE' &&
    orderData.value?.order?.status === 'SHIPPED' &&
    hasAuth('store:order:verify'),
);

// 是否可退款：非待支付/已取消/已退款
const canRefund = computed(() => {
  const status = orderData.value?.order?.status;
  const invalid = ['PENDING_PAY', 'CANCELLED', 'REFUNDED'];
  return status && !invalid.includes(status) && hasAuth('store:order:refund');
});

// 是否可改派：服务类订单且状态为 PAID 或 SHIPPED
const canReassign = computed(() => {
  const order = orderData.value?.order;
  const status = order?.status;
  return (
    order?.orderType === 'SERVICE' && (status === 'PAID' || status === 'SHIPPED') && hasAuth('store:order:dispatch')
  );
});

// 订单全链路时间线
const orderTimeline = computed(() => {
  const order = orderData.value?.order;
  if (!order) return [];

  const steps: Array<{
    title: string;
    time: string | null;
    type: 'success' | 'info' | 'warning' | 'error' | 'default';
  }> = [
    { title: $t('page.store_order_detail.timeline.create'), time: order.createTime, type: 'info' },
    { title: $t('page.store_order_detail.timeline.paid'), time: order.payTime ?? null, type: 'success' },
  ];

  if (order.orderType === 'SERVICE') {
    steps.push({
      title: $t('page.store_order_detail.timeline.workerAccept'),
      time: order.acceptTime ?? null,
      type: 'info',
    });
    steps.push({
      title: $t('page.store_order_detail.timeline.serviceStart'),
      time: order.serviceStartTime ?? null,
      type: 'info',
    });
    steps.push({
      title: $t('page.store_order_detail.timeline.serviceCompleteVerify'),
      time: order.status === 'COMPLETED' ? (order.completeTime ?? order.updateTime) : null,
      type: 'success',
    });
  } else {
    steps.push({ title: $t('page.store_order_detail.timeline.ship'), time: order.shipTime ?? null, type: 'info' });
    steps.push({
      title: $t('page.store_order_detail.timeline.confirmReceive'),
      time: order.status === 'COMPLETED' ? (order.completeTime ?? order.updateTime) : null,
      type: 'success',
    });
  }

  if (order.status === 'CANCELLED') {
    steps.push({
      title: $t('page.store_order_detail.timeline.cancelled'),
      time: order.cancelTime ?? order.updateTime,
      type: 'warning',
    });
  }
  if (order.status === 'REFUNDED') {
    steps.push({
      title: $t('page.store_order_detail.timeline.refunded'),
      time: order.refundTime ?? order.updateTime,
      type: 'error',
    });
  }

  return steps;
});

const bizOperationActionLabels = computed<Record<string, string>>(() => ({
  ORDER_REASSIGN_WORKER: $t('page.store_order_detail.bizAction.ORDER_REASSIGN_WORKER'),
  ORDER_VERIFY: $t('page.store_order_detail.bizAction.ORDER_VERIFY'),
  ORDER_REFUND: $t('page.store_order_detail.bizAction.ORDER_REFUND'),
  ORDER_PARTIAL_REFUND: $t('page.store_order_detail.bizAction.ORDER_PARTIAL_REFUND'),
  ORDER_PRODUCT_SHIP: $t('page.store_order_detail.bizAction.ORDER_PRODUCT_SHIP'),
  ORDER_PRODUCT_RECEIVE: $t('page.store_order_detail.bizAction.ORDER_PRODUCT_RECEIVE'),
  ORDER_BATCH_VERIFY: $t('page.store_order_detail.bizAction.ORDER_BATCH_VERIFY'),
  ORDER_BATCH_REFUND: $t('page.store_order_detail.bizAction.ORDER_BATCH_REFUND'),
  ORDER_BATCH_REMARK: $t('page.store_order_detail.bizAction.ORDER_BATCH_REMARK'),
  ORDER_BATCH_STATUS_TRANSITION: $t('page.store_order_detail.bizAction.ORDER_BATCH_STATUS_TRANSITION'),
  MEMBER_LEVEL_UPDATE: $t('page.store_order_detail.bizAction.MEMBER_LEVEL_UPDATE'),
  MEMBER_MANUAL_LEVEL: $t('page.store_order_detail.bizAction.MEMBER_MANUAL_LEVEL'),
  MEMBER_POINT_ADJUST: $t('page.store_order_detail.bizAction.MEMBER_POINT_ADJUST'),
  MEMBER_UPGRADE_APPROVE: $t('page.store_order_detail.bizAction.MEMBER_UPGRADE_APPROVE'),
  MEMBER_UPGRADE_REJECT: $t('page.store_order_detail.bizAction.MEMBER_UPGRADE_REJECT'),
}));

const {
  columns: operationLogColumns,
  data: operationLogData,
  loading: operationLogLoading,
  mobilePagination: operationLogPagination,
  updateSearchParams: updateOperationLogParams,
  getData: getOperationLogData,
} = useTable({
  apiFn: fetchGetOrderOperationLogs,
  immediate: false,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    orderId: '',
  },
  columns: () => [
    { key: 'createTime', title: $t('page.store_order_detail.operationLog.time'), align: 'center', width: 180 },
    {
      key: 'action',
      title: $t('page.store_order_detail.operationLog.action'),
      align: 'center',
      width: 120,
      render: (row) => bizOperationActionLabels.value[row.action] ?? row.action,
    },
    { key: 'operatorName', title: $t('page.store_order_detail.operationLog.operator'), align: 'center', width: 120 },
    {
      key: 'detail',
      title: $t('page.store_order_detail.operationLog.detail'),
      align: 'left',
      ellipsis: { tooltip: true },
      render: (row) => row.detail ?? $t('page.store_order_detail.emDash'),
    },
  ],
});

watch(
  () => orderId.value,
  (id) => {
    if (!id || !hasAuth('store:order:query')) return;
    updateOperationLogParams({ orderId: id, pageNum: 1 });
    getOperationLogData().catch((error) =>
      safeIgnoreActionError(error, {
        module: 'store-order',
        operationCode: 'order.detail',
        stepCode: 'order.detail.loadOperationLog',
        stepName: '加载订单操作日志',
        metadata: { orderId: id },
      }),
    );
  },
  { immediate: true },
);

// 加载订单详情
async function loadOrderDetail() {
  loading.value = true;
  try {
    const { data } = await fetchGetOrderDetail(orderId.value);
    orderData.value = data;
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.detail',
      stepCode: 'order.detail.loadDetail',
      stepName: '加载订单详情',
      metadata: { orderId: orderId.value },
    });
    window.$message?.error(getAppErrorMessage(error, $t('page.store_order_detail.msg.loadFail')));
  } finally {
    loading.value = false;
  }
}

// 返回列表（动态菜单下路由 name 带前缀，用 path 解析）
function handleBack() {
  router.push({ path: getRoutePath('store_order_list') });
}

/** 活动审计 / 佣金行审计（同上，必须用 path） */
function pushActivityAudit(orderIdParam: string) {
  router.push({ path: getRoutePath('store_order_activity-audit'), query: { orderId: orderIdParam } });
}

function pushCommissionAudit(orderIdParam: string, orderItemId?: string) {
  router.push({
    path: getRoutePath('store_finance_commission-audit'),
    query: orderItemId ? { orderId: orderIdParam, orderItemId } : { orderId: orderIdParam },
  });
}

/** 核销 */
function handleVerify() {
  actionRemark.value = '';
  openVerifyModal();
}

async function submitVerify() {
  if (!orderId.value) return;
  actionLoading.value = true;
  try {
    await fetchVerifyServiceFulfillment({ orderId: orderId.value, remark: actionRemark.value || undefined });
    window.$message?.success($t('page.store_order_detail.msg.verifyOk'));
    closeVerifyModal();
    await loadOrderDetail();
    getOperationLogData().catch((error) =>
      safeIgnoreActionError(error, {
        module: 'store-order',
        operationCode: 'order.verify',
        stepCode: 'order.verify.reloadOperationLog',
        stepName: '刷新订单操作日志',
        metadata: { orderId: orderId.value },
      }),
    );
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.verify',
      stepCode: 'order.verify.submit',
      stepName: '提交订单核销',
      metadata: { orderId: orderId.value },
    });
  } finally {
    actionLoading.value = false;
  }
}

/** 退款 */
function handleRefund() {
  actionRemark.value = '';
  openRefundModal();
}

async function submitRefund() {
  if (!orderId.value) return;
  actionLoading.value = true;
  try {
    await fetchRefundOrder({ orderId: orderId.value, remark: actionRemark.value || undefined });
    window.$message?.success($t('page.store_order_detail.msg.refundOk'));
    closeRefundModal();
    await loadOrderDetail();
    getOperationLogData().catch((error) =>
      safeIgnoreActionError(error, {
        module: 'store-order',
        operationCode: 'order.refund',
        stepCode: 'order.refund.reloadOperationLog',
        stepName: '刷新订单操作日志',
        metadata: { orderId: orderId.value },
      }),
    );
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.refund',
      stepCode: 'order.refund.submit',
      stepName: '提交整单退款',
      metadata: { orderId: orderId.value },
    });
  } finally {
    actionLoading.value = false;
  }
}

/** 部分退款 */
function handlePartialRefund() {
  actionRemark.value = '';
  const items = orderData.value?.order?.items ?? [];
  partialRefundItems.value = items.map((item: { id: string | number; productName: string; quantity: number }) => ({
    itemId: Number(item.id),
    quantity: 0,
    maxQty: item.quantity,
    productName: item.productName,
  }));
  openPartialRefundModal();
}

async function submitPartialRefund() {
  if (!orderId.value) return;
  const items = partialRefundItems.value
    .filter((i) => i.quantity > 0)
    .map((i) => ({ itemId: i.itemId, quantity: i.quantity }));
  if (items.length === 0) {
    window.$message?.warning($t('page.store_order_detail.msg.partialRefundNeedQty'));
    return;
  }
  actionLoading.value = true;
  try {
    await fetchPartialRefundOrder({ orderId: orderId.value, items, remark: actionRemark.value || undefined });
    window.$message?.success($t('page.store_order_detail.msg.partialRefundOk'));
    closePartialRefundModal();
    await loadOrderDetail();
    getOperationLogData().catch((error) =>
      safeIgnoreActionError(error, {
        module: 'store-order',
        operationCode: 'order.partialRefund',
        stepCode: 'order.partialRefund.reloadOperationLog',
        stepName: '刷新订单操作日志',
        metadata: { orderId: orderId.value },
      }),
    );
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.partialRefund',
      stepCode: 'order.partialRefund.submit',
      stepName: '提交部分退款',
      metadata: { orderId: orderId.value, itemCount: items.length },
    });
  } finally {
    actionLoading.value = false;
  }
}

/** 改派 */
function handleReassign() {
  newWorkerId.value = orderData.value?.worker?.id ?? null;
  openReassignModal();
}

async function submitReassign() {
  if (!orderId.value || newWorkerId.value === null || newWorkerId.value === undefined || newWorkerId.value <= 0) {
    window.$message?.warning($t('page.store_order_detail.msg.reassignWorkerRequired'));
    return;
  }
  actionLoading.value = true;
  try {
    await fetchAssignServiceFulfillment({ orderId: orderId.value, workerId: newWorkerId.value });
    window.$message?.success($t('page.store_order_detail.msg.reassignOk'));
    closeReassignModal();
    await loadOrderDetail();
    getOperationLogData().catch((error) =>
      safeIgnoreActionError(error, {
        module: 'store-order',
        operationCode: 'order.reassign',
        stepCode: 'order.reassign.reloadOperationLog',
        stepName: '刷新订单操作日志',
        metadata: { orderId: orderId.value },
      }),
    );
  } catch (error) {
    reportActionError(error, {
      module: 'store-order',
      operationCode: 'order.reassign',
      stepCode: 'order.reassign.submit',
      stepName: '提交订单改派',
      metadata: { orderId: orderId.value, workerId: newWorkerId.value },
    });
  } finally {
    actionLoading.value = false;
  }
}

async function refreshAll() {
  await loadOrderDetail();
  if (orderId.value && hasAuth('store:order:query')) {
    await getOperationLogData();
  }
}

onMounted(() => {
  loadOrderDetail().catch((error) =>
    safeIgnoreActionError(error, {
      module: 'store-order',
      operationCode: 'order.detail',
      stepCode: 'order.detail.mountedLoad',
      stepName: '页面初始化加载订单详情',
      metadata: { orderId: orderId.value },
    }),
  );
});
</script>

<template>
  <div class="flex-col-stretch gap-16px">
    <!-- 页头 -->
    <div class="flex flex-wrap items-center justify-between gap-8px">
      <NButton text @click="handleBack">
        <template #icon>
          <icon-carbon-arrow-left />
        </template>
        {{ $t('page.store_order_detail.backToList') }}
      </NButton>
      <NSpace>
        <NButton v-if="canVerify" type="primary" @click="handleVerify">{{
          $t('page.store_order_detail.actions.verify')
        }}</NButton>
        <NButton v-if="canRefund" type="error" @click="handleRefund">{{
          $t('page.store_order_detail.actions.fullRefund')
        }}</NButton>
        <NButton v-if="canRefund" @click="handlePartialRefund">{{
          $t('page.store_order_detail.actions.partialRefund')
        }}</NButton>
        <NButton v-if="canReassign" @click="handleReassign">{{
          $t('page.store_order_detail.actions.reassign')
        }}</NButton>
        <NButton v-if="orderId && hasAuth('store:order:query')" secondary @click="pushActivityAudit(orderId)">
          {{ $t('page.store_order_detail.actions.activityAudit') }}
        </NButton>
        <NButton v-if="orderId && hasAuth('finance:commission:list')" secondary @click="pushCommissionAudit(orderId)">
          {{ $t('page.store_order_detail.actions.commissionAudit') }}
        </NButton>
        <NButton type="primary" @click="refreshAll">{{ $t('page.store_order_detail.actions.refresh') }}</NButton>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <template v-if="orderData">
        <div class="flex-col-stretch gap-16px">
          <!-- 订单全链路时间线 -->
          <NCard :title="$t('page.store_order_detail.card.progress')" :bordered="false" size="small">
            <NTimeline horizontal>
              <NTimelineItem
                v-for="(step, idx) in orderTimeline"
                :key="idx"
                :title="step.title"
                :type="step.time ? step.type : 'default'"
                :content="step.time || $t('page.store_order_detail.notReached')"
                :line-type="step.time ? 'default' : 'dashed'"
              />
            </NTimeline>
          </NCard>

          <NCard
            v-if="hasAuth('store:order:query')"
            :title="$t('page.store_order_detail.card.operationLog')"
            :bordered="false"
            size="small"
          >
            <NDataTable
              :columns="operationLogColumns"
              :data="operationLogData"
              :loading="operationLogLoading"
              :pagination="operationLogPagination"
              remote
              :scroll-x="720"
            />
          </NCard>

          <!-- 卡片1: 订单状态与客户信息 -->
          <NCard :title="$t('page.store_order_detail.card.orderInfo')" :bordered="false" size="small">
            <NDescriptions :column="3" label-placement="left">
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.orderSn')">{{
                orderData.order?.orderSn
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.createTime')">{{
                orderData.order?.createTime
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.orderStatus')">
                <NTag :type="orderStatusRecord[orderData.order?.status]?.type">
                  {{ orderStatusRecord[orderData.order?.status]?.label || orderData.order?.status }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.customerNickname')">
                <div class="flex items-center gap-8px">
                  <NAvatar v-if="orderData.customer?.avatar" :src="orderData.customer.avatar" :size="24" round />
                  {{ orderData.customer?.nickname || '-' }}
                </div>
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.customerMobile')">{{
                orderData.customer?.mobile || '-'
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.attribution')">
                <div class="flex flex-wrap gap-8px">
                  <NTag v-if="orderData.attribution?.shareUser" type="info" size="small">
                    {{
                      $t('page.store_order_detail.desc.shareUser', { name: orderData.attribution.shareUser.nickname })
                    }}
                  </NTag>
                  <NTag v-if="orderData.attribution?.referrer" type="success" size="small">
                    {{
                      $t('page.store_order_detail.desc.indirectShareUser', {
                        name: orderData.attribution.referrer.nickname,
                      })
                    }}
                  </NTag>
                  <span v-if="!orderData.attribution?.shareUser && !orderData.attribution?.referrer">{{
                    $t('page.store_order_detail.desc.organicTraffic')
                  }}</span>
                </div>
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.desc.tenant')">
                <NTag type="warning" size="small">
                  {{ orderData.business?.companyName || orderData.business?.tenantId || '-' }}
                </NTag>
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>

          <!-- 卡片2: 商品/服务明细 -->
          <NCard :title="$t('page.store_order_detail.card.productDetail')" :bordered="false" size="small">
            <NTable :bordered="false" :single-line="false">
              <thead>
                <tr>
                  <th>{{ $t('page.store_order_detail.productTable.product') }}</th>
                  <th>{{ $t('page.store_order_detail.productTable.spec') }}</th>
                  <th>{{ $t('page.store_order_detail.productTable.unitPrice') }}</th>
                  <th>{{ $t('page.store_order_detail.productTable.qty') }}</th>
                  <th>{{ $t('page.store_order_detail.productTable.subtotal') }}</th>
                  <th v-if="hasAuth('finance:commission:list')" class="w-100px">
                    {{ $t('page.store_order_detail.productTable.commissionAudit') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in orderData.order?.items" :key="item.id">
                  <td>
                    <div class="flex items-center gap-8px">
                      <img :src="item.productImg" class="h-48px w-48px rounded object-cover" />
                      <span>{{ item.productName }}</span>
                    </div>
                  </td>
                  <td>{{ item.specData ? JSON.stringify(item.specData) : '-' }}</td>
                  <td>¥{{ item.price }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>¥{{ item.totalAmount }}</td>
                  <td v-if="hasAuth('finance:commission:list')">
                    <NButton text type="primary" size="small" @click="pushCommissionAudit(orderId, String(item.id))">
                      {{ $t('page.store_order_detail.productTable.view') }}
                    </NButton>
                  </td>
                </tr>
              </tbody>
            </NTable>
            <div class="mt-16px flex justify-end gap-16px">
              <NText>{{ $t('page.store_order_detail.summary.goodsTotal') }}: ¥{{ orderData.order?.totalAmount }}</NText>
              <NText>{{ $t('page.store_order_detail.summary.freight') }}: ¥{{ orderData.order?.freightAmount }}</NText>
              <NText
                >{{ $t('page.store_order_detail.summary.discount') }}: -¥{{ orderData.order?.discountAmount }}</NText
              >
              <NText type="error" strong
                >{{ $t('page.store_order_detail.summary.paid') }}: ¥{{ orderData.order?.payAmount }}</NText
              >
            </div>
          </NCard>

          <!-- 卡片3: 资金分配明细 (需权限) -->
          <NCard
            v-if="orderData.commissions"
            :title="$t('page.store_order_detail.card.fundAllocation')"
            :bordered="false"
            size="small"
          >
            <NTable :bordered="false" :single-line="false">
              <thead>
                <tr>
                  <th>{{ $t('page.store_order_detail.commissionTable.role') }}</th>
                  <th>{{ $t('page.store_order_detail.commissionTable.user') }}</th>
                  <th>{{ $t('page.store_order_detail.commissionTable.shareRate') }}</th>
                  <th>{{ $t('page.store_order_detail.commissionTable.amount') }}</th>
                  <th>{{ $t('page.store_order_detail.commissionTable.status') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="comm in orderData.commissions" :key="comm.id">
                  <td>
                    {{
                      comm.level === 1
                        ? $t('page.store_order_detail.commissionTable.level1')
                        : $t('page.store_order_detail.commissionTable.level2')
                    }}
                  </td>
                  <td>
                    <div class="flex items-center gap-8px">
                      <NAvatar v-if="comm.beneficiary?.avatar" :src="comm.beneficiary.avatar" :size="24" round />
                      {{ comm.beneficiary?.nickname || comm.beneficiaryId }}
                    </div>
                  </td>
                  <td>{{ comm.rateSnapshot }}%</td>
                  <td class="text-success">+¥{{ comm.amount }}</td>
                  <td>
                    <NTag :type="commissionStatusRecord[comm.status]?.type">
                      {{ commissionStatusRecord[comm.status]?.label }}
                    </NTag>
                  </td>
                </tr>
                <!-- 佣金扣除总计行 -->
                <tr
                  v-if="
                    orderData.commissions &&
                    orderData.commissions.length > 0 &&
                    orderData.business?.totalCommissionAmount
                  "
                >
                  <td colspan="3" class="text-right font-bold">
                    {{ $t('page.store_order_detail.commissionTable.commissionDeductTotal') }}
                  </td>
                  <td class="text-error font-bold">-¥{{ orderData.business.totalCommissionAmount }}</td>
                  <td>-</td>
                </tr>
                <!-- 商户收款行 -->
                <tr v-if="orderData.business">
                  <td>{{ $t('page.store_order_detail.commissionTable.merchantReceipt') }}</td>
                  <td>
                    <div class="flex items-center gap-8px">
                      <span class="font-bold">{{ orderData.business.companyName }}</span>
                    </div>
                  </td>
                  <td>-</td>
                  <td class="text-success">+¥{{ orderData.business.remainingAmount }}</td>
                  <td>
                    <NTag type="info">{{ $t('page.store_order_detail.commissionTable.pendingSettlement') }}</NTag>
                  </td>
                </tr>
              </tbody>
            </NTable>
            <NText class="mt-8px block text-gray-500" depth="3">
              {{ $t('page.store_order_detail.commissionTable.planSettle') }}:
              {{ orderData.commissions?.[0]?.planSettleTime }}
            </NText>
          </NCard>

          <!-- 卡片4: 履约与派单信息 (服务类订单) -->
          <NCard
            v-if="orderData.order?.orderType === 'SERVICE' && orderData.worker"
            :title="$t('page.store_order_detail.card.fulfillment')"
            :bordered="false"
            size="small"
          >
            <NDescriptions :column="2" label-placement="left">
              <NDescriptionsItem :label="$t('page.store_order_detail.fulfillment.worker')">
                <div class="flex items-center gap-8px">
                  <NAvatar v-if="orderData.worker?.avatar" :src="orderData.worker.avatar" :size="32" round />
                  {{ orderData.worker?.name }}
                </div>
              </NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.fulfillment.phone')">{{
                orderData.worker?.phone
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.fulfillment.rating')">{{
                orderData.worker?.rating || '-'
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.fulfillment.bookingTime')">{{
                orderData.order?.bookingTime
              }}</NDescriptionsItem>
            </NDescriptions>
          </NCard>

          <!-- 卡片5: 收货信息 -->
          <NCard :title="$t('page.store_order_detail.card.shipping')" :bordered="false" size="small">
            <NDescriptions :column="2" label-placement="left">
              <NDescriptionsItem :label="$t('page.store_order_detail.shipping.receiverName')">{{
                orderData.order?.receiverName
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.shipping.receiverPhone')">{{
                orderData.order?.receiverPhone
              }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.store_order_detail.shipping.address')" :span="2">{{
                orderData.order?.receiverAddress
              }}</NDescriptionsItem>
              <NDescriptionsItem
                v-if="orderData.order?.remark"
                :label="$t('page.store_order_detail.shipping.remark')"
                :span="2"
              >
                {{ orderData.order?.remark }}
              </NDescriptionsItem>
            </NDescriptions>
          </NCard>
        </div>
      </template>
    </NSpin>

    <!-- 核销弹窗 -->
    <NModal
      v-model:show="verifyModalVisible"
      :title="$t('page.store_order_detail.modalVerify.title')"
      preset="dialog"
      :positive-text="$t('page.store_order_detail.modalVerify.confirm')"
      :loading="actionLoading"
      @positive-click="submitVerify"
    >
      <NInput
        v-model:value="actionRemark"
        type="textarea"
        :placeholder="$t('page.store_order_detail.modalVerify.remarkPlaceholder')"
        :rows="3"
        class="mt-12px"
      />
    </NModal>

    <!-- 全额退款弹窗 -->
    <NModal
      v-model:show="refundModalVisible"
      :title="$t('page.store_order_detail.modalRefund.title')"
      preset="dialog"
      :positive-text="$t('page.store_order_detail.modalRefund.confirm')"
      :loading="actionLoading"
      @positive-click="submitRefund"
    >
      <NInput
        v-model:value="actionRemark"
        type="textarea"
        :placeholder="$t('page.store_order_detail.modalRefund.remarkPlaceholder')"
        :rows="3"
        class="mt-12px"
      />
    </NModal>

    <!-- 部分退款弹窗 -->
    <NModal
      v-model:show="partialRefundModalVisible"
      :title="$t('page.store_order_detail.modalPartialRefund.title')"
      preset="dialog"
      :positive-text="$t('page.store_order_detail.modalPartialRefund.confirm')"
      :loading="actionLoading"
      @positive-click="submitPartialRefund"
    >
      <div class="mt-12px space-y-8px">
        <p class="text-14px text-gray-600">{{ $t('page.store_order_detail.modalPartialRefund.hint') }}</p>
        <div
          v-for="row in partialRefundItems"
          :key="row.itemId"
          class="flex items-center justify-between gap-12px border-b border-gray-100 py-8px"
        >
          <span class="flex-1 truncate">{{ row.productName }}</span>
          <NInputNumber
            v-model:value="row.quantity"
            :min="0"
            :max="row.maxQty"
            :placeholder="$t('page.store_order_detail.msg.maxQtyPlaceholder', { max: row.maxQty })"
            class="w-120px"
          />
        </div>
        <NInput
          v-model:value="actionRemark"
          type="textarea"
          :placeholder="$t('page.store_order_detail.modalPartialRefund.remarkPlaceholder')"
          :rows="2"
          class="mt-8px"
        />
      </div>
    </NModal>

    <!-- 改派弹窗 -->
    <NModal
      v-model:show="reassignModalVisible"
      :title="$t('page.store_order_detail.modalReassign.title')"
      preset="dialog"
      :positive-text="$t('page.store_order_detail.modalReassign.confirm')"
      :loading="actionLoading"
      @positive-click="submitReassign"
    >
      <div class="mt-12px">
        <p class="mb-8px text-14px text-gray-600">{{ $t('page.store_order_detail.modalReassign.hint') }}</p>
        <DispatchWorkerPicker v-model:worker-id="newWorkerId" :active="reassignModalVisible" />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.text-success {
  color: #18a058;
}
.text-error {
  color: #d03050;
}
.font-bold {
  font-weight: 600;
}
.text-right {
  text-align: right;
}
</style>
