import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { StoreProductService } from './product.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProfitValidator } from './profit-validator';
import { TenantProductRepository } from './tenant-product.repository';
import { TenantSkuRepository } from './tenant-sku.repository';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { Decimal } from '@prisma/client/runtime/library';
import { TRANSACTIONAL_KEY } from 'src/common/decorators/transactional.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { STORE_PRODUCT_IMPORT_JOB, STORE_PRODUCT_IMPORT_QUEUE } from './store-product-import.queue.constants';

describe('StoreProductService', () => {
  let service: StoreProductService;

  const mockPrismaService = {
    pmsProduct: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    pmsTenantSku: { findFirst: jest.fn(), updateMany: jest.fn() },
    pmsCategory: { findUnique: jest.fn() },
    pmsAttrTemplateVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    pmsAttrTemplate: { findUnique: jest.fn() },
    pmsAttribute: { findMany: jest.fn() },
  };

  const mockProfitValidator = {
    validate: jest.fn(),
    validateDistRateRange: jest.fn(),
  };

  // TenantProductRepository mock
  const mockTenantProductRepo = {
    delegate: { findMany: jest.fn() },
    upsert: jest.fn(),
    findWithRelations: jest.fn(),
    findOneWithDetails: jest.fn(),
    countWithConditions: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  // TenantSkuRepository mock
  const mockTenantSkuRepo = {
    delegate: { findUnique: jest.fn(), updateMany: jest.fn() },
    upsert: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };

  const mockImportQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
    getJobCounts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreProductService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ProfitValidator, useValue: mockProfitValidator },
        { provide: TenantProductRepository, useValue: mockTenantProductRepo },
        { provide: TenantSkuRepository, useValue: mockTenantSkuRepo },
        { provide: getQueueToken(STORE_PRODUCT_IMPORT_QUEUE), useValue: mockImportQueue },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<StoreProductService>(StoreProductService);
    mockPrismaService.pmsCategory.findUnique.mockResolvedValue({ catId: 1, attrTemplateId: null });
    mockPrismaService.pmsAttrTemplateVersion.findFirst.mockResolvedValue(null);
    mockPrismaService.pmsAttrTemplateVersion.findMany.mockResolvedValue([]);
    mockImportQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0, delayed: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== T-2: importProduct @Transactional ====================

  describe('importProduct - @Transactional 装饰器', () => {
    it('应该有 @Transactional() 元数据', () => {
      const metadata = Reflect.getMetadata(TRANSACTIONAL_KEY, StoreProductService.prototype.importProduct);
      expect(metadata).toBeDefined();
      expect(metadata.isolationLevel).toBe('ReadCommitted');
    });
  });

  describe('importProduct - 业务逻辑', () => {
    const mockGlobalProduct = {
      productId: 'p1',
      categoryId: 1,
      publishStatus: 'ON_SHELF',
      globalSkus: [{ skuId: 'gs1', costPrice: new Decimal(50), guideRate: new Decimal(0.15), distMode: 'RATIO' }],
    };

    const mockTenantProduct = { id: 'tp1', tenantId: 't1', productId: 'p1', status: 'OFF_SHELF' };

    it('应该成功导入商品（含SKU）', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(mockGlobalProduct);
      mockTenantProductRepo.upsert.mockResolvedValue(mockTenantProduct);
      mockTenantSkuRepo.upsert.mockResolvedValue({});

      const dto = {
        productId: 'p1',
        overrideRadius: 5000,
        skus: [{ globalSkuId: 'gs1', price: 100, stock: 50, distMode: 'RATIO', distRate: 0.15 }],
      };

      const result = await service.importProduct('t1', dto);

      expect(result.data).toEqual(mockTenantProduct);
      expect(mockTenantProductRepo.upsert).toHaveBeenCalled();
      expect(mockTenantSkuRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantProductId_globalSkuId: { tenantProductId: 'tp1', globalSkuId: 'gs1' } },
          create: expect.objectContaining({ globalSkuId: 'gs1' }),
          update: expect.objectContaining({ stock: 50 }),
        }),
      );
      expect(mockProfitValidator.validate).toHaveBeenCalled();
      expect(mockProfitValidator.validateDistRateRange).toHaveBeenCalled();
    });

    it('应该成功导入商品（不含SKU）', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(mockGlobalProduct);
      mockTenantProductRepo.upsert.mockResolvedValue(mockTenantProduct);

      const result = await service.importProduct('t1', { productId: 'p1', skus: [] });

      expect(result.data).toEqual(mockTenantProduct);
      expect(mockTenantSkuRepo.upsert).not.toHaveBeenCalled();
    });

    it('应该抛出异常 - 商品不存在', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(null);
      await expect(service.importProduct('t1', { productId: 'invalid', skus: [] })).rejects.toThrow(BusinessException);
    });

    it('应该在总部商品未上架时拒绝导入', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue({
        ...mockGlobalProduct,
        publishStatus: 'OFF_SHELF',
      });
      await expect(service.importProduct('t1', { productId: 'p1', skus: [] })).rejects.toThrow(BusinessException);
    });

    it('应该抛出异常 - 无效的SKU ID', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(mockGlobalProduct);
      const dto = { productId: 'p1', skus: [{ globalSkuId: 'bad-sku', price: 100, stock: 50 }] };
      await expect(service.importProduct('t1', dto)).rejects.toThrow(BusinessException);
    });

    it('重新导入时应该 upsert 更新已有 SKU（T-9）', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(mockGlobalProduct);
      mockTenantProductRepo.upsert.mockResolvedValue(mockTenantProduct);
      mockTenantSkuRepo.upsert.mockResolvedValue({ id: 'ts1', price: 120 });

      const dto = {
        productId: 'p1',
        skus: [{ globalSkuId: 'gs1', price: 120, stock: 80, distMode: 'RATIO', distRate: 0.15 }],
      };

      await service.importProduct('t1', dto);

      // 验证 upsert 的 update 部分包含新价格和库存
      expect(mockTenantSkuRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            price: expect.any(Decimal),
            stock: 80,
          }),
        }),
      );
    });
  });

  // ==================== T-7: batchImportProducts ====================

  describe('batchImportProducts', () => {
    const mockGlobalProduct = {
      productId: 'p1',
      categoryId: 1,
      publishStatus: 'ON_SHELF',
      globalSkus: [{ skuId: 'gs1', costPrice: new Decimal(50), guideRate: new Decimal(0.15), distMode: 'RATIO' }],
    };
    const mockTenantProduct = { id: 'tp1', tenantId: 't1', productId: 'p1', status: 'OFF_SHELF' };

    it('应该全部成功导入', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValue(mockGlobalProduct);
      mockTenantProductRepo.upsert.mockResolvedValue(mockTenantProduct);
      mockTenantSkuRepo.upsert.mockResolvedValue({});

      const dto = {
        items: [
          { productId: 'p1', skus: [{ globalSkuId: 'gs1', price: 100, stock: 50 }] },
          { productId: 'p1', skus: [] },
        ],
      };

      const result = await service.batchImportProducts('t1', dto);

      expect(result.data).toEqual({
        successCount: 2,
        failCount: 0,
        details: [
          { id: 'p1', success: true },
          { id: 'p1', success: true },
        ],
      });
      expect(result.msg).toContain('成功 2 个');
    });

    it('应该部分成功、部分失败并返回错误明细', async () => {
      mockPrismaService.pmsProduct.findUnique.mockResolvedValueOnce(mockGlobalProduct).mockResolvedValueOnce(null);

      mockTenantProductRepo.upsert.mockResolvedValue(mockTenantProduct);
      mockTenantSkuRepo.upsert.mockResolvedValue({});

      const dto = {
        items: [
          { productId: 'p1', skus: [] },
          { productId: 'invalid', skus: [] },
        ],
      };

      const result = await service.batchImportProducts('t1', dto);

      expect(result.data?.successCount).toBe(1);
      expect(result.data?.failCount).toBe(1);
      expect(result.data?.details).toHaveLength(2);
      expect(result.data?.details?.[0]?.success).toBe(true);
      expect(result.data?.details?.[1]?.success).toBe(false);
      expect(result.data?.details?.[1]?.id).toBe('invalid');
      expect(result.data?.details?.[1]?.error).toBeDefined();
    });
  });

  describe('template versions', () => {
    it('getTemplateVersions 在分类无模板时应返回空数组', async () => {
      mockPrismaService.pmsCategory.findUnique.mockResolvedValue({ catId: 1, attrTemplateId: null });
      const result = await service.getTemplateVersions(1);
      expect(result.data).toEqual([]);
    });
  });

  // ==================== T-10: batchUpdateProductPrice ====================

  describe('batchUpdateProductPrice', () => {
    const mockSku = {
      id: 'sku1',
      price: 100,
      version: 5,
      distMode: 'RATIO',
      distRate: new Decimal(0.15),
      tenantProd: { tenantId: 't1' },
      globalSku: { costPrice: new Decimal(50) },
    };

    it('应该全部成功调价', async () => {
      mockPrismaService.pmsTenantSku.findFirst
        .mockResolvedValueOnce(mockSku)
        .mockResolvedValueOnce({ ...mockSku, price: 120, version: 6 })
        .mockResolvedValueOnce(mockSku)
        .mockResolvedValueOnce({ ...mockSku, price: 130, version: 6 });
      mockPrismaService.pmsTenantSku.updateMany.mockResolvedValue({ count: 1 });

      const dto = {
        items: [
          { tenantSkuId: 'sku1', price: 120, stock: 50, distRate: 0.15 },
          { tenantSkuId: 'sku1', price: 130, stock: 60, distRate: 0.15 },
        ],
      };

      const result = await service.batchUpdateProductPrice('t1', dto);

      expect(result.data).toEqual({
        successCount: 2,
        failCount: 0,
        details: [
          { id: 'sku1', success: true },
          { id: 'sku1', success: true },
        ],
      });
      expect(result.msg).toContain('成功 2 个');
    });

    it('应该部分成功、部分失败并返回错误明细', async () => {
      mockPrismaService.pmsTenantSku.findFirst
        .mockResolvedValueOnce(mockSku)
        .mockResolvedValueOnce({ ...mockSku, price: 120, version: 6 })
        .mockResolvedValueOnce(null);

      mockPrismaService.pmsTenantSku.updateMany.mockResolvedValue({ count: 1 });

      const dto = {
        items: [
          { tenantSkuId: 'sku1', price: 120, stock: 50, distRate: 0.15 },
          { tenantSkuId: 'invalid-sku', price: 100, stock: 10, distRate: 0.15 },
        ],
      };

      const result = await service.batchUpdateProductPrice('t1', dto);

      expect(result.data?.successCount).toBe(1);
      expect(result.data?.failCount).toBe(1);
      expect(result.data?.details).toHaveLength(2);
      expect(result.data?.details?.[0]?.success).toBe(true);
      expect(result.data?.details?.[1]?.success).toBe(false);
      expect(result.data?.details?.[1]?.id).toBe('invalid-sku');
      expect(result.data?.details?.[1]?.error).toBeDefined();
    });
  });

  describe('batchSkuPriceCommission', () => {
    const editableSku = {
      id: 'sku-editable',
      price: 100,
      version: 5,
      distMode: 'RATIO',
      distRate: new Decimal(0.15),
      tenantProd: { tenantId: 't1', auditStatus: 'DRAFT' },
      globalSku: { costPrice: new Decimal(50) },
    };

    it('batchValidateSkuPriceCommission 应返回校验回执', async () => {
      mockPrismaService.pmsTenantSku.findFirst
        .mockResolvedValueOnce(editableSku)
        .mockResolvedValueOnce({ ...editableSku, tenantProd: { tenantId: 't1', auditStatus: 'APPROVED' } });

      const result = await service.batchValidateSkuPriceCommission('t1', {
        items: [
          { tenantSkuId: 'sku-editable', price: 120, stock: 10, distRate: 0.1 },
          { tenantSkuId: 'sku-locked', price: 120, stock: 10, distRate: 0.1 },
        ],
      });

      expect(result.data.successCount).toBe(1);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details[0]).toMatchObject({ id: 'sku-editable', success: true });
      expect(result.data.details[1]).toMatchObject({ id: 'sku-locked', success: false });
    });

    it('batchUpsertSkuPriceCommission 应在允许状态下执行批量更新', async () => {
      mockPrismaService.pmsTenantSku.findFirst.mockResolvedValue(editableSku);
      const updateSpy = jest.spyOn(service, 'updateProductPrice').mockResolvedValue({
        code: ResponseCode.SUCCESS,
        msg: 'ok',
        data: {} as any,
      });

      const result = await service.batchUpsertSkuPriceCommission('t1', {
        items: [
          { tenantSkuId: 'sku-editable', price: 120, stock: 10, distRate: 0.1 },
          { tenantSkuId: 'sku-editable', price: 130, stock: 20, distRate: 0.2 },
        ],
      });

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(result.data).toMatchObject({
        successCount: 2,
        failCount: 0,
      });
    });
  });

  // ==================== T-6: updateProductPrice @Transactional ====================

  describe('updateProductPrice - @Transactional 装饰器', () => {
    it('应该有 @Transactional() 元数据', () => {
      const metadata = Reflect.getMetadata(TRANSACTIONAL_KEY, StoreProductService.prototype.updateProductPrice);
      expect(metadata).toBeDefined();
      expect(metadata.isolationLevel).toBe('ReadCommitted');
    });
  });

  // ==================== updateProductPrice 乐观锁 ====================

  describe('updateProductPrice - 乐观锁', () => {
    const mockSku = {
      id: 'sku1',
      price: 100,
      version: 5,
      distMode: 'RATIO',
      distRate: new Decimal(0.15),
      tenantProd: { tenantId: 't1' },
      globalSku: { costPrice: new Decimal(50) },
    };

    it('应该成功更新价格 - 版本号匹配', async () => {
      mockPrismaService.pmsTenantSku.findFirst
        .mockResolvedValueOnce(mockSku) // 第一次查询
        .mockResolvedValueOnce({ ...mockSku, price: 120, version: 6 }); // 更新后查询
      mockPrismaService.pmsTenantSku.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.updateProductPrice('t1', { tenantSkuId: 'sku1', price: 120 });

      expect(result.data.price).toBe(120);
      expect(result.data.version).toBe(6);
      expect(mockProfitValidator.validate).toHaveBeenCalledWith(120, mockSku.globalSku.costPrice, 0.15, 'RATIO');
    });

    it('应该抛出异常 - SKU不存在', async () => {
      mockPrismaService.pmsTenantSku.findFirst.mockResolvedValue(null);
      await expect(service.updateProductPrice('t1', { tenantSkuId: 'sku1', price: 120 })).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该抛出异常 - 无权操作(tenantId不匹配)', async () => {
      mockPrismaService.pmsTenantSku.findFirst.mockResolvedValue({
        ...mockSku,
        tenantProd: { tenantId: 'other-tenant' },
      });
      await expect(service.updateProductPrice('t1', { tenantSkuId: 'sku1', price: 120 })).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该抛出异常 - 版本号不匹配(并发冲突)', async () => {
      mockPrismaService.pmsTenantSku.findFirst.mockResolvedValue(mockSku);
      mockPrismaService.pmsTenantSku.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.updateProductPrice('t1', { tenantSkuId: 'sku1', price: 120 })).rejects.toThrow(
        new BusinessException(ResponseCode.CONFLICT, '更新失败,数据已被修改,请重试'),
      );
    });

    it('应该抛出异常 - 利润不足', async () => {
      mockPrismaService.pmsTenantSku.findFirst.mockResolvedValue(mockSku);
      mockProfitValidator.validate.mockImplementation(() => {
        throw new BusinessException(ResponseCode.PARAM_INVALID, '价格过低,利润不足');
      });

      await expect(service.updateProductPrice('t1', { tenantSkuId: 'sku1', price: 55 })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  // ==================== T-3: findAll HQ 跨店权限校验 ====================

  describe('findAll - HQ 跨店权限校验', () => {
    const mockListItem = {
      id: 'tp1',
      productId: 'p1',
      status: 'ON_SHELF',
      isHot: false,
      customTitle: null,
      overrideRadius: null,
      product: { name: '测试商品', mainImages: ['img1.jpg'], type: 'NORMAL' },
      skus: [
        {
          id: 'ts1',
          price: new Decimal(100),
          stock: 50,
          distMode: 'RATIO',
          distRate: new Decimal(0.15),
          isActive: true,
          globalSku: { specValues: '红色', costPrice: new Decimal(50), guidePrice: new Decimal(80) },
        },
      ],
    };

    it('普通门店查询自己的商品 - 应该成功', async () => {
      mockTenantProductRepo.findWithRelations.mockResolvedValue([mockListItem]);
      mockTenantProductRepo.countWithConditions.mockResolvedValue(1);

      const result = await service.findAll('t1', { skip: 0, take: 10 });

      expect(result.data.rows).toHaveLength(1);
      expect(result.data.total).toBe(1);
    });

    it('普通门店传入自己的 storeId - 应该成功', async () => {
      mockTenantProductRepo.findWithRelations.mockResolvedValue([mockListItem]);
      mockTenantProductRepo.countWithConditions.mockResolvedValue(1);

      const result = await service.findAll('t1', { storeId: 't1', skip: 0, take: 10 });

      expect(result.data.rows).toHaveLength(1);
    });

    it('普通门店传入其他门店 storeId - 非超管应该被拒绝', async () => {
      jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(false);

      await expect(service.findAll('t1', { storeId: 'other-store', skip: 0, take: 10 })).rejects.toThrow(
        BusinessException,
      );
    });

    it('超管传入其他门店 storeId - 应该成功', async () => {
      jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(true);
      mockTenantProductRepo.findWithRelations.mockResolvedValue([mockListItem]);
      mockTenantProductRepo.countWithConditions.mockResolvedValue(1);

      const result = await service.findAll('t1', { storeId: 'other-store', skip: 0, take: 10 });

      expect(result.data.rows).toHaveLength(1);
    });
  });

  // ==================== T-5: updateProductBase 使用 Repository ====================

  describe('updateProductBase - Repository 层', () => {
    const mockTenantProduct = {
      id: 'tp1',
      tenantId: 't1',
      productId: 'p1',
      status: 'OFF_SHELF',
      auditStatus: 'APPROVED',
      syncBlockedReason: null,
    };

    it('应该成功更新商品基础信息', async () => {
      mockTenantProductRepo.findById.mockResolvedValue(mockTenantProduct);
      mockTenantProductRepo.update.mockResolvedValue({
        ...mockTenantProduct,
        status: 'ON_SHELF',
        customTitle: '新标题',
      });

      const result = await service.updateProductBase('t1', {
        id: 'tp1',
        status: 'ON_SHELF',
        customTitle: '新标题',
      });

      expect(result.data).toBe(true);
      expect(mockTenantProductRepo.findById).toHaveBeenCalledWith('tp1');
      expect(mockTenantProductRepo.update).toHaveBeenCalledWith('tp1', {
        status: 'ON_SHELF',
        customTitle: '新标题',
      });
    });

    it('应该抛出异常 - 商品不存在', async () => {
      mockTenantProductRepo.findById.mockResolvedValue(null);
      await expect(service.updateProductBase('t1', { id: 'invalid' })).rejects.toThrow(BusinessException);
    });

    it('应该抛出异常 - 无权操作(tenantId不匹配)', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({ ...mockTenantProduct, tenantId: 'other-tenant' });
      await expect(service.updateProductBase('t1', { id: 'tp1', status: 'ON_SHELF' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该在商品未审核通过时禁止上架', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({
        ...mockTenantProduct,
        auditStatus: 'PENDING',
      });

      await expect(service.updateProductBase('t1', { id: 'tp1', status: 'ON_SHELF' })).rejects.toThrow(
        BusinessException,
      );
    });

    it('应该在同步阻断存在时禁止上架', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({
        ...mockTenantProduct,
        syncBlockedReason: '总部商品已下架',
      });

      await expect(service.updateProductBase('t1', { id: 'tp1', status: 'ON_SHELF' })).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe('审核流转', () => {
    it('提交审核时应从草稿流转为待审核', async () => {
      mockTenantProductRepo.findOneWithDetails.mockResolvedValue({
        id: 'tp1',
        tenantId: 't1',
        auditStatus: 'DRAFT',
        product: { publishStatus: 'ON_SHELF' },
        skus: [{ price: 99 }],
      });
      mockTenantProductRepo.update.mockResolvedValue({
        id: 'tp1',
        auditStatus: 'PENDING',
      });

      const result = await service.submitAudit('t1', 'tp1');
      expect(result.data.auditStatus).toBe('PENDING');
    });

    it('审核通过时应从待审核变为已通过', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({
        id: 'tp1',
        auditStatus: 'PENDING',
      });
      mockTenantProductRepo.update.mockResolvedValue({
        id: 'tp1',
        auditStatus: 'APPROVED',
      });

      const result = await service.approveAudit('tp1', '1001');
      expect(result.data.auditStatus).toBe('APPROVED');
    });

    it('批量审核通过应返回成功/失败统计', async () => {
      const spy = jest.spyOn(service, 'approveAudit').mockImplementation(async (id: string) => {
        if (id === 'tp2') {
          throw new BusinessException(ResponseCode.BUSINESS_ERROR, '仅待审核商品可执行通过');
        }
        return {
          code: ResponseCode.SUCCESS,
          msg: 'ok',
          data: { id, auditStatus: 'APPROVED' } as any,
        };
      });

      const result = await service.batchApproveAudit({ items: ['tp1', 'tp2', 'tp3'] }, '1001');

      expect(spy).toHaveBeenCalledTimes(3);
      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(1);
      expect(result.data.details).toMatchObject([
        { id: 'tp1', success: true },
        { id: 'tp2', success: false, error: expect.any(String) },
        { id: 'tp3', success: true },
      ]);
    });

    it('审核驳回时应写入驳回原因', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({
        id: 'tp1',
        auditStatus: 'PENDING',
      });
      mockTenantProductRepo.update.mockResolvedValue({
        id: 'tp1',
        auditStatus: 'REJECTED',
        auditReason: '资料不完整',
      });

      const result = await service.rejectAudit('tp1', '1001', '资料不完整');
      expect(result.data.auditStatus).toBe('REJECTED');
      expect(result.data.auditReason).toBe('资料不完整');
    });
  });

  describe('Excel 导入回执', () => {
    it('importExcel 应入队并返回待处理任务', async () => {
      mockImportQueue.add.mockResolvedValue({ id: 'job-1' });

      const importResult = await service.importExcel('t1', {
        categoryId: 1,
        rows: [
          {
            rowNo: 2,
            productId: 'p1',
            globalSkuId: 'gs1',
            price: 99,
            stock: 10,
            distRate: 0.1,
            distMode: 'RATIO',
          },
        ],
      });

      expect(importResult.code).toBe(ResponseCode.SUCCESS);
      expect(importResult.data.status).toBe('PENDING');
      expect(importResult.data.acceptedRows).toBe(1);
      expect(mockImportQueue.add).toHaveBeenCalledWith(
        STORE_PRODUCT_IMPORT_JOB,
        expect.objectContaining({
          tenantId: 't1',
        }),
        expect.objectContaining({
          jobId: expect.any(String),
        }),
      );
    });

    it('importExcel 在队列积压超限时应拒绝', async () => {
      mockImportQueue.getJobCounts.mockResolvedValue({ waiting: 6000, active: 10, delayed: 0 });

      await expect(
        service.importExcel('t1', {
          categoryId: 1,
          rows: [
            {
              rowNo: 2,
              productId: 'p1',
              globalSkuId: 'gs1',
              price: 99,
              stock: 10,
              distRate: 0.1,
              distMode: 'RATIO',
            },
          ],
        }),
      ).rejects.toThrow(BusinessException);
      expect(mockImportQueue.add).not.toHaveBeenCalled();
    });

    it('processImportExcelJob 应返回成功/失败统计', async () => {
      jest.spyOn(service, 'importProduct').mockResolvedValue({
        code: ResponseCode.SUCCESS,
        msg: 'ok',
        data: {} as any,
      });

      const result = await service.processImportExcelJob({
        tenantId: 't1',
        queuedAt: new Date().toISOString(),
        request: {
          categoryId: 1,
          rows: [
            {
              rowNo: 2,
              productId: 'p1',
              globalSkuId: 'gs1',
              price: 99,
              stock: 10,
              distRate: 0.1,
              distMode: 'RATIO',
            },
          ],
        },
      });

      expect(result.successCount).toBe(1);
      expect(result.failCount).toBe(0);
      expect(result.details[0].skuCode).toBe('gs1');
    });

    it('getImportJob 在完成态应返回导入统计', async () => {
      mockImportQueue.getJob.mockResolvedValue({
        data: { tenantId: 't1' },
        timestamp: Date.now(),
        finishedOn: Date.now(),
        progress: jest.fn().mockReturnValue(100),
        getState: jest.fn().mockResolvedValue('completed'),
        returnvalue: {
          successCount: 1,
          failCount: 0,
          details: [{ rowNo: 2, skuCode: 'gs1', success: true }],
          finishedAt: new Date().toISOString(),
        },
      });

      const receipt = await service.getImportJob('t1', 'job-1');
      expect(receipt.code).toBe(ResponseCode.SUCCESS);
      expect(receipt.data.status).toBe('DONE');
      expect(receipt.data.successCount).toBe(1);
      expect(receipt.data.details[0].skuCode).toBe('gs1');
    });

    it('getImportJob 在租户不匹配时应拒绝', async () => {
      mockImportQueue.getJob.mockResolvedValue({
        data: { tenantId: 'other-tenant' },
        timestamp: Date.now(),
        progress: jest.fn().mockReturnValue(0),
        getState: jest.fn().mockResolvedValue('waiting'),
      });

      await expect(service.getImportJob('t1', 'job-x')).rejects.toThrow(BusinessException);
    });
  });

  // ==================== T-8: removeProduct 移除商品 ====================

  describe('batchSubmitAudit - 批量提交审核', () => {
    it('应返回批量提交成功/失败统计', async () => {
      const spy = jest.spyOn(service, 'submitAudit').mockImplementation(async (_tenantId: string, id: string) => {
        if (id === 'tp2') {
          throw new BusinessException(ResponseCode.BUSINESS_ERROR, '当前状态不可提交审核');
        }
        return {
          code: ResponseCode.SUCCESS,
          msg: 'ok',
          data: { id, auditStatus: 'PENDING' } as any,
        };
      });

      const result = await service.batchSubmitAudit('t1', { items: ['tp1', 'tp2', 'tp3'] });
      expect(spy).toHaveBeenCalledTimes(3);
      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(1);
    });
  });

  describe('removeProduct - 移除商品', () => {
    it('应该有 @Transactional() 元数据', () => {
      const metadata = Reflect.getMetadata(TRANSACTIONAL_KEY, StoreProductService.prototype.removeProduct);
      expect(metadata).toBeDefined();
    });

    it('应该成功移除下架状态的商品', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({ id: 'tp1', tenantId: 't1', status: 'OFF_SHELF' });
      mockTenantSkuRepo.deleteMany.mockResolvedValue({ count: 2 });
      mockTenantProductRepo.delete.mockResolvedValue({ id: 'tp1' });

      const result = await service.removeProduct('t1', { id: 'tp1' });

      expect(result.msg).toBe('商品已移除');
      expect(mockTenantSkuRepo.deleteMany).toHaveBeenCalledWith({ tenantProductId: 'tp1' });
      expect(mockTenantProductRepo.delete).toHaveBeenCalledWith('tp1');
    });

    it('应该抛出异常 - 商品不存在', async () => {
      mockTenantProductRepo.findById.mockResolvedValue(null);
      await expect(service.removeProduct('t1', { id: 'invalid' })).rejects.toThrow(BusinessException);
    });

    it('应该抛出异常 - 无权操作', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({ id: 'tp1', tenantId: 'other', status: 'OFF_SHELF' });
      await expect(service.removeProduct('t1', { id: 'tp1' })).rejects.toThrow(BusinessException);
    });

    it('应该抛出异常 - 商品处于上架状态', async () => {
      mockTenantProductRepo.findById.mockResolvedValue({ id: 'tp1', tenantId: 't1', status: 'ON_SHELF' });
      await expect(service.removeProduct('t1', { id: 'tp1' })).rejects.toThrow(BusinessException);
    });
  });

  describe('batchRemoveProducts - 批量移除商品', () => {
    it('应返回批量移除成功/失败统计', async () => {
      const spy = jest.spyOn(service, 'removeProduct').mockImplementation(async (_tenantId: string, dto: { id: string }) => {
        if (dto.id === 'tp2') {
          throw new BusinessException(ResponseCode.BUSINESS_ERROR, '商品处于上架状态，请先下架');
        }
        return {
          code: ResponseCode.SUCCESS,
          msg: 'ok',
          data: null,
        };
      });

      const result = await service.batchRemoveProducts('t1', { items: ['tp1', 'tp2', 'tp3'] });
      expect(spy).toHaveBeenCalledTimes(3);
      expect(result.data.successCount).toBe(2);
      expect(result.data.failCount).toBe(1);
    });
  });
});
