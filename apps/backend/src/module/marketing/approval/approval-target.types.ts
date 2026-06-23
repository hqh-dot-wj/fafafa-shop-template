export const APPROVAL_TARGET_TYPE_STORE_PLAY_CONFIG = 'STORE_PLAY_CONFIG' as const;

export type ApprovalTargetType = typeof APPROVAL_TARGET_TYPE_STORE_PLAY_CONFIG;

export interface ApprovalTargetRef {
  targetType: ApprovalTargetType;
  targetId: string;
}

export interface ApprovalTargetCompatibleInput {
  configId?: string;
  target?: ApprovalTargetRef | null;
}

export function createStorePlayConfigApprovalTarget(targetId: string): ApprovalTargetRef | undefined {
  const normalizedTargetId = targetId.trim();

  if (!normalizedTargetId) {
    return undefined;
  }

  return {
    targetType: APPROVAL_TARGET_TYPE_STORE_PLAY_CONFIG,
    targetId: normalizedTargetId,
  };
}

export function normalizeApprovalTargetRef(target?: unknown): ApprovalTargetRef | undefined {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    return undefined;
  }

  const targetRecord = target as Partial<ApprovalTargetRef>;

  if (targetRecord.targetType !== APPROVAL_TARGET_TYPE_STORE_PLAY_CONFIG || typeof targetRecord.targetId !== 'string') {
    return undefined;
  }

  return createStorePlayConfigApprovalTarget(targetRecord.targetId);
}

export function normalizeApprovalTargetInput(
  input: ApprovalTargetCompatibleInput | string | null | undefined,
): ApprovalTargetRef | undefined {
  if (typeof input === 'string') {
    return createStorePlayConfigApprovalTarget(input);
  }

  if (!input) {
    return undefined;
  }

  if (input.target) {
    return normalizeApprovalTargetRef(input.target);
  }

  return createStorePlayConfigApprovalTarget(input.configId ?? '');
}
