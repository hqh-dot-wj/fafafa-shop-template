import { type MaybeRef, computed, unref } from 'vue';

export interface CampaignPrecheckCheck {
  key?: string;
  title?: string;
  status?: string;
  note?: string;
}

export interface CampaignPrecheckShell {
  campaignId?: string;
  publishReady?: boolean;
  checks?: CampaignPrecheckCheck[];
  publishActions?: string[];
  checkedAt?: string;
}

// 预检摘要只解释后端返回的检查项，不在前端运行真实活动规则。
function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || value.length === 0) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN');
}

function normalizeIssues(shell: CampaignPrecheckShell | null | undefined) {
  // PASS/SUCCESS/READY 以外的状态都当作待处理项，保持发布入口保守。
  const checks = shell?.checks ?? [];
  return checks
    .filter((item) => {
      const status = item.status?.trim().toUpperCase();
      return status !== 'PASS' && status !== 'SUCCESS' && status !== 'READY';
    })
    .map((item) => {
      const title = item.title?.trim();
      const note = item.note?.trim();
      return [title, note].filter(Boolean).join('：');
    })
    .filter((item) => item.length > 0);
}

export function useCampaignPrecheck(shell: MaybeRef<CampaignPrecheckShell | null | undefined>) {
  const shellRef = computed(() => unref(shell) ?? null);

  const publishReady = computed(() => Boolean(shellRef.value?.publishReady));
  const issueList = computed(() => normalizeIssues(shellRef.value));
  const issueCount = computed(() => issueList.value.length);
  const blockedCount = computed(() => issueCount.value);
  const statusLabel = computed(() => {
    if (!shellRef.value) return '未加载';
    if (publishReady.value) return '预检通过，可进入发布入口';
    if (issueCount.value > 0) return '存在待处理的预检项';
    return '待预检';
  });
  const statusType = computed<'success' | 'warning' | 'error' | 'default'>(() => {
    if (!shellRef.value) return 'default';
    if (publishReady.value) return 'success';
    if (issueCount.value > 0) return 'error';
    return 'warning';
  });
  const checkedAtText = computed(() => formatDateTime(shellRef.value?.checkedAt));
  const moduleCountText = computed(() => {
    const count = shellRef.value?.checks?.length;
    return typeof count === 'number' && Number.isFinite(count) ? String(count) : '-';
  });

  return {
    shellRef,
    publishReady,
    issueList,
    issueCount,
    blockedCount,
    statusLabel,
    statusType,
    checkedAtText,
    moduleCountText,
  };
}
