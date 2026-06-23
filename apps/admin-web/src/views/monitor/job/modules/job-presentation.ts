type JobBadgeType = 'default' | 'info' | 'warning' | 'error' | 'success';

export interface JobStatusBadge {
  key: string;
  label: string;
  type: JobBadgeType;
}

export function getJobStatusBadges(job?: Api.Monitor.Job | null): JobStatusBadge[] {
  if (!job) {
    return [];
  }

  const badges: JobStatusBadge[] = [
    {
      key: 'source',
      label: job.sourceType === 'CODE_MANAGED' ? '代码托管' : '手工任务',
      type: job.sourceType === 'CODE_MANAGED' ? 'info' : 'default',
    },
  ];

  if (job.definitionRemoved) {
    badges.push({ key: 'removed', label: '定义已移除', type: 'error' });
  } else if (job.definitionDrift) {
    badges.push({ key: 'drift', label: '定义待同步', type: 'warning' });
  }

  if (job.guardMode === 'platform-lock') {
    badges.push({ key: 'guard', label: '平台锁', type: 'warning' });
  } else if (job.guardMode === 'self-managed') {
    badges.push({ key: 'guard', label: '任务自管', type: 'success' });
  }

  return badges;
}

export function getSyncDefinitionsSummary(result: Api.Monitor.SyncJobDefinitionsResult) {
  const summaryParts = [
    `新增 ${result.createdCount} 条`,
    `更新 ${result.updatedCount} 条`,
    `检测到 ${result.driftedCount} 条漂移`,
    `跳过 ${result.skippedCount} 条`,
  ];

  if (result.failures.length > 0) {
    summaryParts.push(`失败 ${result.failures.length} 条`);
  }

  return summaryParts.join('，');
}
