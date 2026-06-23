import { Test } from '@nestjs/testing';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { ClientSceneService } from './client-scene.service';
import { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

const ctx: UserMarketingContext = {
  tenantId: 't1',
  channel: 'MINIAPP',
  memberId: 'm1',
  isNewcomer: false,
  now: new Date(),
};

describe('ClientSceneService', () => {
  let service: ClientSceneService;
  let resolutionService: { resolveSceneView: jest.Mock };
  let prisma: { sysConfig: { findFirst: jest.Mock } };
  let tenantHelper: { readWhereForDelegate: jest.Mock };

  beforeEach(async () => {
    resolutionService = { resolveSceneView: jest.fn() };
    prisma = { sysConfig: { findFirst: jest.fn() } };
    tenantHelper = { readWhereForDelegate: jest.fn((_delegate: string, where: object) => where) };

    const module = await Test.createTestingModule({
      providers: [
        ClientSceneService,
        { provide: ResolutionService, useValue: resolutionService },
        { provide: PrismaService, useValue: prisma },
        { provide: TenantHelper, useValue: tenantHelper },
      ],
    }).compile();
    service = module.get(ClientSceneService);
  });

  beforeEach(() => {
    prisma.sysConfig.findFirst.mockReset();
    prisma.sysConfig.findFirst
      .mockResolvedValueOnce({ configValue: 'Y' })
      .mockResolvedValueOnce({ configValue: '100' });
  });

  it('场景未发布时抛出异常', async () => {
    resolutionService.resolveSceneView.mockRejectedValue(new BusinessException(400, '场景未发布'));
    const err = await service.getSceneModules('HOME_LOW_PRICE', ctx).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: '场景未发布' });
  });

  it('给定已发布场景和老客上下文时，只返回通过 AudiencePolicy 的 ProductCardView', async () => {
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_LOW_PRICE',
      releaseNo: 1,
      traceId: 'trace-scene-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'MOD_1',
          moduleName: '主模块',
          moduleType: 'PRODUCT_LIST',
          products: [{ productId: 'p2' }],
        },
      ],
    });

    const result = await service.getSceneModules('HOME_LOW_PRICE', ctx);

    expect(result.modules[0].products).toHaveLength(1);
    expect(result.modules[0].products[0].productId).toBe('p2');
  });

  it('getSceneModules 将 sceneCode 和 ctx 透传给 resolveSceneView', async () => {
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_LOW_PRICE',
      releaseNo: 1,
      traceId: 'trace-scene-1',
      source: 'scene',
      modules: [],
    });
    await service.getSceneModules('HOME_LOW_PRICE', ctx);
    expect(resolutionService.resolveSceneView).toHaveBeenCalledWith({
      sceneCode: 'HOME_LOW_PRICE',
      userContext: ctx,
    });
  });

  it('resolution 返回的 product.cardLayout 透传到结果', async () => {
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_LOW_PRICE',
      releaseNo: 2,
      traceId: 'trace-layout-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'MOD_ZONE',
          moduleName: '营销专区',
          moduleType: 'PRODUCT_LIST',
          products: [
            { productId: 'p1', cardLayout: 'overlay' },
            { productId: 'p2', cardLayout: 'split' },
            { productId: 'p3' },
          ],
        },
      ],
    });

    const result = await service.getSceneModules('HOME_LOW_PRICE', ctx);

    expect(result.modules[0].products[0]).toMatchObject({ productId: 'p1', cardLayout: 'overlay' });
    expect(result.modules[0].products[1]).toMatchObject({ productId: 'p2', cardLayout: 'split' });
    expect(result.modules[0].products[2].cardLayout).toBeUndefined();
  });

  it('resolution 返回的 uiConfig.featuredCount 透传到结果', async () => {
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_LOW_PRICE',
      releaseNo: 3,
      traceId: 'trace-featured-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'MOD_ZONE',
          moduleName: '营销专区',
          moduleType: 'PRODUCT_LIST',
          uiConfig: { featuredCount: 3, theme: 'dark' },
          products: [{ productId: 'p1' }],
        },
      ],
    });

    const result = await service.getSceneModules('HOME_LOW_PRICE', ctx);

    expect(result.modules[0].uiConfig).toEqual({ featuredCount: 3, theme: 'dark' });
  });

  it('当场景总开关为 N 时应拒绝请求', async () => {
    prisma.sysConfig.findFirst.mockReset();
    prisma.sysConfig.findFirst.mockResolvedValueOnce({ configValue: 'N' });

    const err = await service.getSceneModules('HOME_LOW_PRICE', ctx).catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(resolutionService.resolveSceneView).not.toHaveBeenCalled();
  });
});
