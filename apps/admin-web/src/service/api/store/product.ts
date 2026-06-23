import { request } from '@/service/request';

/** Tenant Product List */
export function fetchGetStoreProductList(data: Api.Store.ListStoreProductParams) {
  return request<Api.Store.TenantProductList>({
    url: '/store/product/list',
    method: 'post',
    data,
  });
}

/** Draft Product List */
export function fetchGetStoreProductDraftList(data: Api.Store.ListStoreProductParams) {
  return request<Api.Store.TenantProductList>({
    url: '/store/product/draft/list',
    method: 'post',
    data,
  });
}

/** Review Product List */
export function fetchGetStoreProductReviewList(data: Api.Store.ListStoreProductParams) {
  return request<Api.Store.TenantProductList>({
    url: '/store/product/review/list',
    method: 'post',
    data,
  });
}

/** Import Product */
export function fetchImportProduct(data: Api.Store.ProductImportParams) {
  return request<boolean>({
    url: '/store/product/import',
    method: 'post',
    data,
  });
}

/** Download Store Product Import Template */
export function fetchDownloadStoreProductImportTemplate(params: { categoryId: number; templateVersionId?: string }) {
  return request<Blob, 'blob'>({
    url: '/store/product/import-template',
    method: 'get',
    params,
    responseType: 'blob',
  });
}

/** Get category template versions */
export function fetchGetStoreProductTemplateVersions(categoryId: number) {
  return request<Api.Store.TemplateVersionOption[]>({
    url: '/store/product/template-versions',
    method: 'get',
    params: { categoryId },
  });
}

/** Import Store Product Excel */
export function fetchImportStoreProductExcel(data: Api.Store.ImportExcelParams) {
  return request<Api.Store.ImportExcelResult>({
    url: '/store/product/import-excel',
    method: 'post',
    data,
  });
}

/** Get Store Product Import Job */
export function fetchGetStoreProductImportJob(jobId: string) {
  return request<Api.Store.ImportExcelJobResult>({
    url: `/store/product/import-jobs/${jobId}`,
    method: 'get',
  });
}

/** Submit Store Product Audit */
export function fetchSubmitStoreProductAudit(id: string, data?: { operationId?: string }) {
  return request<boolean>({
    url: `/store/product/${id}/submit-audit`,
    method: 'post',
    data,
  });
}

/** Approve Store Product Audit */
export function fetchApproveStoreProductAudit(id: string, data?: { operationId?: string }) {
  return request<boolean>({
    url: `/store/product/${id}/audit/approve`,
    method: 'post',
    data,
  });
}

/** Batch Approve Store Product Audit */
export function fetchBatchApproveStoreProductAudit(data: { items: string[]; operationId?: string }) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/audit/approve/batch',
    method: 'post',
    data,
  });
}

/** Reject Store Product Audit */
export function fetchRejectStoreProductAudit(id: string, data: { reason: string; operationId?: string }) {
  return request<boolean>({
    url: `/store/product/${id}/audit/reject`,
    method: 'post',
    data,
  });
}

/** Update Product Price & Config */
export function fetchUpdateStoreProductPrice(data: Api.Store.ProductPriceUpdateParams) {
  return request<boolean>({
    url: '/store/product/update-price',
    method: 'post',
    data,
  });
}

/** Update Product SPU Base Info */
export function fetchUpdateStoreProductBase(data: Api.Store.ProductBaseUpdateParams) {
  return request<boolean>({
    url: '/store/product/update-base',
    method: 'post',
    data,
  });
}

/** Get Product Market List (Headquarters Pool) */
export function fetchGetProductMarketList(data: Api.Store.MarketSearchParams) {
  return request<Api.Store.MarketProductList>({
    url: '/store/market/list',
    method: 'post',
    data,
  });
}

/** Get Product Market Detail */
export function fetchGetMarketProductDetail(productId: string) {
  return request<Api.Store.MarketProduct>({
    url: `/store/market/detail/${productId}`,
    method: 'get',
  });
}

/** Batch Import Products */
export function fetchBatchImportProducts(data: { items: Api.Store.ProductImportParams[] }) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/import/batch',
    method: 'post',
    data,
  });
}

/** Batch Update Product Price */
export function fetchBatchUpdateProductPrice(data: {
  items: Array<{
    tenantSkuId: string;
    price: number;
    stock: number;
    distRate: number;
    distMode?: Api.Pms.DistributionMode;
    pointsRatio?: number;
    isPromotionProduct?: boolean;
  }>;
}) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/update-price/batch',
    method: 'post',
    data,
  });
}

/** Batch Validate SKU Price/Commission */
export function fetchBatchValidateStoreProductSkuPriceCommission(data: {
  items: Array<{
    tenantSkuId: string;
    price: number;
    stock: number;
    distRate: number;
    distMode?: Api.Pms.DistributionMode;
    pointsRatio?: number;
    isPromotionProduct?: boolean;
  }>;
}) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/sku/batch-validate',
    method: 'post',
    data,
  });
}

/** Batch Upsert SKU Price/Commission */
export function fetchBatchUpsertStoreProductSkuPriceCommission(data: {
  items: Array<{
    tenantSkuId: string;
    price: number;
    stock: number;
    distRate: number;
    distMode?: Api.Pms.DistributionMode;
    pointsRatio?: number;
    isPromotionProduct?: boolean;
  }>;
}) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/sku/batch-upsert-price-commission',
    method: 'post',
    data,
  });
}

/** Remove Product from Store */
export function fetchRemoveProduct(data: { id: string }) {
  return request<boolean>({
    url: '/store/product/remove',
    method: 'post',
    data,
  });
}

/** Batch Remove Product from Store */
export function fetchBatchRemoveProduct(data: { items: string[]; operationId?: string }) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/remove/batch',
    method: 'post',
    data,
  });
}

/** Batch Submit Store Product Audit */
export function fetchBatchSubmitStoreProductAudit(data: { items: string[]; operationId?: string }) {
  return request<Api.Store.BatchOperationResult>({
    url: '/store/product/submit-audit/batch',
    method: 'post',
    data,
  });
}

/** Get Stock Alert Config */
export function fetchGetStockAlertConfig() {
  return request<{ threshold: number }>({
    url: '/store/product/stock-alert/config',
    method: 'get',
  });
}

/** Set Stock Alert Config */
export function fetchSetStockAlertConfig(data: { threshold: number }) {
  return request<boolean>({
    url: '/store/product/stock-alert/config',
    method: 'post',
    data,
  });
}
