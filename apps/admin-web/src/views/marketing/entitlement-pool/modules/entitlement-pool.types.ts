import type {
  EntitlementPoolCompileResult,
  EntitlementPoolStatus,
  EntitlementPoolType,
  EntitlementProductSourceType,
  EntitlementTouchpoint,
} from '@/service/api/marketing';

export type { EntitlementPoolStatus };

export interface EntitlementPoolDraft {
  name: string;
  poolType: EntitlementPoolType;
  touchpoints: EntitlementTouchpoint[];
  sourceType?: EntitlementProductSourceType | null;
  sourceKey?: string;
  memberId?: string;
  templateId?: string;
  templateName?: string;
  taskId?: string;
  taskName?: string;
}

export interface EntitlementPoolRecord extends EntitlementPoolDraft {
  id: string;
  status: EntitlementPoolStatus;
  owner: string;
  compileArtifacts: string[];
  riskSummary: string[];
  updatedAt: string;
  lastCompiledAt?: string;
  compilePreview?: Record<string, unknown>;
}

export interface EntitlementPoolListQuery {
  keyword: string;
  poolType: EntitlementPoolType | null;
  status: EntitlementPoolStatus | null;
}

export interface EntitlementCompileApplyResult {
  next: EntitlementPoolRecord;
  result: EntitlementPoolCompileResult | null;
}

export function createDefaultDraft(): EntitlementPoolDraft {
  return {
    name: '',
    poolType: 'PRODUCT',
    touchpoints: ['product'],
    sourceType: 'SCENE',
    sourceKey: '',
    memberId: '',
    templateId: '',
    templateName: '',
    taskId: '',
    taskName: '',
  };
}
