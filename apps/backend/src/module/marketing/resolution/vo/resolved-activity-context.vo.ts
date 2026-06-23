import { Decimal } from '@prisma/client/runtime/library';

export class ResolvedActivityContextVo {
  activityContextKey: string;
  activityType: string;
  configId: string;
  activityName: string;
  activityPrice: Decimal;
  originalPrice: Decimal;
  commissionMode: string;
  commissionRate: Decimal | null;
  status: string;
  startTime: Date | null;
  endTime: Date | null;
  remainingStock: number | null;
  rules: Record<string, unknown>;
  displayData: Record<string, unknown> | null;
  entrySceneCode?: string | null;
  entryModuleCode?: string | null;
  cardTemplateCode?: string | null;
  resolverPolicyCode?: string | null;
  resolverReleaseNo?: number | null;
  activityVersionId?: string | null;
  attributionWindowMinutes?: number | null;
  shareChannel?: string | null;
}
