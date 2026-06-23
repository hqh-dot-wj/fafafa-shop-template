import { httpGet } from '@/http/http';

export interface DictDataItem {
  dictCode: number;
  dictLabel: string;
  dictValue: string;
  dictType: string;
  dictSort: number;
  listClass?: string;
  cssClass?: string;
  isDefault?: string;
}

/**
 * 根据字典类型查询字典数据
 */
export function getDictByType(dictType: string) {
  return httpGet<DictDataItem[]>(`/system/dict/data/type/${dictType}`);
}
