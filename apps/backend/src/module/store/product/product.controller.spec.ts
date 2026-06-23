import { StoreProductAuditStatus } from '@prisma/client';
import { StoreProductController } from './product.controller';
import { ListStoreProductDto } from './dto';
import type { StoreProductQueryFallbackService } from './store-product-query-fallback.service';
import type { StoreProductService } from './product.service';
import type { StockAlertService } from './stock-alert.service';

/**
 * T-1: 验证 Controller 端点均已添加 @RequirePermission 装饰器
 *
 * 通过 Reflect.getMetadata('permission', ...) 检查每个方法上的权限标识。
 */
describe('StoreProductController - @RequirePermission 权限校验', () => {
  const expectedPermissions: Record<string, string> = {
    getMarketList: 'store:product:list',
    getMarketDetail: 'store:product:query',
    importProduct: 'store:product:import',
    batchImportProducts: 'store:product:import',
    findAll: 'store:product:list',
    updateProductPrice: 'store:product:update',
    batchUpdateProductPrice: 'store:product:update',
    updateProductBase: 'store:product:update',
    removeProduct: 'store:product:update',
    getStockAlertConfig: 'store:product:query',
    setStockAlertConfig: 'store:product:update',
  };

  for (const [method, permission] of Object.entries(expectedPermissions)) {
    it(`${method} 应该有 @RequirePermission('${permission}')`, () => {
      const metadata = Reflect.getMetadata('permission', StoreProductController.prototype[method]);
      expect(metadata).toBe(permission);
    });
  }

  it('所有端点都应有权限装饰器', () => {
    const methods = Object.keys(expectedPermissions);
    expect(methods).toHaveLength(11);

    for (const method of methods) {
      const metadata = Reflect.getMetadata('permission', StoreProductController.prototype[method]);
      expect(metadata).toBeDefined();
    }
  });
});

describe('StoreProductController - 门店商品生命周期列表边界', () => {
  function createListQuery(auditStatus: StoreProductAuditStatus): ListStoreProductDto {
    const query = new ListStoreProductDto();
    query.pageNum = 1;
    query.pageSize = 10;
    query.auditStatus = auditStatus;
    return query;
  }

  function createController() {
    const productService = {
      findAll: jest.fn().mockResolvedValue({ data: { rows: [], total: 0 } }),
    };
    const fallbackService = {
      getOrLoadListResult: jest.fn((_input, loader: () => Promise<unknown>) => loader()),
    };
    const controller = new StoreProductController(
      productService as unknown as StoreProductService,
      {} as unknown as StockAlertService,
      fallbackService as unknown as StoreProductQueryFallbackService,
    );

    return { controller, productService, fallbackService };
  }

  it('商品列表固定查询已通过商品', async () => {
    const { controller, productService, fallbackService } = createController();

    await controller.findAll('tenant-1', createListQuery(StoreProductAuditStatus.DRAFT), {});

    expect(productService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ auditStatus: StoreProductAuditStatus.APPROVED }),
    );
    expect(fallbackService.getOrLoadListResult).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ auditStatus: StoreProductAuditStatus.APPROVED }),
        path: '/store/product/list',
      }),
      expect.any(Function),
    );
  });

  it('草稿箱只允许草稿和驳回状态', async () => {
    const { controller, productService } = createController();

    await controller.draftList('tenant-1', createListQuery(StoreProductAuditStatus.APPROVED), {});
    await controller.draftList('tenant-1', createListQuery(StoreProductAuditStatus.REJECTED), {});

    expect(productService.findAll).toHaveBeenNthCalledWith(
      1,
      'tenant-1',
      expect.objectContaining({ auditStatus: StoreProductAuditStatus.DRAFT }),
    );
    expect(productService.findAll).toHaveBeenNthCalledWith(
      2,
      'tenant-1',
      expect.objectContaining({ auditStatus: StoreProductAuditStatus.REJECTED }),
    );
  });

  it('审核中心固定查询待审核商品', async () => {
    const { controller, productService } = createController();

    await controller.reviewList('tenant-1', createListQuery(StoreProductAuditStatus.APPROVED), {});

    expect(productService.findAll).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ auditStatus: StoreProductAuditStatus.PENDING }),
    );
  });
});
