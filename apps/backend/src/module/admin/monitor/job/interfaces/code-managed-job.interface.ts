import { StatusEnum } from 'src/common/enum';

export type CodeManagedJobGuardMode = 'self-managed' | 'platform-lock';

export interface CodeManagedJobMetadata {
  key: string;
  name: string;
  group: string;
  cron: string;
  guardMode: CodeManagedJobGuardMode;
  enabledByDefault?: boolean;
}

export interface CodeManagedJobDefinition extends CodeManagedJobMetadata {
  invokeTarget: string;
}

export interface CodeManagedJobRegistryEntry {
  classOrigin: any;
  methodName: string;
  metadata: CodeManagedJobMetadata;
}

export interface JobDefinitionSyncResult {
  createdCount: number;
  updatedCount: number;
  driftedCount: number;
  skippedCount: number;
  failures: Array<{ sourceKey: string; reason: string }>;
  /**
   * 孤儿任务：sysJob 表中 sourceType=CODE_MANAGED 但 sourceKey 已不在
   * 当前代码的 @CodeManagedJob 注册表中，代表代码侧已下线但数据库残留。
   * 运维侧需要确认是否清理或更名再启用，避免后续 sync 持续告警。
   */
  orphans: Array<{ sourceKey: string; jobName: string; jobId: number }>;
}

export interface CodeManagedJobView {
  sourceType: 'MANUAL' | 'CODE_MANAGED';
  sourceKey?: string;
  editableMode: 'full' | 'statusRemarkOnly';
  definitionDrift: boolean;
  definitionRemoved: boolean;
  guardMode?: CodeManagedJobGuardMode;
  status?: StatusEnum;
}
