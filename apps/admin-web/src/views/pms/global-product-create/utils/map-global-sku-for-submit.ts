import type { components } from '@libs/common-types';

type CreateSkuDto = components['schemas']['CreateSkuDto'];

type SkuFormRow = Api.Pms.GlobalSkuOperate & { pic?: string };

/** 与 CreateSkuDto 对齐，去掉表单里的 stock、skuCode 等后端不接收字段 */
export function mapGlobalSkuForSubmit(s: SkuFormRow): CreateSkuDto {
  const skuImageRaw = s.skuImage ?? s.pic;
  const skuImage = typeof skuImageRaw === 'string' && skuImageRaw.trim().length > 0 ? skuImageRaw.trim() : undefined;

  return {
    skuId: s.skuId,
    specValues: (s.specValues ?? {}) as CreateSkuDto['specValues'],
    skuImage,
    guidePrice: Number(s.guidePrice),
    costPrice: s.costPrice !== undefined && s.costPrice !== null ? Number(s.costPrice) : undefined,
    distMode: s.distMode,
    guideRate: Number(s.guideRate),
    minDistRate: Number(s.minDistRate ?? 0),
    maxDistRate: Number(s.maxDistRate ?? 50),
  };
}
