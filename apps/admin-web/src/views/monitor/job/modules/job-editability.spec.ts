import { describe, expect, it } from 'vitest';
import { canDeleteJob, canEditJobField, isCodeManagedJob } from './job-editability';

describe('job editability', () => {
  const codeManagedJob = {
    sourceType: 'CODE_MANAGED',
    editableMode: 'statusRemarkOnly',
  } as Api.Monitor.Job;

  const manualJob = {
    sourceType: 'MANUAL',
    editableMode: 'full',
  } as Api.Monitor.Job;

  it('识别代码托管任务', () => {
    expect(isCodeManagedJob(codeManagedJob)).toBe(true);
    expect(isCodeManagedJob(manualJob)).toBe(false);
  });

  it('代码托管任务只允许编辑状态和备注', () => {
    expect(canEditJobField(codeManagedJob, 'status')).toBe(true);
    expect(canEditJobField(codeManagedJob, 'remark')).toBe(true);
    expect(canEditJobField(codeManagedJob, 'jobName')).toBe(false);
    expect(canEditJobField(codeManagedJob, 'jobGroup')).toBe(false);
    expect(canEditJobField(codeManagedJob, 'invokeTarget')).toBe(false);
    expect(canEditJobField(codeManagedJob, 'cronExpression')).toBe(false);
    expect(canEditJobField(codeManagedJob, 'misfirePolicy')).toBe(false);
    expect(canEditJobField(codeManagedJob, 'concurrent')).toBe(false);
  });

  it('手工任务保持完整编辑与删除能力', () => {
    expect(canEditJobField(manualJob, 'jobName')).toBe(true);
    expect(canDeleteJob(manualJob)).toBe(true);
    expect(canDeleteJob(codeManagedJob)).toBe(false);
  });
});
