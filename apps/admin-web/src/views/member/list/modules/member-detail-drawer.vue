<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import {
  NAvatar,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NGi,
  NGrid,
  NSpin,
  NTabPane,
  NTag,
  NTabs,
} from 'naive-ui';
import { useBoolean } from '@sa/hooks';
import { fetchGetMemberOperationLogs, fetchGetMemberPointHistory } from '@/service/api/member/member';
import { fetchGetUpgradeApplyList } from '@/service/api/member/upgrade';
import { fetchGetLedger } from '@/service/api/store/finance';
import { fetchGetOrderList } from '@/service/api/store/order';
import { useTable } from '@/hooks/common/table';
import { safeRemoteImageUrl } from '@/utils/image-src';
import { $t } from '@/locales';
import MemberPointOperateDrawer from './member-point-operate-drawer.vue';

defineOptions({
  name: 'MemberDetailDrawer',
});

interface Props {
  /** the visible state of the drawer */
  visible: boolean;
  /** the row data */
  rowData?: Api.Member.Member | null;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'update:visible', visible: boolean): void;
}

const emit = defineEmits<Emits>();

const drawerVisible = computed({
  get() {
    return props.visible;
  },
  set(visible: boolean) {
    emit('update:visible', visible);
  },
});

const OPERATION_ACTION_I18N: Record<string, App.I18n.I18nKey> = {
  ORDER_REASSIGN_WORKER: 'page.member.detailDrawer.actionOrderReassignWorker',
  ORDER_VERIFY: 'page.member.detailDrawer.actionOrderVerify',
  ORDER_REFUND: 'page.member.detailDrawer.actionOrderRefund',
  ORDER_PARTIAL_REFUND: 'page.member.detailDrawer.actionOrderPartialRefund',
  ORDER_PRODUCT_SHIP: 'page.member.detailDrawer.actionOrderProductShip',
  ORDER_PRODUCT_RECEIVE: 'page.member.detailDrawer.actionOrderProductReceive',
  ORDER_BATCH_VERIFY: 'page.member.detailDrawer.actionOrderBatchVerify',
  ORDER_BATCH_REFUND: 'page.member.detailDrawer.actionOrderBatchRefund',
  ORDER_BATCH_REMARK: 'page.member.detailDrawer.actionOrderBatchRemark',
  ORDER_BATCH_STATUS_TRANSITION: 'page.member.detailDrawer.actionOrderBatchStatusTransition',
  MEMBER_LEVEL_UPDATE: 'page.member.detailDrawer.actionMemberLevelUpdate',
  MEMBER_MANUAL_LEVEL: 'page.member.detailDrawer.actionMemberManualLevel',
  MEMBER_POINT_ADJUST: 'page.member.detailDrawer.actionMemberPointAdjust',
  MEMBER_UPGRADE_APPROVE: 'page.member.detailDrawer.actionMemberUpgradeApprove',
  MEMBER_UPGRADE_REJECT: 'page.member.detailDrawer.actionMemberUpgradeReject',
};

function operationActionLabel(action: string) {
  const key = OPERATION_ACTION_I18N[action];
  return key ? $t(key) : action;
}

const {
  columns: orderColumns,
  data: orderData,
  loading: orderLoading,
  mobilePagination: orderPagination,
  updateSearchParams: updateOrderParams,
  getData: getOrderData,
} = useTable({
  apiFn: fetchGetOrderList,
  immediate: false,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: '',
  },
  columns: () => [
    {
      key: 'orderSn',
      title: $t('page.member.detailDrawer.orderColOrderSn'),
      align: 'center',
    },
    {
      key: 'payAmount',
      title: $t('page.member.detailDrawer.orderColPayAmount'),
      align: 'center',
    },
    {
      key: 'status',
      title: $t('page.member.detailDrawer.orderColStatus'),
      align: 'center',
    },
    {
      key: 'createTime',
      title: $t('page.member.detailDrawer.orderColCreateTime'),
      align: 'center',
    },
  ],
});

const {
  columns: financeColumns,
  data: financeData,
  loading: financeLoading,
  mobilePagination: financePagination,
  updateSearchParams: updateFinanceParams,
  getData: getFinanceData,
} = useTable<typeof fetchGetLedger>({
  apiFn: fetchGetLedger,
  immediate: false,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: '',
  },
  columns: () => [
    {
      key: 'type',
      title: $t('page.member.detailDrawer.financeColType'),
      align: 'center',
      render: (row) => {
        if (row.type === 'ORDER_INCOME') {
          return $t('page.member.detailDrawer.financeTypeOrderIncome');
        }
        return row.typeName || (row.type === 'COMMISSION_IN' ? $t('page.member.detailDrawer.financeTypeCommissionIn') : $t('page.member.detailDrawer.financeTypeOther'));
      },
    },
    {
      key: 'amount',
      title: $t('page.member.detailDrawer.financeColAmount'),
      align: 'center',
      render: (row) => {
        let amount = row.amount;
        if (row.type === 'ORDER_INCOME') {
          amount = -amount;
        }
        return amount > 0 ? `+${amount}` : `${amount}`;
      },
    },
    {
      key: 'createTime',
      title: $t('page.member.detailDrawer.financeColTime'),
      align: 'center',
    },
  ],
});

const {
  columns: pointColumns,
  data: pointData,
  loading: pointLoading,
  mobilePagination: pointPagination,
  updateSearchParams: updatePointParams,
  getData: getPointData,
} = useTable({
  apiFn: fetchGetMemberPointHistory,
  immediate: false,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: '',
  },
  columns: () => [
    {
      key: 'type',
      title: $t('page.member.detailDrawer.pointColType'),
      align: 'center',
      render: (row) => row.typeName || row.type,
    },
    {
      key: 'changePoints',
      title: $t('page.member.detailDrawer.pointColChange'),
      align: 'center',
      render: (row) => (
        <span class={row.changePoints > 0 ? 'text-success' : 'text-error'}>
          {row.changePoints > 0 ? `+${row.changePoints}` : row.changePoints}
        </span>
      ),
    },
    {
      key: 'afterPoints',
      title: $t('page.member.detailDrawer.pointColAfter'),
      align: 'center',
    },
    {
      key: 'createTime',
      title: $t('page.member.detailDrawer.pointColTime'),
      align: 'center',
    },
  ],
});

const {
  columns: operationLogColumns,
  data: operationLogData,
  loading: operationLogLoading,
  mobilePagination: operationLogPagination,
  updateSearchParams: updateOperationLogParams,
  getData: getOperationLogData,
} = useTable({
  apiFn: fetchGetMemberOperationLogs,
  immediate: false,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: '',
  },
  columns: () => [
    { key: 'createTime', title: $t('page.member.detailDrawer.operationColTime'), align: 'center', width: 180 },
    {
      key: 'action',
      title: $t('page.member.detailDrawer.operationColAction'),
      align: 'center',
      width: 120,
      render: (row) => operationActionLabel(row.action),
    },
    { key: 'operatorName', title: $t('page.member.detailDrawer.operationColOperator'), align: 'center', width: 120 },
    {
      key: 'detail',
      title: $t('page.member.detailDrawer.operationColDetail'),
      align: 'left',
      ellipsis: { tooltip: true },
      render: (row) => row.detail ?? $t('page.member.detailDrawer.operationDetailDash'),
    },
  ],
});

const { bool: adjustVisible, setTrue: setAdjustVisible } = useBoolean();
const latestUpgradeApply = ref<Api.Member.UpgradeApply | null>(null);
const latestUpgradeLoading = ref(false);

function handlePointSubmitted() {
  getPointData();
  getOperationLogData();
}

async function loadLatestUpgradeApply(memberId: string) {
  latestUpgradeLoading.value = true;
  try {
    const { data } = await fetchGetUpgradeApplyList({
      pageNum: 1,
      pageSize: 1,
      memberId,
    });
    latestUpgradeApply.value = data?.rows?.[0] || null;
  } catch {
    latestUpgradeApply.value = null;
  } finally {
    latestUpgradeLoading.value = false;
  }
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function resolveApplyTypeLabel(applyType?: string | null): string {
  const map: Record<string, string> = {
    PRODUCT_PURCHASE: '商品购买',
    REFERRAL_CODE: '推荐码扫码',
    MANUAL_ADJUST: '手动调整',
  };
  if (!applyType) return '-';
  return map[applyType] || applyType;
}

function resolveMatchedActivityVersion(apply: Api.Member.UpgradeApply | null): string {
  if (!apply) return '-';
  if (apply.matchedActivityVersion) return apply.matchedActivityVersion;
  const triggerSnapshot = toRecord(apply.triggerSnapshot);
  return readString(triggerSnapshot?.activityVersionId) || '-';
}

function resolveReferralCode(apply: Api.Member.UpgradeApply | null): string {
  if (!apply) return '-';
  if (apply.referralCode) return apply.referralCode;
  const triggerSnapshot = toRecord(apply.triggerSnapshot);
  return readString(triggerSnapshot?.referralCode) || '-';
}

function resolveUpgradeTriggerSummary(apply: Api.Member.UpgradeApply | null): string {
  if (!apply) return '-';
  const triggerSnapshot = toRecord(apply.triggerSnapshot);
  const triggerTime = readString(triggerSnapshot?.triggerTime) || apply.createTime;
  return `${resolveApplyTypeLabel(apply.applyType)} / ${triggerTime || '-'}`;
}

function resolveAttributionSummary(apply: Api.Member.UpgradeApply | null): string {
  if (!apply) return '-';
  const triggerSnapshot = toRecord(apply.triggerSnapshot);
  const attributionWindow = readNumber(triggerSnapshot?.attributionWindowMinutes);
  const shareChannel = readString(triggerSnapshot?.shareChannel);
  const channelMap: Record<string, string> = {
    MINIAPP: '小程序',
    H5: 'H5',
    APP: 'App',
    WECHAT: '微信',
  };

  const windowText = attributionWindow !== null ? `${attributionWindow} 分钟` : '-';
  const channelText = shareChannel ? (channelMap[shareChannel] ?? shareChannel) : '-';
  return `${windowText} / ${channelText}`;
}

function resolveTeamResultSummary(apply: Api.Member.UpgradeApply | null): string {
  if (!apply) return '-';
  const applyRecord = toRecord(apply);
  const triggerSnapshot = toRecord(apply.triggerSnapshot);
  const teamResult =
    toRecord(triggerSnapshot?.teamResult) ??
    toRecord(triggerSnapshot?.teamThresholdResult) ??
    toRecord(applyRecord?.teamResult) ??
    triggerSnapshot;

  const currentLevel = readNumber(teamResult?.currentLevel) ?? readNumber(teamResult?.myLevel) ?? apply.fromLevel;
  const nextLevel = readNumber(teamResult?.nextLevel) ?? readNumber(teamResult?.targetLevel) ?? apply.toLevel;
  const estimatedCommission =
    readNumber(teamResult?.estimatedCommission) ??
    readNumber(teamResult?.commissionEstimate) ??
    readNumber(teamResult?.estimatedAmount);
  const estimatedText =
    estimatedCommission !== null
      ? `¥${estimatedCommission.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '-';

  return `当前 L${currentLevel} -> 下一 L${nextLevel} / 预估佣金 ${estimatedText}`;
}

watch(
  () => props.visible,
  (val) => {
    if (val && props.rowData) {
      const { memberId } = props.rowData;
      updateOrderParams({ memberId });
      updateFinanceParams({ memberId });
      updatePointParams({ memberId });
      updateOperationLogParams({ memberId });

      getOrderData();
      getFinanceData();
      getPointData();
      getOperationLogData();
      loadLatestUpgradeApply(memberId).catch(() => undefined);
    } else if (!val) {
      latestUpgradeApply.value = null;
    }
  },
);
</script>

<template>
  <NDrawer v-model:show="drawerVisible" :title="$t('page.member.detailDrawer.title')" :width="800">
    <NDrawerContent class="main-content">
      <NTabs type="line" animated>
        <NTabPane name="info" :tab="$t('page.member.detailDrawer.tabInfo')">
          <div v-if="rowData" class="p-4">
            <div class="mb-6 flex items-center">
              <NAvatar :src="safeRemoteImageUrl(rowData.avatar)" :size="80" round class="mr-4" />
              <div>
                <h2 class="text-xl font-bold">{{ rowData.nickname }}</h2>
                <p class="text-gray-500">{{ rowData.mobile }}</p>
              </div>
            </div>

            <NGrid :x-gap="12" :y-gap="12" :cols="3" class="mb-6">
              <NGi>
                <NCard :title="$t('page.member.detailDrawer.cardTotalConsumption')" size="small">
                  <span class="text-2xl text-primary font-bold">¥{{ rowData.totalConsumption }}</span>
                </NCard>
              </NGi>
              <NGi>
                <NCard :title="$t('page.member.detailDrawer.cardCommission')" size="small">
                  <span class="text-2xl text-warning font-bold">¥{{ rowData.commission }}</span>
                </NCard>
              </NGi>
              <NGi>
                <NCard :title="$t('page.member.detailDrawer.cardBalance')" size="small">
                  <span class="text-2xl text-success font-bold">¥{{ rowData.balance }}</span>
                </NCard>
              </NGi>
              <NGi>
                <NCard :title="$t('page.member.detailDrawer.cardPoints')" size="small">
                  <div class="flex items-baseline justify-between">
                    <span class="text-2xl text-primary font-bold">{{ rowData.points }}</span>
                    <NButton size="tiny" type="primary" ghost @click="setAdjustVisible">
                      {{ $t('page.member.detailDrawer.btnAdjustPoints') }}
                    </NButton>
                  </div>
                </NCard>
              </NGi>
            </NGrid>

            <NDescriptions label-placement="left" bordered :title="$t('page.member.detailDrawer.descTitle')">
              <NDescriptionsItem :label="$t('page.member.detailDrawer.labelMemberId')">{{ rowData.memberId }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.member.detailDrawer.labelRegisterTime')">{{ rowData.createTime }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.member.detailDrawer.labelTenant')">{{ rowData.tenantName }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.member.detailDrawer.labelReferrer')">{{ rowData.referrerName || '-' }}</NDescriptionsItem>
              <NDescriptionsItem :label="$t('page.member.detailDrawer.labelReferrerMobile')">{{ rowData.referrerMobile || '-' }}</NDescriptionsItem>
            </NDescriptions>

            <NCard title="分销成长链路" size="small" class="mt-12px">
              <NSpin :show="latestUpgradeLoading">
                <NDescriptions label-placement="left" bordered :column="1" size="small">
                  <NDescriptionsItem label="推荐关系">
                    {{ rowData.referrerName ? `${rowData.referrerName}（${rowData.referrerMobile || '-'}）` : '-' }}
                  </NDescriptionsItem>
                  <NDescriptionsItem label="推荐码">{{ resolveReferralCode(latestUpgradeApply) }}</NDescriptionsItem>
                  <NDescriptionsItem label="升级触发摘要">{{ resolveUpgradeTriggerSummary(latestUpgradeApply) }}</NDescriptionsItem>
                  <NDescriptionsItem label="活动版本命中">
                    <NTag v-if="resolveMatchedActivityVersion(latestUpgradeApply) !== '-'" type="info" size="small">
                      {{ resolveMatchedActivityVersion(latestUpgradeApply) }}
                    </NTag>
                    <span v-else>-</span>
                  </NDescriptionsItem>
                  <NDescriptionsItem label="归因窗口/渠道">{{ resolveAttributionSummary(latestUpgradeApply) }}</NDescriptionsItem>
                  <NDescriptionsItem label="团队达标结果">{{ resolveTeamResultSummary(latestUpgradeApply) }}</NDescriptionsItem>
                </NDescriptions>
              </NSpin>
            </NCard>
          </div>
        </NTabPane>

        <NTabPane name="order" :tab="$t('page.member.detailDrawer.tabOrder')">
          <div class="h-full flex flex-col">
            <NDataTable
              :columns="orderColumns"
              :data="orderData"
              :loading="orderLoading"
              :pagination="orderPagination"
              remote
              class="flex-1-hidden"
            />
          </div>
        </NTabPane>

        <NTabPane name="finance" :tab="$t('page.member.detailDrawer.tabFinance')">
          <div class="h-full flex flex-col">
            <NDataTable
              :columns="financeColumns"
              :data="financeData"
              :loading="financeLoading"
              :pagination="financePagination"
              remote
              class="flex-1-hidden"
            />
          </div>
        </NTabPane>

        <NTabPane name="points" :tab="$t('page.member.detailDrawer.tabPoints')">
          <div class="h-full flex flex-col">
            <NDataTable
              :columns="pointColumns"
              :data="pointData"
              :loading="pointLoading"
              :pagination="pointPagination"
              remote
              class="flex-1-hidden"
            />
          </div>
        </NTabPane>

        <NTabPane name="operation-log" :tab="$t('page.member.detailDrawer.tabOperationLog')">
          <div class="h-full flex flex-col">
            <NDataTable
              :columns="operationLogColumns"
              :data="operationLogData"
              :loading="operationLogLoading"
              :pagination="operationLogPagination"
              remote
              class="flex-1-hidden"
              :scroll-x="720"
            />
          </div>
        </NTabPane>
      </NTabs>
    </NDrawerContent>

    <MemberPointOperateDrawer
      v-model:visible="adjustVisible"
      :member-id="rowData?.memberId || ''"
      @submitted="handlePointSubmitted"
    />
  </NDrawer>
</template>

<style scoped>
.main-content {
  display: flex;
  flex-direction: column;
}
.flex-1-hidden {
  flex: 1;
  overflow: hidden;
}
</style>
