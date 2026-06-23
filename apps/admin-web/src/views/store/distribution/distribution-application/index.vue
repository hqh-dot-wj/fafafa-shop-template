<script setup lang="tsx">
import { NButton, NCard, NDataTable, NSpace, NTabPane, NTabs, NTag } from 'naive-ui';
import { ref } from 'vue';
import {
  fetchGetDistributionRelationList,
  fetchGetDistributorProfileList,
  fetchGetPendingRewardList,
  fetchGetQualificationApplicationList,
  fetchGetQualificationEvidenceList,
  fetchGetQualificationRuleList,
  fetchGetServicePolicyList,
  freezeDistributorProfile,
  reviewQualificationApplication,
  revokeDistributorProfile,
} from '@/service/api/store/distribution';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { $t } from '@/locales';
import ApplicationSearch from './modules/application-search.vue';

defineOptions({
  name: 'DistributionApplication',
});

type ApplicationRow = Api.Store.QualificationApplication & { index: number };
type EvidenceRow = Api.Store.QualificationEvidence & { index: number };
type ProfileRow = Api.Store.DistributorProfile & { index: number };
type RelationRow = Api.Store.DistributionRelation & { index: number };
type PendingRewardRow = Api.Store.PendingReward & { index: number };
type ServicePolicyRow = Api.Store.QualificationServicePolicy & { index: number };
type RuleRow = Api.Store.QualificationRule & { index: number };

const appStore = useAppStore();
const activeTab = ref('applications');
const loadedTabs = new Set<string>(['applications']);

const applicationTable = useTable({
  apiFn: fetchGetQualificationApplicationList,
  apiParams: {
    pageNum: 1,
    pageSize: 10,
    memberId: undefined,
    status: undefined,
  },
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: ApplicationRow) => row.index },
    { key: 'memberId', title: '会员ID', align: 'center', width: 180, ellipsis: true },
    { key: 'targetLevelId', title: '申请等级', align: 'center', width: 96, render: (row: ApplicationRow) => renderLevel(row.targetLevelId) },
    { key: 'status', title: '状态', align: 'center', width: 120, render: (row: ApplicationRow) => renderApplicationStatus(row.status) },
    {
      key: 'evidenceIds',
      title: '材料数',
      align: 'center',
      width: 90,
      render: (row: ApplicationRow) => row.evidenceIds?.length ?? 0,
    },
    { key: 'applyReason', title: '申请说明', align: 'center', minWidth: 160, ellipsis: true, render: (row: ApplicationRow) => row.applyReason || '-' },
    { key: 'reviewRemark', title: '审核备注', align: 'center', minWidth: 160, ellipsis: true, render: (row: ApplicationRow) => row.reviewRemark || '-' },
    { key: 'createTime', title: '申请时间', align: 'center', width: 170 },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 160,
      render: (row: ApplicationRow) => {
        if (row.status !== 'PENDING_REVIEW') return null;
        return (
          <NSpace justify="center">
            <NButton type="primary" ghost size="small" onClick={() => handleReview(row, 'APPROVED')}>
              通过
            </NButton>
            <NButton type="error" ghost size="small" onClick={() => handleReview(row, 'REJECTED')}>
              驳回
            </NButton>
          </NSpace>
        );
      },
    },
  ],
});

const evidenceTable = useTable({
  apiFn: fetchGetQualificationEvidenceList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: EvidenceRow) => row.index },
    { key: 'memberId', title: '会员ID', align: 'center', width: 180, ellipsis: true },
    { key: 'orderId', title: '订单ID', align: 'center', width: 180, ellipsis: true },
    { key: 'servicePolicyId', title: '服务策略', align: 'center', width: 100, render: (row: EvidenceRow) => row.servicePolicyId ?? '-' },
    { key: 'evidenceStatus', title: '状态', align: 'center', width: 120, render: (row: EvidenceRow) => renderEvidenceStatus(row.evidenceStatus) },
    { key: 'sourceShareUserId', title: '来源分享人', align: 'center', width: 180, ellipsis: true, render: (row: EvidenceRow) => row.sourceShareUserId || '-' },
    { key: 'verifiedAt', title: '核销时间', align: 'center', width: 170, render: (row: EvidenceRow) => row.verifiedAt || '-' },
    { key: 'createTime', title: '创建时间', align: 'center', width: 170 },
  ],
});

const profileTable = useTable({
  apiFn: fetchGetDistributorProfileList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: ProfileRow) => row.index },
    { key: 'memberId', title: '会员ID', align: 'center', width: 180, ellipsis: true },
    { key: 'levelId', title: '等级', align: 'center', width: 90, render: (row: ProfileRow) => renderLevel(row.levelId) },
    { key: 'status', title: '状态', align: 'center', width: 110, render: (row: ProfileRow) => renderProfileStatus(row.status) },
    { key: 'canWithdraw', title: '提现', align: 'center', width: 80, render: (row: ProfileRow) => renderBool(row.canWithdraw) },
    { key: 'canEarnL2', title: '二级佣金', align: 'center', width: 90, render: (row: ProfileRow) => renderBool(row.canEarnL2) },
    { key: 'qualifiedAt', title: '生效时间', align: 'center', width: 170 },
    {
      key: 'operate',
      title: $t('common.operate'),
      align: 'center',
      width: 160,
      render: (row: ProfileRow) => (
        <NSpace justify="center">
          <NButton disabled={row.status !== 'ACTIVE'} size="small" ghost onClick={() => handleFreezeProfile(row)}>
            冻结
          </NButton>
          <NButton disabled={row.status === 'REVOKED'} type="error" size="small" ghost onClick={() => handleRevokeProfile(row)}>
            撤销
          </NButton>
        </NSpace>
      ),
    },
  ],
});

const relationTable = useTable({
  apiFn: fetchGetDistributionRelationList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: RelationRow) => row.index },
    { key: 'distributorMemberId', title: '分销员', align: 'center', width: 180, ellipsis: true },
    { key: 'teamOwnerMemberId', title: '团队归属C2', align: 'center', width: 180, ellipsis: true, render: (row: RelationRow) => row.teamOwnerMemberId || '-' },
    { key: 'inviterMemberId', title: '邀请人', align: 'center', width: 180, ellipsis: true, render: (row: RelationRow) => row.inviterMemberId || '-' },
    { key: 'status', title: '状态', align: 'center', width: 110, render: (row: RelationRow) => renderRelationStatus(row.status) },
    { key: 'effectiveAt', title: '生效时间', align: 'center', width: 170 },
  ],
});

const pendingRewardTable = useTable({
  apiFn: fetchGetPendingRewardList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: PendingRewardRow) => row.index },
    { key: 'memberId', title: '会员ID', align: 'center', width: 180, ellipsis: true },
    { key: 'orderId', title: '订单ID', align: 'center', width: 180, ellipsis: true },
    { key: 'amount', title: '金额', align: 'right', width: 100, render: (row: PendingRewardRow) => formatMoney(row.amount) },
    { key: 'status', title: '状态', align: 'center', width: 110, render: (row: PendingRewardRow) => renderPendingStatus(row.status) },
    { key: 'voidReason', title: '作废原因', align: 'center', minWidth: 160, ellipsis: true, render: (row: PendingRewardRow) => row.voidReason || '-' },
    { key: 'createTime', title: '创建时间', align: 'center', width: 170 },
  ],
});

const servicePolicyTable = useTable({
  apiFn: fetchGetServicePolicyList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: ServicePolicyRow) => row.index },
    { key: 'targetType', title: '目标类型', align: 'center', width: 110 },
    { key: 'targetId', title: '目标ID', align: 'center', width: 180, ellipsis: true },
    { key: 'commissionEligible', title: '可分佣', align: 'center', width: 90, render: (row: ServicePolicyRow) => renderBool(row.commissionEligible) },
    { key: 'qualificationEligible', title: '可申请', align: 'center', width: 90, render: (row: ServicePolicyRow) => renderBool(row.qualificationEligible) },
    { key: 'allowLv0Share', title: 'LV0分享', align: 'center', width: 90, render: (row: ServicePolicyRow) => renderBool(row.allowLv0Share) },
    { key: 'lv0RewardMode', title: 'LV0收益', align: 'center', width: 100 },
    { key: 'isActive', title: '启用', align: 'center', width: 80, render: (row: ServicePolicyRow) => renderBool(row.isActive) },
  ],
});

const ruleTable = useTable({
  apiFn: fetchGetQualificationRuleList,
  apiParams: { pageNum: 1, pageSize: 10 },
  immediate: false,
  columns: () => [
    { key: 'index', title: $t('common.index'), align: 'center', width: 64, render: (row: RuleRow) => row.index },
    { key: 'targetLevelId', title: '目标等级', align: 'center', width: 100, render: (row: RuleRow) => renderLevel(row.targetLevelId) },
    { key: 'requiredEvidenceCount', title: '材料数', align: 'center', width: 90 },
    { key: 'requireManualReview', title: '人工审核', align: 'center', width: 90, render: (row: RuleRow) => renderBool(row.requireManualReview) },
    { key: 'minOrderAmount', title: '最低金额', align: 'right', width: 110, render: (row: RuleRow) => formatMoney(row.minOrderAmount) },
    { key: 'minRegisterDays', title: '注册天数', align: 'center', width: 90 },
    { key: 'isActive', title: '启用', align: 'center', width: 80, render: (row: RuleRow) => renderBool(row.isActive) },
  ],
});

async function handleReview(row: ApplicationRow, result: 'APPROVED' | 'REJECTED') {
  const approved = result === 'APPROVED';
  window.$dialog?.warning({
    title: approved ? '通过资格申请' : '驳回资格申请',
    content: approved ? `确认授予会员 ${row.memberId} ${renderLevelText(row.targetLevelId)} 资格吗？` : '请确认是否驳回该资格申请？',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await reviewQualificationApplication(row.id, {
        result,
        remark: approved ? '审核通过' : '不符合资格要求',
      });
      window.$message?.success('操作成功');
      applicationTable.getData();
      profileTable.getData();
      relationTable.getData();
      pendingRewardTable.getData();
    },
  });
}

function handleTabUpdate(tab: string | number) {
  const tabName = String(tab);
  activeTab.value = tabName;
  if (loadedTabs.has(tabName)) return;
  loadedTabs.add(tabName);

  const loaders: Record<string, () => Promise<void>> = {
    evidence: evidenceTable.getData,
    profiles: profileTable.getData,
    relations: relationTable.getData,
    pendingRewards: pendingRewardTable.getData,
    servicePolicies: servicePolicyTable.getData,
    rules: ruleTable.getData,
  };

  void loaders[tabName]?.().catch(() => {
    loadedTabs.delete(tabName);
  });
}

function handleFreezeProfile(row: ProfileRow) {
  window.$dialog?.warning({
    title: '冻结分销资格',
    content: `确认冻结会员 ${row.memberId} 的分销资格吗？冻结后不可分佣、不可提现。`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await freezeDistributorProfile(row.id, { reason: '后台冻结资格' });
      window.$message?.success('已冻结');
      profileTable.getData();
      relationTable.getData();
    },
  });
}

function handleRevokeProfile(row: ProfileRow) {
  window.$dialog?.error({
    title: '撤销分销资格',
    content: `确认撤销会员 ${row.memberId} 的分销资格吗？撤销会同步清除兼容等级投影。`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      await revokeDistributorProfile(row.id, { reason: '后台撤销资格' });
      window.$message?.success('已撤销');
      profileTable.getData();
      relationTable.getData();
    },
  });
}

function renderLevel(level?: number) {
  return <NTag type={level === 2 ? 'success' : level === 1 ? 'info' : 'default'}>{renderLevelText(level)}</NTag>;
}

function renderLevelText(level?: number) {
  if (level === 2) return 'C2 股东';
  if (level === 1) return 'C1 团长';
  return '普通';
}

function renderBool(value?: boolean) {
  return <NTag type={value ? 'success' : 'default'}>{value ? '是' : '否'}</NTag>;
}

function renderApplicationStatus(status?: string) {
  const map = {
    PENDING_REVIEW: { label: '待审核', type: 'warning' },
    APPROVED: { label: '已通过', type: 'success' },
    REJECTED: { label: '已驳回', type: 'error' },
    CANCELLED: { label: '已取消', type: 'default' },
  } as const;
  return renderStatus(status, map);
}

function renderEvidenceStatus(status?: string) {
  const map = {
    PENDING_DELIVERY: { label: '待交付', type: 'warning' },
    ELIGIBLE: { label: '可申请', type: 'success' },
    USED: { label: '已使用', type: 'info' },
    INVALID: { label: '已失效', type: 'default' },
    REFUNDED: { label: '已退款', type: 'error' },
    LEGACY_IMPORT: { label: '历史导入', type: 'default' },
  } as const;
  return renderStatus(status, map);
}

function renderProfileStatus(status?: string) {
  const map = {
    ACTIVE: { label: '生效中', type: 'success' },
    FROZEN: { label: '已冻结', type: 'warning' },
    REVOKED: { label: '已撤销', type: 'error' },
  } as const;
  return renderStatus(status, map);
}

function renderRelationStatus(status?: string) {
  const map = {
    ACTIVE: { label: '生效中', type: 'success' },
    FROZEN: { label: '已冻结', type: 'warning' },
    CANCELLED: { label: '已取消', type: 'default' },
  } as const;
  return renderStatus(status, map);
}

function renderPendingStatus(status?: string) {
  const map = {
    FROZEN: { label: '冻结中', type: 'warning' },
    ELIGIBLE: { label: '可释放', type: 'success' },
    RELEASED: { label: '已释放', type: 'info' },
    VOIDED: { label: '已作废', type: 'error' },
  } as const;
  return renderStatus(status, map);
}

function renderStatus(status: string | undefined, map: Record<string, { label: string; type: 'default' | 'error' | 'info' | 'success' | 'warning' }>) {
  const option = status ? map[status] : undefined;
  return <NTag type={option?.type ?? 'default'}>{option?.label ?? status ?? '-'}</NTag>;
}

function formatMoney(value?: number) {
  return Number(value ?? 0).toFixed(2);
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <ApplicationSearch v-model:model="applicationTable.searchParams" @reset="applicationTable.resetSearchParams" @search="applicationTable.getDataByPage" />

    <NCard
      :title="$t('route.store_distribution_distribution-application')"
      :bordered="false"
      size="small"
      class="card-wrapper sm:flex-1-hidden"
    >
      <NTabs v-model:value="activeTab" type="line" animated class="h-full" @update:value="handleTabUpdate">
        <NTabPane name="applications" tab="资格申请">
          <NDataTable
            :columns="applicationTable.columns.value"
            :data="applicationTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="applicationTable.loading.value"
            :pagination="applicationTable.mobilePagination.value"
            :row-key="(row: ApplicationRow) => row.id"
            remote
            :scroll-x="applicationTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="evidence" tab="资格材料">
          <NDataTable
            :columns="evidenceTable.columns.value"
            :data="evidenceTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="evidenceTable.loading.value"
            :pagination="evidenceTable.mobilePagination.value"
            :row-key="(row: EvidenceRow) => row.id"
            remote
            :scroll-x="evidenceTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="profiles" tab="资格档案">
          <NDataTable
            :columns="profileTable.columns.value"
            :data="profileTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="profileTable.loading.value"
            :pagination="profileTable.mobilePagination.value"
            :row-key="(row: ProfileRow) => row.id"
            remote
            :scroll-x="profileTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="relations" tab="团队关系">
          <NDataTable
            :columns="relationTable.columns.value"
            :data="relationTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="relationTable.loading.value"
            :pagination="relationTable.mobilePagination.value"
            :row-key="(row: RelationRow) => row.id"
            remote
            :scroll-x="relationTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="pendingRewards" tab="待激活收益">
          <NDataTable
            :columns="pendingRewardTable.columns.value"
            :data="pendingRewardTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="pendingRewardTable.loading.value"
            :pagination="pendingRewardTable.mobilePagination.value"
            :row-key="(row: PendingRewardRow) => row.id"
            remote
            :scroll-x="pendingRewardTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="servicePolicies" tab="服务策略">
          <NDataTable
            :columns="servicePolicyTable.columns.value"
            :data="servicePolicyTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="servicePolicyTable.loading.value"
            :pagination="servicePolicyTable.mobilePagination.value"
            :row-key="(row: ServicePolicyRow) => row.id"
            remote
            :scroll-x="servicePolicyTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
        <NTabPane name="rules" tab="资格规则">
          <NDataTable
            :columns="ruleTable.columns.value"
            :data="ruleTable.data.value"
            :flex-height="!appStore.isMobile"
            :loading="ruleTable.loading.value"
            :pagination="ruleTable.mobilePagination.value"
            :row-key="(row: RuleRow) => row.id"
            remote
            :scroll-x="ruleTable.scrollX.value"
            class="sm:h-full"
          />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>

<style scoped></style>
