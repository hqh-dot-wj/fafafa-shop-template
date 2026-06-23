// quality-gate allow-request-config-test
import { describe, expect, it, vi } from 'vitest';
import {
  fetchApproveStoreProductAudit,
  fetchBatchApproveStoreProductAudit,
  fetchBatchImportProducts,
  fetchBatchUpdateProductPrice,
  fetchBatchUpsertStoreProductSkuPriceCommission,
  fetchBatchValidateStoreProductSkuPriceCommission,
  fetchDownloadStoreProductImportTemplate,
  fetchGetMarketProductDetail,
  fetchGetProductMarketList,
  fetchGetStockAlertConfig,
  fetchGetStoreProductDraftList,
  fetchGetStoreProductImportJob,
  fetchGetStoreProductList,
  fetchGetStoreProductReviewList,
  fetchGetStoreProductTemplateVersions,
  fetchImportProduct,
  fetchImportStoreProductExcel,
  fetchRejectStoreProductAudit,
  fetchRemoveProduct,
  fetchSetStockAlertConfig,
  fetchSubmitStoreProductAudit,
  fetchUpdateStoreProductBase,
  fetchUpdateStoreProductPrice,
} from './product';

vi.mock('@/service/request', () => ({
  request: vi.fn((config: unknown) => Promise.resolve({ data: config })),
}));

describe('Store Product API', () => {
  it('fetchGetStoreProductList should have correct config', async () => {
    const data = { pageNum: 1, pageSize: 10, name: null, type: null, status: null };
    const res = await fetchGetStoreProductList(data);
    expect(res.data).toMatchObject({
      url: '/store/product/list',
      method: 'post',
      data,
    });
  });

  it('fetchGetStoreProductDraftList should have correct config', async () => {
    const data = { pageNum: 1, pageSize: 10, auditStatus: 'DRAFT' };
    const res = await fetchGetStoreProductDraftList(data as any);
    expect(res.data).toMatchObject({
      url: '/store/product/draft/list',
      method: 'post',
      data,
    });
  });

  it('fetchGetStoreProductReviewList should have correct config', async () => {
    const data = { pageNum: 1, pageSize: 10, auditStatus: 'PENDING' };
    const res = await fetchGetStoreProductReviewList(data as any);
    expect(res.data).toMatchObject({
      url: '/store/product/review/list',
      method: 'post',
      data,
    });
  });

  it('fetchImportProduct should have correct config', async () => {
    const data: Api.Store.ProductImportParams = {
      productId: 'p1',
      skus: [{ globalSkuId: 's1', price: 100, stock: 10 }],
    };
    const res = await fetchImportProduct(data);
    expect(res.data).toMatchObject({
      url: '/store/product/import',
      method: 'post',
      data,
    });
  });

  it('fetchDownloadStoreProductImportTemplate should have correct config', async () => {
    const params = { categoryId: 1001 };
    const res = await fetchDownloadStoreProductImportTemplate(params);
    expect(res.data).toMatchObject({
      url: '/store/product/import-template',
      method: 'get',
      params,
      responseType: 'blob',
    });
  });

  it('fetchImportStoreProductExcel should have correct config', async () => {
    const data: Api.Store.ImportExcelParams = {
      categoryId: 1001,
      rows: [{ productId: 'p1', globalSkuId: 's1', price: 99, stock: 10 }],
    };
    const res = await fetchImportStoreProductExcel(data);
    expect(res.data).toMatchObject({
      url: '/store/product/import-excel',
      method: 'post',
      data,
    });
  });

  it('fetchGetStoreProductImportJob should have correct config', async () => {
    const jobId = 'job-001';
    const res = await fetchGetStoreProductImportJob(jobId);
    expect(res.data).toMatchObject({
      url: `/store/product/import-jobs/${jobId}`,
      method: 'get',
    });
  });

  it('fetchGetStoreProductTemplateVersions should have correct config', async () => {
    const categoryId = 1001;
    const res = await fetchGetStoreProductTemplateVersions(categoryId);
    expect(res.data).toMatchObject({
      url: '/store/product/template-versions',
      method: 'get',
      params: { categoryId },
    });
  });

  it('fetchSubmitStoreProductAudit should have correct config', async () => {
    const id = 'tp-001';
    const data = { operationId: 'op-submit-1' };
    const res = await fetchSubmitStoreProductAudit(id, data);
    expect(res.data).toMatchObject({
      url: `/store/product/${id}/submit-audit`,
      method: 'post',
      data,
    });
  });

  it('fetchApproveStoreProductAudit should have correct config', async () => {
    const id = 'tp-001';
    const data = { operationId: 'op-approve-1' };
    const res = await fetchApproveStoreProductAudit(id, data);
    expect(res.data).toMatchObject({
      url: `/store/product/${id}/audit/approve`,
      method: 'post',
      data,
    });
  });

  it('fetchBatchApproveStoreProductAudit should have correct config', async () => {
    const data = { items: ['tp-001', 'tp-002'], operationId: 'op-batch-approve-1' };
    const res = await fetchBatchApproveStoreProductAudit(data);
    expect(res.data).toMatchObject({
      url: '/store/product/audit/approve/batch',
      method: 'post',
      data,
    });
  });

  it('fetchRejectStoreProductAudit should have correct config', async () => {
    const id = 'tp-001';
    const data = { reason: '信息不完整', operationId: 'op-reject-1' };
    const res = await fetchRejectStoreProductAudit(id, data);
    expect(res.data).toMatchObject({
      url: `/store/product/${id}/audit/reject`,
      method: 'post',
      data,
    });
  });

  it('fetchUpdateStoreProductPrice should have correct config', async () => {
    const data: Api.Store.ProductPriceUpdateParams = {
      tenantSkuId: 'ts1',
      price: 99,
      stock: 5,
      distRate: 0.1,
      distMode: 'RATIO',
    };
    const res = await fetchUpdateStoreProductPrice(data);
    expect(res.data).toMatchObject({
      url: '/store/product/update-price',
      method: 'post',
      data,
    });
  });

  it('fetchUpdateStoreProductBase should have correct config', async () => {
    const data: Api.Store.ProductBaseUpdateParams = {
      id: 'tp1',
      status: 'ON_SHELF',
      customTitle: '自定义标题',
    };
    const res = await fetchUpdateStoreProductBase(data);
    expect(res.data).toMatchObject({
      url: '/store/product/update-base',
      method: 'post',
      data,
    });
  });

  it('fetchGetProductMarketList should have correct config', async () => {
    const data = { pageNum: 1, pageSize: 20, name: null, categoryId: null, type: null };
    const res = await fetchGetProductMarketList(data);
    expect(res.data).toMatchObject({
      url: '/store/market/list',
      method: 'post',
      data,
    });
  });

  it('fetchGetMarketProductDetail should have correct config', async () => {
    const productId = 'p1';
    const res = await fetchGetMarketProductDetail(productId);
    expect(res.data).toMatchObject({
      url: `/store/market/detail/${productId}`,
      method: 'get',
    });
  });

  it('fetchBatchImportProducts should have correct config', async () => {
    const data = {
      items: [
        {
          productId: 'p1',
          skus: [{ globalSkuId: 's1', price: 100, stock: 10 }],
        },
      ],
    };
    const res = await fetchBatchImportProducts(data);
    expect(res.data).toMatchObject({
      url: '/store/product/import/batch',
      method: 'post',
      data,
    });
  });

  it('fetchBatchUpdateProductPrice should have correct config', async () => {
    const data = {
      items: [
        {
          tenantSkuId: 'ts1',
          price: 99,
          stock: 5,
          distRate: 0.1,
        },
      ],
    };
    const res = await fetchBatchUpdateProductPrice(data);
    expect(res.data).toMatchObject({
      url: '/store/product/update-price/batch',
      method: 'post',
      data,
    });
  });

  it('fetchBatchValidateStoreProductSkuPriceCommission should have correct config', async () => {
    const data = {
      items: [
        {
          tenantSkuId: 'ts1',
          price: 99,
          stock: 5,
          distRate: 0.1,
        },
      ],
    };
    const res = await fetchBatchValidateStoreProductSkuPriceCommission(data);
    expect(res.data).toMatchObject({
      url: '/store/product/sku/batch-validate',
      method: 'post',
      data,
    });
  });

  it('fetchBatchUpsertStoreProductSkuPriceCommission should have correct config', async () => {
    const data = {
      items: [
        {
          tenantSkuId: 'ts1',
          price: 99,
          stock: 5,
          distRate: 0.1,
        },
      ],
    };
    const res = await fetchBatchUpsertStoreProductSkuPriceCommission(data);
    expect(res.data).toMatchObject({
      url: '/store/product/sku/batch-upsert-price-commission',
      method: 'post',
      data,
    });
  });

  it('fetchRemoveProduct should have correct config', async () => {
    const data = { id: 'tp1' };
    const res = await fetchRemoveProduct(data);
    expect(res.data).toMatchObject({
      url: '/store/product/remove',
      method: 'post',
      data,
    });
  });

  it('fetchGetStockAlertConfig should have correct config', async () => {
    const res = await fetchGetStockAlertConfig();
    expect(res.data).toMatchObject({
      url: '/store/product/stock-alert/config',
      method: 'get',
    });
  });

  it('fetchSetStockAlertConfig should have correct config', async () => {
    const data = { threshold: 10 };
    const res = await fetchSetStockAlertConfig(data);
    expect(res.data).toMatchObject({
      url: '/store/product/stock-alert/config',
      method: 'post',
      data,
    });
  });
});
