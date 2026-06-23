/**
 * 将商品详情/列表接口中可能存在的 mainImages、albumPics 统一为 URL 数组（顺序与后台一致）
 */
export function normalizeMainImagesFromProductDetail(data: { mainImages?: unknown; albumPics?: unknown }): string[] {
  if (Array.isArray(data.mainImages) && data.mainImages.length > 0) {
    return data.mainImages.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
  }
  if (typeof data.albumPics === 'string' && data.albumPics.trim().length > 0) {
    return data.albumPics
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return [];
}
