export const PRODUCT_TYPE = {
  REAL: 'REAL',
  SERVICE: 'SERVICE',
} as const;

export type ProductType = (typeof PRODUCT_TYPE)[keyof typeof PRODUCT_TYPE];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  [PRODUCT_TYPE.REAL]: '实物商品',
  [PRODUCT_TYPE.SERVICE]: '服务商品',
};

export const PRODUCT_TYPE_SELECT_OPTIONS: Array<{ label: string; value: ProductType }> = Object.entries(
  PRODUCT_TYPE_LABELS,
).map(([value, label]) => ({
  label,
  value: value as ProductType,
}));
