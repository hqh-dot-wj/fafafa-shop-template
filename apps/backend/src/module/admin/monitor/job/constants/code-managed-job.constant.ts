export const JOB_SOURCE_TYPE = {
  MANUAL: 'MANUAL',
  CODE_MANAGED: 'CODE_MANAGED',
} as const;

export type JobSourceType = (typeof JOB_SOURCE_TYPE)[keyof typeof JOB_SOURCE_TYPE];

export const JOB_EDITABLE_MODE = {
  FULL: 'full',
  STATUS_REMARK_ONLY: 'statusRemarkOnly',
} as const;

export type JobEditableMode = (typeof JOB_EDITABLE_MODE)[keyof typeof JOB_EDITABLE_MODE];

export const CODE_MANAGED_JOB_DEFAULTS = {
  CREATE_BY: 'system',
  UPDATE_BY: 'system',
  MISFIRE_POLICY: '3',
  CONCURRENT: '1',
} as const;
