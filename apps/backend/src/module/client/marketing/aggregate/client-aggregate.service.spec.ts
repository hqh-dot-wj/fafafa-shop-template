import { Test, TestingModule } from '@nestjs/testing';
import { DelFlag, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ClientAggregateService } from './client-aggregate.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { RedisService } from 'src/module/common/redis/redis.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { ClientSceneService } from '../scene/client-scene.service';

describe('ClientAggregateService', () => {
  let service: ClientAggregateService;
  let prisma: {
    storePlayConfig: { findMany: jest.Mock; groupBy: jest.Mock };
    pmsProduct: { findMany: jest.Mock };
    umsMember: { findUnique: jest.Mock };
    mktCampaign: { findFirst: jest.Mock };
    mktCampaignParticipation: { findFirst: jest.Mock };
    sysConfig: { findFirst: jest.Mock };
  };
  let resolutionService: { resolveMainActivity: jest.Mock; resolveMainActivitiesBatch: jest.Mock };
  let redisService: { incr: jest.Mock; expire: jest.Mock; set: jest.Mock; getClient: jest.Mock };
  let tenantHelper: { readWhereForDelegate: jest.Mock };
  let clientSceneService: { getSceneModules: jest.Mock };

  beforeEach(async () => {
    prisma = {
      storePlayConfig: { findMany: jest.fn(), groupBy: jest.fn() },
      pmsProduct: { findMany: jest.fn() },
      umsMember: { findUnique: jest.fn().mockResolvedValue(null) },
      mktCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
      mktCampaignParticipation: { findFirst: jest.fn().mockResolvedValue(null) },
      sysConfig: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    resolutionService = { resolveMainActivity: jest.fn(), resolveMainActivitiesBatch: jest.fn() };
    redisService = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
      set: jest.fn(),
      getClient: jest.fn(() => ({ sadd: jest.fn() })),
    };
    tenantHelper = { readWhereForDelegate: jest.fn((_m: string, w: object) => w) };
    clientSceneService = { getSceneModules: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientAggregateService,
        { provide: ClientSceneService, useValue: clientSceneService },
        { provide: PrismaService, useValue: prisma },
        { provide: ResolutionService, useValue: resolutionService },
        { provide: RedisService, useValue: redisService },
        { provide: TenantHelper, useValue: tenantHelper },
      ],
    }).compile();

    service = module.get(ClientAggregateService);
  });

  it('超级租户或未设置租户时走平台聚合：groupBy 无结果则空列表', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);
    prisma.storePlayConfig.groupBy.mockResolvedValue([]);
    const res = await service.getAggregateProducts('m1');
    expect(res.data).toEqual([]);
    expect(prisma.storePlayConfig.groupBy).toHaveBeenCalled();
    expect(prisma.pmsProduct.findMany).not.toHaveBeenCalled();

    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(TenantContext.SUPER_TENANT_ID);
    prisma.storePlayConfig.groupBy.mockResolvedValue([]);
    const res2 = await service.getAggregateProducts('m1');
    expect(res2.data).toEqual([]);
  });

  it('超级租户有跨店玩法配置时组装卡片', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(TenantContext.SUPER_TENANT_ID);
    prisma.storePlayConfig.groupBy.mockResolvedValue([{ serviceId: 'p1' }]);
    prisma.storePlayConfig.findMany.mockResolvedValueOnce([{ serviceId: 'p1', tenantId: 't1' }]);
    prisma.pmsProduct.findMany.mockResolvedValue([{ productId: 'p1', name: '商品', mainImages: ['img.png'] }]);
    const activityMap = new Map();
    activityMap.set('p1', {
      activityContextKey: 'FLASH:c1',
      activityType: 'FLASH',
      configId: 'c1',
      activityName: '闪购',
      activityPrice: new Decimal('9.9'),
      originalPrice: new Decimal('19.9'),
      status: PublishStatus.ON_SHELF,
      endTime: null,
      remainingStock: 3,
    });
    resolutionService.resolveMainActivitiesBatch.mockResolvedValue(activityMap);

    const res = await service.getAggregateProducts('m1', 1, 10);

    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.productId).toBe('p1');
    expect(resolutionService.resolveMainActivitiesBatch).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', memberId: 'm1', productIds: ['p1'] }),
    );
  });

  it('有租户时查询配置并组装卡片', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    prisma.storePlayConfig.findMany.mockResolvedValue([{ serviceId: 'p1' }]);
    prisma.pmsProduct.findMany.mockResolvedValue([{ productId: 'p1', name: '商品', mainImages: ['img.png'] }]);
    const activityMap = new Map();
    activityMap.set('p1', {
      activityContextKey: 'FLASH:c1',
      activityType: 'FLASH',
      configId: 'c1',
      activityName: '闪购',
      activityPrice: new Decimal('9.9'),
      originalPrice: new Decimal('19.9'),
      status: PublishStatus.ON_SHELF,
      endTime: null,
      remainingStock: 3,
    });
    resolutionService.resolveMainActivitiesBatch.mockResolvedValue(activityMap);

    const res = await service.getAggregateProducts('m1', 1, 10);

    expect(prisma.storePlayConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't1',
          status: PublishStatus.ON_SHELF,
          delFlag: DelFlag.NORMAL,
          aggregateEnabled: true,
        }),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.productId).toBe('p1');
    expect(res.data?.[0]?.mainActivity.displayPrice).toBe(9.9);
  });

  it('getAggregateProductsViaScene 优先返回 scene 主链路映射结果', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    clientSceneService.getSceneModules.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      releaseNo: 1,
      traceId: 'trace-scene-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'MOD_1',
          moduleName: '精选',
          moduleType: 'PRODUCT_LIST',
          products: [
            {
              productId: 'p1',
              productName: '商品1',
              productImg: 'img.png',
              primaryOffer: {
                activityContextKey: 'FLASH:c1',
                activityType: 'FLASH',
                configId: 'c1',
                activityName: '闪购',
                displayPrice: 9.9,
                originalPrice: 19.9,
                statusSummary: 'ON_SHELF',
              },
            },
          ],
        },
      ],
    });

    const res = await service.getAggregateProductsViaScene('m1', 1, 10);

    expect(clientSceneService.getSceneModules).toHaveBeenCalled();
    expect(redisService.incr).toHaveBeenCalledWith(expect.stringContaining('mkt:compat:aggregate:cnt:'));
    expect(resolutionService.resolveMainActivitiesBatch).not.toHaveBeenCalled();
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.productId).toBe('p1');
    expect(res.data?.[0]?.mainActivity.activityContextKey).toBe('FLASH:c1');
  });

  it('getAggregateProductsViaScene scene 失败时透传异常，不回退 legacy 聚合链路', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    clientSceneService.getSceneModules.mockRejectedValue(new Error('scene failed'));
    await expect(service.getAggregateProductsViaScene('m1', 1, 10)).rejects.toThrow('scene failed');
    expect(clientSceneService.getSceneModules).toHaveBeenCalled();
    expect(redisService.incr).toHaveBeenCalledWith(expect.stringContaining('mkt:compat:aggregate:cnt:'));
    expect(prisma.storePlayConfig.findMany).not.toHaveBeenCalled();
    expect(resolutionService.resolveMainActivitiesBatch).not.toHaveBeenCalled();
  });
});
