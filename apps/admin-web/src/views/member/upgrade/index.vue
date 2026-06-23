<script setup lang="tsx">
import { NAvatar, NButton, NSpace, NTag } from 'naive-ui';
import { fetchApproveUpgrade, fetchGetUpgradeApplyList } from '@/service/api/member/upgrade';
import { useAppStore } from '@/store/modules/app';
import { useTable } from '@/hooks/common/table';
import { safeRemoteImageUrl } from '@/utils/image-src';
import AuditStatusTag from '@/components/custom/audit-status-tag.vue';
import UpgradeSearch from './modules/upgrade-search.vue';

defineOptions({
  name: 'UpgradeApplyList',
});

type UnknownRecord = Record<string, unknown>;

const appStore = useAppStore();

const { columns, data, getData, getDataByPage, loading, mobilePagination, scrollX, searchParams, resetSearchParams } =
  useTable({
    apiFn: fetchGetUpgradeApplyList,
    apiParams: {
      pageNum: 1,
      pageSize: 10,
      memberId: undefined,
      status: undefined,
      applyType: undefined,
      params: undefined,
    },
    columns: () => [
      {
        key: 'member',
        title: '申请人',
        align: 'left',
        width: 180,
        render: (row) => (
          <div class="flex items-center gap-2">
            <NAvatar src={safeRemoteImageUrl(row.member?.avatar)} round size="small" />
            <div class="flex flex-col">
              <span>{row.member?.nickname || row.memberId}</span>
              <span class="text-xs text-gray-500">{row.member?.mobile}</span>
            </div>
          </div>
        ),
      },
      {
        key: 'fromLevel',
        title: '等级变更',
        align: 'center',
        width: 150,
        render: (row) => (
          <div class="flex items-center justify-center gap-2">
            <NTag size="small">{row.fromLevelName}</NTag>
            <icon-mdi-arrow-right class="text-gray-400" />
            <NTag type="success" size="small">
              {row.toLevelName}
            </NTag>
          </div>
        ),
      },
      {
        key: 'applyType',
        title: '申请类型',
        align: 'center',
        width: 120,
        render: (row: Api.Member.UpgradeApply) => {
          const map: Record<string, string> = {
            PRODUCT_PURCHASE: '商品购买',
            REFERRAL_CODE: '推荐码扫码',
            MANUAL_ADJUST: '手动调整',
          };
          return <NTag bordered={false}>{map[row.applyType] || row.applyType}</NTag>;
        },
      },
      {
        key: 'status',
        title: '状态',
        align: 'center',
        width: 100,
        render: (row) => <AuditStatusTag status={row.status} />,
      },
      {
        key: 'createTime',
        title: '申请时间',
        align: 'center',
        width: 160,
      },
      {
        key: 'matchedActivityVersion',
        title: '活动版本命中',
        align: 'center',
        width: 180,
        render: (row: Api.Member.UpgradeApply) => {
          const matchedActivityVersion = resolveMatchedActivityVersion(row);
          if (!matchedActivityVersion) return '-';
          return (
            <NTag type="info" size="small">
              {matchedActivityVersion}
            </NTag>
          );
        },
      },
      {
        key: 'attribution',
        title: '归因窗口/渠道',
        align: 'left',
        width: 200,
        render: (row: Api.Member.UpgradeApply) => {
          const attribution = resolveAttributionMeta(row);
          return (
            <div class="flex flex-col text-xs leading-18px">
              <span>{attribution.windowText}</span>
              <span>{attribution.channelText}</span>
            </div>
          );
        },
      },
      {
        key: 'referralCode',
        title: '推荐码',
        align: 'center',
        width: 160,
        render: (row: Api.Member.UpgradeApply) => {
          const referralCode = resolveReferralCode(row);
          if (!referralCode) return '-';
          return (
            <NTag type="warning" bordered={false} size="small">
              {referralCode}
            </NTag>
          );
        },
      },
      {
        key: 'teamResult',
        title: '团队达标结果',
        align: 'left',
        width: 240,
        render: (row: Api.Member.UpgradeApply) => {
          const teamResult = resolveTeamResult(row);
          return (
            <div class="flex flex-col text-xs leading-18px">
              <span>{`当前层级：${teamResult.currentLevelText}`}</span>
              <span>{`下一层级：${teamResult.nextLevelText}`}</span>
              <span>{`预估佣金：${teamResult.estimatedCommissionText}`}</span>
            </div>
          );
        },
      },
      {
        key: 'operate',
        title: '操作',
        align: 'center',
        width: 180,
        render: (row) => {
          if (row.status !== 'PENDING') return null;
          return (
            <NSpace justify="center">
              <NButton type="primary" size="small" ghost onClick={() => handleApprove(row)}>
                通过
              </NButton>
              <NButton type="error" size="small" ghost onClick={() => handleReject(row)}>
                驳回
              </NButton>
            </NSpace>
          );
        },
      },
    ],
  });

function toRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UnknownRecord;
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

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resolveMatchedActivityVersion(row: Api.Member.UpgradeApply): string | null {
  if (row.matchedActivityVersion) return row.matchedActivityVersion;
  const triggerSnapshot = toRecord(row.triggerSnapshot);
  return readString(triggerSnapshot?.activityVersionId);
}

function resolveReferralCode(row: Api.Member.UpgradeApply): string | null {
  if (row.referralCode) return row.referralCode;
  const triggerSnapshot = toRecord(row.triggerSnapshot);
  return readString(triggerSnapshot?.referralCode);
}

function resolveAttributionMeta(row: Api.Member.UpgradeApply): { windowText: string; channelText: string } {
  const triggerSnapshot = toRecord(row.triggerSnapshot);
  const attributionWindowMinutes = readNumber(triggerSnapshot?.attributionWindowMinutes);
  const shareChannel = readString(triggerSnapshot?.shareChannel);

  const channelMap: Record<string, string> = {
    MINIAPP: '小程序',
    H5: 'H5',
    APP: 'App',
    WECHAT: '微信',
  };

  return {
    windowText: attributionWindowMinutes !== null ? `窗口：${attributionWindowMinutes} 分钟` : '窗口：-',
    channelText: `渠道：${shareChannel ? (channelMap[shareChannel] ?? shareChannel) : '-'}`,
  };
}

// 升级申请 triggerSnapshot 字段组合较多，保持单函数聚合展示逻辑
// eslint-disable-next-line complexity
function resolveTeamResult(row: Api.Member.UpgradeApply): {
  currentLevelText: string;
  nextLevelText: string;
  estimatedCommissionText: string;
} {
  const rowRecord = toRecord(row);
  const triggerSnapshot = toRecord(row.triggerSnapshot);
  const snapshotTeamResult =
    toRecord(triggerSnapshot?.teamResult) ??
    toRecord(triggerSnapshot?.teamThresholdResult) ??
    toRecord(rowRecord?.teamResult);
  const source = snapshotTeamResult ?? triggerSnapshot ?? rowRecord;

  const currentLevel =
    readNumber(source?.currentLevel) ?? readNumber(source?.myLevel) ?? readNumber(source?.fromLevel) ?? row.fromLevel;
  const nextLevel =
    readNumber(source?.nextLevel) ?? readNumber(source?.targetLevel) ?? readNumber(source?.toLevel) ?? row.toLevel;
  const estimatedCommission =
    readNumber(source?.estimatedCommission) ??
    readNumber(source?.commissionEstimate) ??
    readNumber(source?.estimatedAmount);

  return {
    currentLevelText: currentLevel !== null ? `L${currentLevel}` : '-',
    nextLevelText: nextLevel !== null ? `L${nextLevel}` : '-',
    estimatedCommissionText: formatCurrency(estimatedCommission),
  };
}

async function handleApprove(row: Api.Member.UpgradeApply) {
  window.$dialog?.warning({
    title: '审批通过',
    content: `确认将会员 ${row.member?.nickname} 升级为 ${row.toLevelName}?`,
    positiveText: '确认通过',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await fetchApproveUpgrade(row.id, { action: 'approve' });
        window.$message?.success('操作成功');
        getData();
      } catch {
        // 请求层已提示
      }
    },
  });
}

function handleReject(row: Api.Member.UpgradeApply) {
  // Simple prompt for reason, or could be a modal
  window.$dialog?.warning({
    title: '审批驳回',
    content: '确认驳回该申请吗？',
    positiveText: '确认驳回',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await fetchApproveUpgrade(row.id, { action: 'reject', reason: '管理员驳回' });
        window.$message?.success('已驳回');
        getData();
      } catch {
        // 请求层已提示
      }
    },
  });
}
</script>

<template>
  <div class="min-h-500px flex-col-stretch gap-16px overflow-hidden lt-sm:overflow-auto">
    <UpgradeSearch v-model:model="searchParams" @reset="resetSearchParams" @search="getDataByPage" />
    <NCard title="升级申请列表" :bordered="false" size="small" class="card-wrapper sm:flex-1-hidden">
      <NDataTable
        :columns="columns"
        :data="data"
        :loading="loading"
        :pagination="mobilePagination"
        remote
        :flex-height="!appStore.isMobile"
        :scroll-x="scrollX"
        class="sm:h-full"
      />
    </NCard>
  </div>
</template>
