/**
 * Store 库存 API 类型
 * 库存列表项与后端 TenantSkuRepository.findStockList 返回结构对齐（含 tenantProd、globalSku）
 * 待后端通过 OpenAPI schema 暴露库存相关 VO 后，切换至 generate-types 生成
 */
import type { components } from './api';
import type { BatchOperationResult } from './batch-operation';

/** 库存列表项 - 与后端实际返回结构对齐 */
export interface StockSkuVo {
  id: string;
  stock: number;
  price: number;
  isActive: boolean;
  tenantProd: {
    id: string;
    product: {
      name: string;
      mainImages: string[];
    };
  };
  globalSku: {
    specValues: Record<string, string>;
  };
}

/** 库存列表搜索参数 */
export type StockSearchParams = components['schemas']['ListStockDto'];

/** 单次库存调整参数 */
export type StockUpdateParams = components['schemas']['UpdateStockDto'];

/** 批量库存调整参数 */
export type BatchUpdateStockParams = components['schemas']['BatchUpdateStockDto'];

/** 批量调整结果（与店铺域 BatchOperationResult 一致，details.id 为 SKU ID） */
export type BatchUpdateStockResult = BatchOperationResult;
