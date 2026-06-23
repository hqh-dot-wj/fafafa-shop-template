import { Decimal } from '@prisma/client/runtime/library';

export class AggregateProductCardVo {
  productId: string;
  productName: string;
  productImg: string;
  mainActivity: {
    activityContextKey: string;
    activityType: string;
    configId: string;
    activityName: string;
    displayPrice: Decimal;
    originalPrice: Decimal;
    tagLabel: string;
    statusSummary: string;
    countdownEndTime: Date | null;
    remainingSlots: number | null;
  } | null;
  fallbackActivities: Array<{
    activityContextKey: string;
    activityType: string;
  }>;
}
