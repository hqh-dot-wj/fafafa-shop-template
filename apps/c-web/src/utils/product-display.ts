import type { ClientProduct, ClientProductDetail } from '@libs/common-types';

type ProductLike = Pick<ClientProduct, 'coverImage' | 'mainImages' | 'price' | 'mainActivitySummary'>;

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"%3E%3Crect fill="%23f1f5f9" width="320" height="320"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="16"%3E暂无图片%3C/text%3E%3C/svg%3E';

export function resolveProductImage(product: ProductLike | null | undefined): string {
  if (!product) return PLACEHOLDER_IMAGE;
  const cover = product.coverImage?.trim();
  if (cover) return cover;
  const first = product.mainImages?.find((item) => typeof item === 'string' && item.trim());
  return first?.trim() || PLACEHOLDER_IMAGE;
}

export function resolveProductSalePrice(product: ProductLike | null | undefined): number | null {
  if (!product) return null;
  const activityPrice = product.mainActivitySummary?.displayPrice;
  if (typeof activityPrice === 'number' && Number.isFinite(activityPrice)) return activityPrice;
  if (typeof product.price === 'number' && Number.isFinite(product.price)) return product.price;
  return null;
}

export function resolveProductOriginalPrice(
  product: ProductLike | null | undefined,
  salePrice: number | null,
): number | null {
  if (!product || salePrice === null) return null;
  if (typeof product.price === 'number' && product.price > salePrice) return product.price;
  return null;
}

export function formatYuan(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

export function formatSpecLabel(specValues: unknown): string {
  if (!specValues || typeof specValues !== 'object') return '默认规格';
  const parts = Object.values(specValues as Record<string, unknown>)
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '默认规格';
}

export type ProductDetailSku = ClientProductDetail['skus'][number];
