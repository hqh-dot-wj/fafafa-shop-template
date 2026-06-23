import type { ProductDisplayTag, ProductPurchaseStatus, ProductServiceSummary } from '@libs/common-types';

export type SeniorProductCardVariant = 'list' | 'category' | 'home';

export interface SeniorProductCardModel {
  productId: string;
  title: string;
  imageUrl: string;
  subtitle?: string;
  priceLabel?: string;
  currentPrice?: number;
  originalPrice?: number;
  displayTags?: ProductDisplayTag[];
  purchaseStatus?: ProductPurchaseStatus;
  serviceSummary?: ProductServiceSummary;
  explain?: string;
  actionText: string;
  activityContextKey?: string;
  activityType?: string;
  entrySceneCode?: string;
  entryModuleCode?: string;
  entrySource?: string;
}
