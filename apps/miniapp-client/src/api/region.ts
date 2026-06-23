/**
 * 行政区划 API
 * backend openApi 中 RegionVo 暂未独立导出，保留本地类型。
 * @expires backend 导出 RegionVo 后切换至 generate-types。
 */
import { httpGet } from '@/http/http';

export interface RegionVo {
  code: string;
  name: string;
  parentId?: string;
  level: number;
}

/**
 * 获取行政区划列表
 * @param parentId 父级Code，不传则返回一级行政区（省份）
 */
export function getRegionList(parentId?: string) {
  return httpGet<RegionVo[]>('/lbs/region/list', { parentId });
}

/**
 * 获取行政区划名称
 * @param code 行政区划Code
 */
export function getRegionName(code: string) {
  return httpGet<string>(`/lbs/region/name/${code}`);
}
