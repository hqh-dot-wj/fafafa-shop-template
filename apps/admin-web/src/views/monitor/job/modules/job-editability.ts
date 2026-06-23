const statusRemarkOnlyFields = new Set<keyof Api.Monitor.JobOperateParams>(['status', 'remark']);

export function isCodeManagedJob(job?: Pick<Api.Monitor.Job, 'sourceType'> | null) {
  return job?.sourceType === 'CODE_MANAGED';
}

export function canEditJobField(job: Api.Monitor.Job | null | undefined, field: keyof Api.Monitor.JobOperateParams) {
  if (!isCodeManagedJob(job)) {
    return true;
  }

  return statusRemarkOnlyFields.has(field);
}

export function canDeleteJob(job: Api.Monitor.Job | null | undefined) {
  return !isCodeManagedJob(job);
}
