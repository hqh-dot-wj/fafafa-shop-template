import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { DelFlag, DistShareTokenStatus, ProductType, PublishStatus } from '@prisma/client';
import { OrderCheckoutService } from './order-checkout.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { BatchValidationService } from 'src/module/marketing/resolution/services/batch-validation.service';
import { AddressRepository } from '../../address/address.repository';
import { AdmissionService } from 'src/module/lbs/admission/admission.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

describe('OrderCheckoutService', () => {
  let service: OrderCheckoutService;

  const mockPrisma = {
    pmsTenantSku: {
      findMany: jest.fn(),
    },
    omsCartItem: {
      findMany: jest.fn(),
    },
  };

  const mockBatchValidationService = {
    validateAndLockLines: jest.fn(),
  };

  const mockAddressRepo = {
    findDefault: jest.fn().mockResolvedValue(null),
  };

  const mockAdmission = {
    isLocationInRange: jest.fn().mockResolvedValue(true),
  };

  const mockShareTokenService = {
    findBySid: jest.fn(),
  };
  const mockDistributorEligibilityService = {
    isActive: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderCheckoutService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BatchValidationService, useValue: mockBatchValidationService },
        { provide: AddressRepository, useValue: mockAddressRepo },
        { provide: AdmissionService, useValue: mockAdmission },
        { provide: ShareTokenService, useValue: mockShareTokenService },
        { provide: DistributorEligibilityService, useValue: mockDistributorEligibilityService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get(OrderCheckoutService);
    mockPrisma.omsCartItem.findMany.mockResolvedValue([]);
    mockShareTokenService.findBySid.mockResolvedValue(null);
    mockDistributorEligibilityService.isActive.mockResolvedValue(true);
  });

  describe('getCheckoutPreview', () => {
    it('无活动上下文时应按原价计算', async () => {
      const productId = 'prod_normal';
      mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
        {
          id: 'sku_t1',
          price: new Decimal(200),
          stock: 99,
          isActive: true,
          tenantProd: {
            tenantId: '000000',
            productId,
            id: 901,
            status: PublishStatus.ON_SHELF,
            product: {
              productId,
              name: '普通商品',
              type: ProductType.REAL,
              delFlag: DelFlag.NORMAL,
              publishStatus: PublishStatus.ON_SHELF,
              categoryId: 12,
              mainImages: [],
            },
          },
          globalSku: { specValues: {} },
        },
      ] as never);
      mockBatchValidationService.validateAndLockLines.mockResolvedValue([null]);

      const preview = await service.getCheckoutPreview('m1', '000000', [{ skuId: 'sku_t1', quantity: 2 }]);

      expect(preview.payAmount).toBe(400);
      expect(preview.items[0].price).toBe(200);
      expect(preview.items[0].totalAmount).toBe(400);
    });

    it('有活动上下文时应调用 ResolutionService 获取活动价', async () => {
      const productId = 'prod_activity';
      mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
        {
          id: 'sku_t2',
          price: new Decimal(200),
          stock: 99,
          isActive: true,
          tenantProd: {
            tenantId: '000000',
            productId,
            id: 902,
            status: PublishStatus.ON_SHELF,
            product: {
              productId,
              name: '活动商品',
              type: ProductType.REAL,
              delFlag: DelFlag.NORMAL,
              publishStatus: PublishStatus.ON_SHELF,
              categoryId: 12,
              mainImages: [],
            },
          },
          globalSku: { specValues: {} },
        },
      ] as never);

      mockBatchValidationService.validateAndLockLines.mockResolvedValue([
        {
          activityContextKey: 'token:FLASH_SALE:cfg1',
          activityType: 'FLASH_SALE',
          configId: 'cfg1',
          activityName: '秒杀',
          activityPrice: new Decimal(99),
          originalPrice: new Decimal(200),
          commissionMode: 'NONE',
          commissionRate: null,
          status: 'ON_SHELF',
          entrySceneCode: 'HOME',
          entryModuleCode: 'M1',
          cardTemplateCode: 'CARD_A',
          resolverPolicyCode: 'RES_A',
          resolverReleaseNo: 3,
          activityVersionId: 'activity-v1',
          attributionWindowMinutes: 4320,
          shareChannel: 'POSTER',
        },
      ]);

      const preview = await service.getCheckoutPreview('m1', '000000', [
        {
          skuId: 'sku_t2',
          quantity: 1,
          activityContextKey: 'token:FLASH_SALE:cfg1',
          entrySceneCode: 'FORGED_SCENE',
          activityVersionId: 'forged-version',
        } as never,
      ]);

      expect(mockBatchValidationService.validateAndLockLines).toHaveBeenCalled();
      expect(preview.items[0].price).toBe(99);
      expect(preview.payAmount).toBe(99);
      expect(preview.items[0]).toMatchObject({
        entrySceneCode: 'HOME',
        entryModuleCode: 'M1',
        cardTemplateCode: 'CARD_A',
        resolverPolicyCode: 'RES_A',
        resolverReleaseNoSnapshot: 3,
        activityVersionId: 'activity-v1',
        attributionWindowMinutes: 4320,
        shareChannel: 'POSTER',
      });
    });

    it('购物车结算时从 cartItemId 读取 sid 并解析服务端分享人', async () => {
      const productId = 'prod_share';
      mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
        {
          id: 'sku_share',
          price: new Decimal(120),
          stock: 99,
          isActive: true,
          tenantProd: {
            tenantId: '000000',
            productId,
            status: PublishStatus.ON_SHELF,
            product: {
              productId,
              name: '分享商品',
              type: ProductType.REAL,
              delFlag: DelFlag.NORMAL,
              publishStatus: PublishStatus.ON_SHELF,
              mainImages: [],
            },
          },
          globalSku: { specValues: {} },
        },
      ] as never);
      mockPrisma.omsCartItem.findMany.mockResolvedValue([
        {
          id: 'cart-1',
          sid: 'DST_001',
          shareUserId: 'legacy-share',
        },
      ]);
      mockShareTokenService.findBySid.mockResolvedValue({
        sid: 'DST_001',
        shareUserId: 'share-1',
        status: DistShareTokenStatus.EXPIRED,
        metadata: { shareChannel: 'POSTER' },
      });
      mockBatchValidationService.validateAndLockLines.mockResolvedValue([null]);

      const preview = await service.getCheckoutPreview('m1', '000000', [
        { cartItemId: 'cart-1', skuId: 'sku_share', quantity: 1 },
      ]);

      expect(preview.items[0]).toMatchObject({
        sid: 'DST_001',
        shareUserId: 'share-1',
        shareChannel: 'POSTER',
      });
    });

    it('购物车结算时忽略非 active 分销员的 sid', async () => {
      const productId = 'prod_share';
      mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
        {
          id: 'sku_share',
          price: new Decimal(120),
          stock: 99,
          isActive: true,
          tenantProd: {
            tenantId: '000000',
            productId,
            status: PublishStatus.ON_SHELF,
            product: {
              productId,
              name: '分享商品',
              type: ProductType.REAL,
              delFlag: DelFlag.NORMAL,
              publishStatus: PublishStatus.ON_SHELF,
              mainImages: [],
            },
          },
          globalSku: { specValues: {} },
        },
      ] as never);
      mockPrisma.omsCartItem.findMany.mockResolvedValue([
        {
          id: 'cart-1',
          sid: 'DST_INACTIVE',
          shareUserId: 'legacy-share',
        },
      ]);
      mockShareTokenService.findBySid.mockResolvedValue({
        sid: 'DST_INACTIVE',
        shareUserId: 'share-inactive',
        status: DistShareTokenStatus.ACTIVE,
        metadata: { shareChannel: 'POSTER' },
      });
      mockDistributorEligibilityService.isActive.mockResolvedValue(false);
      mockBatchValidationService.validateAndLockLines.mockResolvedValue([null]);

      const preview = await service.getCheckoutPreview('m1', '000000', [
        { cartItemId: 'cart-1', skuId: 'sku_share', quantity: 1 },
      ]);

      expect(preview.items[0]).toMatchObject({
        sid: null,
        shareUserId: null,
      });
    });
    it('多行带活动时应并行触发多次 validateAndLock', async () => {
      const productId = 'prod_multi';
      const mkSku = (skuId: string) => ({
        id: skuId,
        price: new Decimal(100),
        stock: 50,
        isActive: true,
        tenantProd: {
          tenantId: '000000',
          productId,
          id: 1,
          status: PublishStatus.ON_SHELF,
          product: {
            productId,
            name: `商品-${skuId}`,
            type: ProductType.REAL,
            delFlag: DelFlag.NORMAL,
            publishStatus: PublishStatus.ON_SHELF,
            categoryId: 1,
            mainImages: [],
          },
        },
        globalSku: { specValues: {} },
      });

      mockPrisma.pmsTenantSku.findMany.mockResolvedValue([mkSku('sku-a'), mkSku('sku-b'), mkSku('sku-c')] as never);

      mockBatchValidationService.validateAndLockLines.mockResolvedValue([
        {
          activityContextKey: 'FLASH_SALE:cfg',
          activityType: 'FLASH_SALE',
          configId: 'cfg',
          activityName: '秒',
          activityPrice: new Decimal(80),
          originalPrice: new Decimal(100),
          commissionMode: 'NONE',
          commissionRate: null,
          status: 'ON_SHELF',
        },
        {
          activityContextKey: 'FLASH_SALE:cfg',
          activityType: 'FLASH_SALE',
          configId: 'cfg',
          activityName: '秒',
          activityPrice: new Decimal(80),
          originalPrice: new Decimal(100),
          commissionMode: 'NONE',
          commissionRate: null,
          status: 'ON_SHELF',
        },
        {
          activityContextKey: 'FLASH_SALE:cfg',
          activityType: 'FLASH_SALE',
          configId: 'cfg',
          activityName: '秒',
          activityPrice: new Decimal(80),
          originalPrice: new Decimal(100),
          commissionMode: 'NONE',
          commissionRate: null,
          status: 'ON_SHELF',
        },
      ]);

      const preview = await service.getCheckoutPreview('m1', '000000', [
        { skuId: 'sku-a', quantity: 1, activityContextKey: 'FLASH_SALE:cfg' },
        { skuId: 'sku-b', quantity: 1, activityContextKey: 'FLASH_SALE:cfg' },
        { skuId: 'sku-c', quantity: 1, activityContextKey: 'FLASH_SALE:cfg' },
      ]);

      expect(mockBatchValidationService.validateAndLockLines).toHaveBeenCalledTimes(1);
      expect(preview.items).toHaveLength(3);
      expect(preview.payAmount).toBe(240);
    });
  });
});
