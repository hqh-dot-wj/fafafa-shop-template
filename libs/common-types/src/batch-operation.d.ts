/**
 * 店铺域批量操作统一回执（与 backend BatchOperationResult 对齐）
 * 待后端通过 OpenAPI schema 完整暴露 BatchOperationResult 后，切换至 generate-types 生成
 */
export interface BatchOperationResult {
  successCount: number;
  failCount: number;
  details: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
}
