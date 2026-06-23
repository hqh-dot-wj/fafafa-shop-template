import { Test, TestingModule } from '@nestjs/testing';
import { DelFlag, PublishStatus } from '@prisma/client';
import { ClientZoneService } from './client-zone.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ActivityContextTokenService } from 'src/module/marketing/resolution/services/activity-context-token.service';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { ClientSceneService } from '../scene/client-scene.service';
import { RedisService } from 'src/module/common/redis/redis.service';

describe('ClientZoneService', () => {
  let service: ClientZoneService;
  let prisma: {
    storePlayConfig: { findMany: jest.Mock };
    pmsProduct: { findMany: jest.Mock };
    umsMember: { findUnique: jest.Mock };
    mktCampaign: { findFirst: jest.Mock };
    mktCampaignParticipation: { findFirst: jest.Mock };
  };
  let tokenService: { issue: jest.Mock };
  let clientSceneService: { getSceneModules: jest.Mock };
  let redisService: { incr: jest.Mock; expire: jest.Mock; set: jest.Mock; getClient: jest.Mock };

  beforeEach(async () => {
    prisma = {
      storePlayConfig: { findMany: jest.fn() },
      pmsProduct: { findMany: jest.fn() },
      umsMember: { findUnique: jest.fn().mockResolvedValue(null) },
      mktCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
      mktCampaignParticipation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    tokenService = { issue: jest.fn((input) => `token:${input.activityType}:${input.activityConfigId}`) };
    clientSceneService = { getSceneModules: jest.fn() };
    redisService = {
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn(),
      set: jest.fn(),
      getClient: jest.fn(() => ({ sadd: jest.fn() })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientZoneService,
        { provide: ClientSceneService, useValue: clientSceneService },
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityContextTokenService, useValue: tokenService },
        { provide: RedisService, useValue: redisService },
      ],
    }).compile();

    service = module.get(ClientZoneService);
  });

  it('超级租户或未设置租户时返回空列表', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined);
    const res = await service.getZoneProducts('FLASH');
    expect(res.data).toEqual([]);
    expect(prisma.storePlayConfig.findMany).not.toHaveBeenCalled();

    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(TenantContext.SUPER_TENANT_ID);
    const res2 = await service.getZoneProducts('FLASH');
    expect(res2.data).toEqual([]);
  });

  it('有租户时按模板编码查询并返回卡片', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    prisma.storePlayConfig.findMany.mockResolvedValue([
      {
        id: 'cfg1',
        serviceId: 'p1',
        templateCode: 'FLASH',
        status: PublishStatus.ON_SHELF,
        rules: { activityName: '闪购', discountPrice: 1, originalPrice: 2, endTime: '2026-12-31T00:00:00.000Z' },
        targetSkus: [],
      },
    ]);
    prisma.pmsProduct.findMany.mockResolvedValue([{ productId: 'p1', name: '商品', mainImages: ['a.png'] }]);

    const res = await service.getZoneProducts('FLASH', 1, 10);

    expect(prisma.storePlayConfig.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't1',
          templateCode: 'FLASH',
          status: PublishStatus.ON_SHELF,
          delFlag: DelFlag.NORMAL,
          zoneEnabled: true,
        }),
      }),
    );
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.activityContextKey).toBe('token:FLASH:cfg1');
    expect(res.data?.[0]?.displayPrice).toBe(1);
  });

  it('getZoneProductsViaScene 优先返回 scene 主链路结果', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    clientSceneService.getSceneModules.mockResolvedValue({
      sceneCode: 'FLASH',
      releaseNo: 1,
      traceId: 'trace-scene-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'ZONE_FLASH',
          moduleName: '闪购专区',
          moduleType: 'PRODUCT_LIST',
          products: [
            {
              productId: 'p1',
              productName: '商品1',
              productImg: 'img.png',
              primaryOffer: {
                activityContextKey: 'FLASH:cfg1',
                activityType: 'FLASH',
                configId: 'cfg1',
                activityName: '闪购',
                displayPrice: 9.9,
                originalPrice: 19.9,
                statusSummary: 'ON_SHELF',
                countdownEndTime: '2026-12-31T00:00:00.000Z',
              },
            },
          ],
        },
      ],
    });

    const res = await service.getZoneProductsViaScene('FLASH', 'm1', 1, 10);

    expect(clientSceneService.getSceneModules).toHaveBeenCalled();
    expect(redisService.incr).toHaveBeenCalledWith(expect.stringContaining('mkt:compat:zone:cnt:'));
    expect(prisma.storePlayConfig.findMany).not.toHaveBeenCalled();
    expect(res.data).toHaveLength(1);
    expect(res.data?.[0]?.activityContextKey).toBe('FLASH:cfg1');
  });

  it('getZoneProductsViaScene scene 失败时透传异常，不回退 legacy 查询', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('t1');
    clientSceneService.getSceneModules.mockRejectedValue(new Error('scene failed'));
    await expect(service.getZoneProductsViaScene('FLASH', 'm1', 1, 10)).rejects.toThrow('scene failed');
    expect(clientSceneService.getSceneModules).toHaveBeenCalled();
    expect(redisService.incr).toHaveBeenCalledWith(expect.stringContaining('mkt:compat:zone:cnt:'));
    expect(prisma.storePlayConfig.findMany).not.toHaveBeenCalled();
  });
});
