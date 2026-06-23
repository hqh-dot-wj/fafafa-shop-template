import { describe, expect, it } from 'vitest';
import { getJobStatusBadges, getSyncDefinitionsSummary } from './job-presentation';

describe('job presentation', () => {
  it('为代码托管任务返回来源与状态标签', () => {
    const badges = getJobStatusBadges({
      sourceType: 'CODE_MANAGED',
      definitionDrift: true,
      definitionRemoved: false,
      guardMode: 'platform-lock',
    } as Api.Monitor.Job);

    expect(badges).toEqual([
      { key: 'source', label: '代码托管', type: 'info' },
      { key: 'drift', label: '定义待同步', type: 'warning' },
      { key: 'guard', label: '平台锁', type: 'warning' },
    ]);
  });

  it('为已移除定义的任务返回高优先级告警标签', () => {
    const badges = getJobStatusBadges({
      sourceType: 'CODE_MANAGED',
      definitionDrift: false,
      definitionRemoved: true,
      guardMode: 'self-managed',
    } as Api.Monitor.Job);

    expect(badges).toEqual([
      { key: 'source', label: '代码托管', type: 'info' },
      { key: 'removed', label: '定义已移除', type: 'error' },
      { key: 'guard', label: '任务自管', type: 'success' },
    ]);
  });

  it('汇总同步结果文案', () => {
    const summary = getSyncDefinitionsSummary({
      createdCount: 2,
      updatedCount: 3,
      driftedCount: 1,
      skippedCount: 4,
      failures: [{ sourceKey: 'marketing.healthCheck', reason: '重复 sourceKey' }],
    });

    expect(summary).toBe('新增 2 条，更新 3 条，检测到 1 条漂移，跳过 4 条，失败 1 条');
  });
});
