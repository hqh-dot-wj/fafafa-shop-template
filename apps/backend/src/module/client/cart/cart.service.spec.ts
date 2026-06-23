import { Decimal } from '@prisma/client/runtime/library';
import { DelFlag, DistShareTokenStatus, PublishStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { CartService } from './cart.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CartRepository } from './cart.repository';
import { ActivityContextTokenService } from 'src/module/marketing/resolution/services/activity-context-token.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

describe('CartService', () => {
  const tenantSku = {
    id: 'sku-1',
    price: new Decimal(100),
    stock: 10,
    isActive: true,
    tenantProd: {
      tenantId: 'tenant-1',
      productId: 'product-1',
      status: PublishStatus.ON_SHELF,
      product: {
        name: '商品',
        mainImages: ['p.png'],
        delFlag: DelFlag.NORMAL,
        publishStatus: PublishStatus.ON_SHELF,
      },
    },
    globalSku: { specValues: { size: 'M' } },
  };

  let service: CartService;
  let prisma: {
    pmsTenantSku: { findFirst: jest.Mock; findMany: jest.Mock };
    omsCartItem: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
      aggregate: jest.Mock;
    };
  };
  let redis: { del: jest.Mock; hmset: jest.Mock };
  let cartRepo: { findList: jest.Mock };
  let tokenService: { verify: jest.Mock; issueForMember: jest.Mock };
  let shareTokenService: { findBySid: jest.Mock };
  let distributorEligibilityService: { isActive: jest.Mock };

  beforeEach(() => {
    prisma = {
      pmsTenantSku: { findFirst: jest.fn().mockResolvedValue(tenantSku), findMany: jest.fn() },
      omsCartItem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cart-1' }),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    redis = { del: jest.fn().mockResolvedValue(undefined), hmset: jest.fn().mockResolvedValue(undefined) };
    cartRepo = { findList: jest.fn().mockResolvedValue([]) };
    tokenService = {
      verify: jest.fn(),
      issueForMember: jest.fn().mockReturnValue('member-bound-token'),
    };
    shareTokenService = {
      findBySid: jest.fn().mockResolvedValue(null),
    };
    distributorEligibilityService = {
      isActive: jest.fn().mockResolvedValue(true),
    };
    const tenantHelper = getTenantHelperTestProvider().useValue;
    service = new CartService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      cartRepo as unknown as CartRepository,
      tenantHelper,
      tokenService as unknown as ActivityContextTokenService,
      shareTokenService as unknown as ShareTokenService,
      distributorEligibilityService as unknown as DistributorEligibilityService,
    );
  });

  it('addToCart 拒绝签名无效的 activityContextKey', async () => {
    const error = new BusinessException(ResponseCode.TOKEN_INVALID, '活动上下文签名校验失败');
    tokenService.verify.mockImplementation(() => {
      throw error;
    });

    await expect(
      service.addToCart('member-1', {
        tenantId: 'tenant-1',
        skuId: 'sku-1',
        quantity: 1,
        activityContextKey: 'bad-token',
      }),
    ).rejects.toBe(error);
    expect(prisma.pmsTenantSku.findFirst).not.toHaveBeenCalled();
  });

  it('addToCart 将匿名展示 token 绑定为当前会员 token 后入库', async () => {
    tokenService.verify.mockReturnValue({
      tenantId: 'tenant-1',
      memberId: null,
      activityType: 'FLASH',
      activityConfigId: 'cfg-1',
    });

    await service.addToCart('member-1', {
      tenantId: 'tenant-1',
      skuId: 'sku-1',
      quantity: 1,
      activityContextKey: 'anonymous-token',
    });

    expect(tokenService.verify).toHaveBeenCalledWith(
      'anonymous-token',
      { tenantId: 'tenant-1', memberId: 'member-1' },
      { allowAnonymousMember: true },
    );
    expect(tokenService.issueForMember).toHaveBeenCalledWith(expect.objectContaining({ memberId: null }), 'member-1');
    expect(prisma.omsCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityContextKey: 'member-bound-token',
          activityType: 'FLASH',
          activityConfigId: 'cfg-1',
        }),
      }),
    );
  });

  it('addToCart 只从有效 sid 写入分享人归因', async () => {
    shareTokenService.findBySid.mockResolvedValue({
      sid: 'DST_001',
      shareUserId: 'share-1',
      status: DistShareTokenStatus.ACTIVE,
    });

    await service.addToCart('member-1', {
      tenantId: 'tenant-1',
      skuId: 'sku-1',
      quantity: 1,
      sid: 'DST_001',
    });

    expect(shareTokenService.findBySid).toHaveBeenCalledWith('DST_001', 'tenant-1');
    expect(distributorEligibilityService.isActive).toHaveBeenCalledWith('tenant-1', 'share-1');
    expect(prisma.omsCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sid: 'DST_001',
          shareUserId: 'share-1',
        }),
      }),
    );
  });

  it('addToCart 静默忽略非 active 分销员的 sid', async () => {
    shareTokenService.findBySid.mockResolvedValue({
      sid: 'DST_INACTIVE',
      shareUserId: 'share-inactive',
      status: DistShareTokenStatus.ACTIVE,
    });
    distributorEligibilityService.isActive.mockResolvedValue(false);

    await service.addToCart('member-1', {
      tenantId: 'tenant-1',
      skuId: 'sku-1',
      quantity: 1,
      sid: 'DST_INACTIVE',
    });

    expect(prisma.omsCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sid: null,
          shareUserId: null,
        }),
      }),
    );
  });

  it('addToCart 忽略本人或禁用 sid，不信任客户端 shareUserId', async () => {
    shareTokenService.findBySid.mockResolvedValue({
      sid: 'DST_SELF',
      shareUserId: 'member-1',
      status: DistShareTokenStatus.ACTIVE,
    });

    await service.addToCart('member-1', {
      tenantId: 'tenant-1',
      skuId: 'sku-1',
      quantity: 1,
      sid: 'DST_SELF',
    });

    expect(prisma.omsCartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sid: null,
          shareUserId: null,
        }),
      }),
    );
  });

  it('getCartList 对坏 token 降级为无活动行返回', async () => {
    cartRepo.findList.mockResolvedValue([
      {
        id: 'cart-1',
        skuId: 'sku-1',
        productId: 'product-1',
        productName: '商品',
        productImg: 'p.png',
        specData: null,
        price: new Decimal(100),
        quantity: 1,
        shareUserId: null,
        activityContextKey: 'bad-token',
        activityType: 'FLASH',
        activityNameSnapshot: '闪购',
        displayPriceSnapshot: new Decimal(80),
      },
    ]);
    prisma.pmsTenantSku.findMany.mockResolvedValue([{ ...tenantSku, tenantProd: { ...tenantSku.tenantProd } }]);
    tokenService.verify.mockImplementation(() => {
      throw new BusinessException(ResponseCode.TOKEN_INVALID, '活动上下文签名校验失败');
    });

    const result = await service.getCartList('member-1', 'tenant-1');

    expect(result.data?.items[0]).toMatchObject({
      activityContextKey: null,
      activityType: null,
      activityNameSnapshot: null,
      displayPriceSnapshot: null,
    });
  });
});
