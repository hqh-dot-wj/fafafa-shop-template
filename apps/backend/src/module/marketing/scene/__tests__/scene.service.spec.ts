import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantContext } from 'src/common/tenant';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketingEventType } from '../../events/marketing-event.types';
import { ResolutionService } from '../../resolution/resolution.service';
import { MarketingSceneService } from '../scene.service';
import { MarketingSceneRepository } from '../scene.repository';

type MockedSceneRepository = jest.Mocked<
  Pick<
    MarketingSceneRepository,
    | 'findSceneGraph'
    | 'findPoliciesByCodes'
    | 'nextReleaseNo'
    | 'createRelease'
    | 'createScene'
    | 'updateScene'
    | 'ensureSceneExists'
    | 'searchScenes'
    | 'searchSceneModules'
    | 'createSceneModule'
    | 'updateSceneModule'
  >
>;

describe('MarketingSceneService', () => {
  let service: MarketingSceneService;
  let repo: MockedSceneRepository;
  let eventEmitter: { emit: jest.Mock };
  let resolutionService: { resolveSceneView: jest.Mock };
  let prisma: {
    umsMember: { findUnique: jest.Mock };
    mktCampaign: { findFirst: jest.Mock };
    mktCampaignParticipation: { findFirst: jest.Mock };
    mktSceneTemplate: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    mktScene: {
      create: jest.Mock;
      update: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    mktSceneModule: {
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findSceneGraph: jest.fn(),
      findPoliciesByCodes: jest.fn(),
      nextReleaseNo: jest.fn(),
      createRelease: jest.fn(),
      createScene: jest.fn(),
      updateScene: jest.fn(),
      ensureSceneExists: jest.fn(),
      searchScenes: jest.fn(),
      searchSceneModules: jest.fn(),
      createSceneModule: jest.fn(),
      updateSceneModule: jest.fn(),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    resolutionService = {
      resolveSceneView: jest.fn(),
    };
    prisma = {
      umsMember: { findUnique: jest.fn() },
      mktCampaign: { findFirst: jest.fn() },
      mktCampaignParticipation: { findFirst: jest.fn() },
      mktSceneTemplate: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
      mktScene: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      mktSceneModule: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    const module = await Test.createTestingModule({
      providers: [
        MarketingSceneService,
        { provide: MarketingSceneRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ResolutionService, useValue: resolutionService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(MarketingSceneService);
  });

  it('list 将 placementConfig 展开为扁平展示字段', async () => {
    repo.searchScenes.mockResolvedValue({
      rows: [
        {
          id: 's1',
          tenantId: '000000',
          sceneCode: 'NR_HOME',
          sceneName: '首页',
          sceneType: 'HOMEPAGE',
          channelScope: ['miniapp'],
          placementConfig: {
            activityTypeFilter: 'FLASH_SALE',
            storeMatchMode: 'CURRENT_STORE',
            sortMode: 'RECOMMEND_WEIGHT',
          },
        },
      ],
      total: 1,
    } as never);

    const res = await service.list({ pageNum: 1, pageSize: 10 } as never);

    const row = res.rows[0] as {
      activityTypeFilter?: string;
      storeMatchMode?: string;
      sortMode?: string;
    };
    expect(row.activityTypeFilter).toBe('FLASH_SALE');
    expect(row.storeMatchMode).toBe('CURRENT_STORE');
    expect(row.sortMode).toBe('RECOMMEND_WEIGHT');
  });

  it('场景不存在时禁止发布', async () => {
    repo.findSceneGraph.mockResolvedValue(null);
    const err = await service.publish('HOME_FEATURED', 'admin').catch((e) => e);
    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: '场景不存在' });
  });

  it('场景存在时发布成功并记录发布者', async () => {
    const mockScene = {
      sceneCode: 'HOME_FEATURED',
      status: 'ACTIVE',
      defaultResolverPolicyCode: null,
      defaultCardTemplateCode: null,
      modules: [
        {
          moduleCode: 'M_HOME',
          sourcePolicyCode: 'SRC_HOME',
          resolverPolicyCode: 'RES_HOME',
          cardTemplateCode: 'CARD_HOME',
          sortPolicyCode: null,
          audiencePolicyCode: null,
          limitSize: 20,
        },
      ],
    };
    repo.findSceneGraph.mockResolvedValue(mockScene);
    repo.findPoliciesByCodes.mockResolvedValue([
      { policyCode: 'SRC_HOME', policyType: 'SOURCE', status: 'ACTIVE' },
      { policyCode: 'RES_HOME', policyType: 'RESOLVER', status: 'ACTIVE' },
      { policyCode: 'CARD_HOME', policyType: 'CARD_TEMPLATE', status: 'ACTIVE' },
    ]);
    repo.nextReleaseNo.mockResolvedValue(2);
    repo.createRelease.mockResolvedValue({ id: 'rel-1', tenantId: '000000' });

    await service.publish('HOME_FEATURED', 'admin-user');

    expect(repo.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneCode: 'HOME_FEATURED',
        releaseNo: 2,
        releaseStatus: 'PUBLISHED',
        publishedBy: 'admin-user',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      MarketingEventType.SCENE_RELEASE_PUBLISHED,
      expect.objectContaining({
        tenantId: '000000',
        sceneCode: 'HOME_FEATURED',
        releaseNo: 2,
      }),
    );
  });

  it('发布前校验策略状态，未启用策略时阻断发布', async () => {
    repo.findSceneGraph.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      status: 'ACTIVE',
      defaultResolverPolicyCode: null,
      defaultCardTemplateCode: null,
      modules: [
        {
          moduleCode: 'M_HOME',
          sourcePolicyCode: 'SRC_HOME',
          resolverPolicyCode: 'RES_HOME',
          cardTemplateCode: 'CARD_HOME',
          sortPolicyCode: null,
          audiencePolicyCode: null,
          limitSize: 20,
        },
      ],
    });
    repo.findPoliciesByCodes.mockResolvedValue([
      { policyCode: 'SRC_HOME', policyType: 'SOURCE', status: 'ACTIVE' },
      { policyCode: 'RES_HOME', policyType: 'RESOLVER', status: 'INACTIVE' },
      { policyCode: 'CARD_HOME', policyType: 'CARD_TEMPLATE', status: 'ACTIVE' },
    ]);

    const err = await service.publish('HOME_FEATURED', 'admin').catch((e) => e);

    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: expect.stringContaining('策略未启用') });
    expect(repo.createRelease).not.toHaveBeenCalled();
  });

  it('场景没有可发布模块时阻断发布', async () => {
    repo.findSceneGraph.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      status: 'ACTIVE',
      defaultResolverPolicyCode: null,
      defaultCardTemplateCode: null,
      modules: [],
    });

    const err = await service.publish('HOME_FEATURED', 'admin').catch((e) => e);

    expect(err).toBeInstanceOf(BusinessException);
    expect(err.getResponse()).toMatchObject({ msg: expect.stringContaining('没有已启用模块') });
    expect(repo.createRelease).not.toHaveBeenCalled();
  });

  it('saveScene 有 id 时调用 updateScene', async () => {
    repo.updateScene.mockResolvedValue({ id: 'scene-1' });
    repo.createScene.mockResolvedValue({ id: 'scene-1' });

    await service.saveScene(
      { id: 'scene-1', sceneCode: 'X', sceneName: 'X', sceneType: 'X', channelScope: [], status: 'ACTIVE' },
      'op',
    );

    expect(repo.updateScene).toHaveBeenCalled();
    expect(repo.createScene).not.toHaveBeenCalled();
  });

  it('createFromTemplate 根据模板创建场景和模块', async () => {
    prisma.mktSceneTemplate.findUnique.mockResolvedValue({
      templateCode: 'NEW_CUSTOMER_ZONE',
      templateName: '新人专享专区',
      sceneType: 'NEWCOMER',
      channelScope: ['miniapp'],
      pageRoute: '/pages/marketing/detail?id=NEW_CUSTOMER_ZONE',
      defaultCardTemplateCode: 'COUPON_PACK_CARD',
      defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
      placementConfig: { activityTypeFilter: 'NEWCOMER_EXCLUSIVE' },
      isActive: true,
      modules: [
        {
          moduleSlot: 'newcomer-welcome',
          moduleName: '新人欢迎',
          moduleType: 'BANNER',
          title: '新人见面礼',
          subTitle: null,
          displayOrder: 10,
          limitSize: 1,
          sourcePolicyCode: 'DEFAULT_SOURCE',
          resolverPolicyCode: 'DEFAULT_RESOLVER',
          sortPolicyCode: null,
          audiencePolicyCode: 'NEWCOMER_AUDIENCE',
          cardTemplateCode: 'BANNER_CARD',
          attributionPolicyCode: null,
          uiConfig: { layout: 'hero' },
        },
        {
          moduleSlot: 'newcomer-coupon-pack',
          moduleName: '新人券包',
          moduleType: 'COUPON_PACK',
          title: '新人券包',
          subTitle: null,
          displayOrder: 20,
          limitSize: 6,
          sourcePolicyCode: 'DEFAULT_SOURCE',
          resolverPolicyCode: 'DEFAULT_RESOLVER',
          sortPolicyCode: null,
          audiencePolicyCode: 'NEWCOMER_AUDIENCE',
          cardTemplateCode: 'COUPON_PACK_CARD',
          attributionPolicyCode: null,
          uiConfig: { layout: 'coupon-strip' },
        },
        {
          moduleSlot: 'newcomer-flash',
          moduleName: '新人限时价',
          moduleType: 'PRODUCT_LIST',
          title: '新人限时特惠',
          subTitle: null,
          displayOrder: 30,
          limitSize: 10,
          sourcePolicyCode: 'DEFAULT_SOURCE',
          resolverPolicyCode: 'DEFAULT_RESOLVER',
          sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
          audiencePolicyCode: 'NEWCOMER_AUDIENCE',
          cardTemplateCode: 'FLASH_SALE_CARD',
          attributionPolicyCode: null,
          uiConfig: { layout: 'timebox' },
        },
      ],
    });
    prisma.mktScene.create.mockResolvedValue({ id: 'scene-1', sceneCode: 'NEW_ZONE_001' });
    prisma.mktScene.findUnique.mockResolvedValue({
      id: 'scene-1',
      modules: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }],
    });

    const result = await TenantContext.run({ tenantId: 'tenant-1' }, () =>
      service.createFromTemplate(
        {
          templateCode: 'NEW_CUSTOMER_ZONE',
          sceneCode: 'NEW_ZONE_001',
          sceneName: '新人专区 001',
        },
        'admin',
      ),
    );

    expect(prisma.mktScene.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        sceneCode: 'NEW_ZONE_001',
        sceneName: '新人专区 001',
        sceneType: 'NEWCOMER',
        templateCode: 'NEW_CUSTOMER_ZONE',
        templateOverrides: null,
        status: 'DRAFT',
      }),
    });
    expect(prisma.mktSceneModule.create).toHaveBeenCalledTimes(3);
    expect(prisma.mktSceneModule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moduleCode: 'NEW_ZONE_001-newcomer-flash',
        cardTemplateCode: 'FLASH_SALE_CARD',
      }),
    });
    expect(result).toMatchObject({ id: 'scene-1' });
  });

  it('createFromTemplate 记录覆盖项并合并 placementConfig', async () => {
    prisma.mktSceneTemplate.findUnique.mockResolvedValue({
      templateCode: 'HOMEPAGE_PROMOTION_FEED',
      templateName: '首页营销 Feed',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      defaultCardTemplateCode: 'PRODUCT_CARD',
      defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
      placementConfig: { activityTypeFilter: 'ALL', storeMatchMode: 'CURRENT_STORE' },
      isActive: true,
      modules: [
        {
          moduleSlot: 'banner',
          moduleName: '首页横幅',
          moduleType: 'BANNER',
          title: '今日推荐',
          subTitle: null,
          displayOrder: 10,
          limitSize: 5,
          sourcePolicyCode: 'DEFAULT_SOURCE',
          resolverPolicyCode: 'DEFAULT_RESOLVER',
          sortPolicyCode: null,
          audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
          cardTemplateCode: 'BANNER_CARD',
          attributionPolicyCode: null,
          uiConfig: null,
        },
      ],
    });
    prisma.mktScene.create.mockResolvedValue({ id: 'scene-2', sceneCode: 'HOME_CUSTOM' });
    prisma.mktScene.findUnique.mockResolvedValue({ id: 'scene-2', modules: [] });

    await TenantContext.run({ tenantId: 'tenant-1' }, () =>
      service.createFromTemplate(
        {
          templateCode: 'HOMEPAGE_PROMOTION_FEED',
          sceneCode: 'HOME_CUSTOM',
          sceneName: '定制首页',
          overrides: {
            placementConfig: { sortMode: 'UPDATE_TIME' },
          },
        },
        'admin',
      ),
    );

    expect(prisma.mktScene.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        placementConfig: {
          activityTypeFilter: 'ALL',
          storeMatchMode: 'CURRENT_STORE',
          sortMode: 'UPDATE_TIME',
        },
        templateOverrides: {
          placementConfig: { sortMode: 'UPDATE_TIME' },
        },
      }),
    });
  });

  it('syncFromTemplate 按字段同步模块 cardTemplateCode', async () => {
    prisma.mktScene.findFirst.mockResolvedValue({
      id: 'scene-3',
      tenantId: 'tenant-1',
      sceneCode: 'HOME_SYNC',
      templateCode: 'HOMEPAGE_PROMOTION_FEED',
      templateOverrides: {},
      modules: [
        {
          id: 'module-1',
          moduleCode: 'HOME_SYNC-banner',
          cardTemplateCode: 'OLD_CARD',
        },
      ],
    });
    prisma.mktSceneTemplate.findUnique.mockResolvedValue({
      templateCode: 'HOMEPAGE_PROMOTION_FEED',
      templateName: '首页营销 Feed',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      defaultCardTemplateCode: 'PRODUCT_CARD',
      defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
      placementConfig: {},
      isActive: true,
      modules: [
        {
          moduleSlot: 'banner',
          moduleName: '首页横幅',
          moduleType: 'BANNER',
          title: '今日推荐',
          subTitle: null,
          displayOrder: 10,
          limitSize: 5,
          sourcePolicyCode: 'DEFAULT_SOURCE',
          resolverPolicyCode: 'DEFAULT_RESOLVER',
          sortPolicyCode: null,
          audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
          cardTemplateCode: 'BANNER_CARD',
          attributionPolicyCode: null,
          uiConfig: null,
        },
      ],
    });
    prisma.mktScene.findUnique.mockResolvedValue({ id: 'scene-3', modules: [] });

    await TenantContext.run({ tenantId: 'tenant-1' }, () =>
      service.syncFromTemplate('scene-3', { fields: ['modules.*.cardTemplateCode'] }, 'admin'),
    );

    expect(prisma.mktSceneModule.update).toHaveBeenCalledWith({
      where: { id: 'module-1' },
      data: { cardTemplateCode: 'BANNER_CARD' },
    });
  });

  it('previewProducts 使用后台输入的会员、渠道和客户端版本构造裁决上下文', async () => {
    prisma.umsMember.findUnique.mockResolvedValue({ levelId: 'VIP' });
    prisma.mktCampaign.findFirst.mockResolvedValue({ id: 'newcomer-activity' });
    prisma.mktCampaignParticipation.findFirst.mockResolvedValue(null);
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      releaseNo: 3,
      traceId: 'trace-preview-1',
      source: 'scene',
      modules: [
        {
          moduleCode: 'M_HOME',
          moduleName: '首页推荐',
          products: [
            {
              productId: 'p1',
              productName: '体验课',
              productImg: 'https://example.test/p1.png',
              primaryOffer: {
                activityContextKey: 'COURSE_GROUP:cfg-1',
                activityType: 'COURSE_GROUP',
                configId: 'cfg-1',
                displayPrice: 99,
                originalPrice: 199,
                statusSummary: 'AVAILABLE',
              },
            },
          ],
        },
      ],
    });

    const result = await TenantContext.run({ tenantId: 'tenant-1' }, () =>
      service.previewProducts('HOME_FEATURED', {
        channel: 'H5',
        memberId: ' member-1 ',
        clientVersion: ' 1.2.0 ',
        pageNum: 1,
        pageSize: 20,
      }),
    );

    expect(resolutionService.resolveSceneView).toHaveBeenCalledWith({
      sceneCode: 'HOME_FEATURED',
      userContext: expect.objectContaining({
        tenantId: 'tenant-1',
        memberId: 'member-1',
        channel: 'H5',
        clientVersion: '1.2.0',
        memberLevel: 'VIP',
        isNewcomer: true,
      }),
      productLimit: 20,
    });
    expect(result).toMatchObject({
      total: 1,
      pageNum: 1,
      pageSize: 20,
      releaseNo: 3,
      traceId: 'trace-preview-1',
      rows: [
        {
          sceneCode: 'HOME_FEATURED',
          moduleCode: 'M_HOME',
          moduleName: '首页推荐',
          productId: 'p1',
          productName: '体验课',
          activityContextKey: 'COURSE_GROUP:cfg-1',
          activityType: 'COURSE_GROUP',
          activityConfigId: 'cfg-1',
          displayPrice: 99,
          originalPrice: 199,
          status: 'AVAILABLE',
        },
      ],
    });
  });

  it('previewProducts 未填写会员时不查询会员上下文并默认使用后台预览渠道', async () => {
    resolutionService.resolveSceneView.mockResolvedValue({
      sceneCode: 'HOME_FEATURED',
      releaseNo: 1,
      traceId: 'trace-preview-empty-member',
      source: 'scene',
      modules: [],
    });

    await TenantContext.run({ tenantId: 'tenant-1' }, () =>
      service.previewProducts('HOME_FEATURED', {
        memberId: '   ',
        pageNum: 1,
        pageSize: 20,
      }),
    );

    expect(prisma.umsMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.mktCampaign.findFirst).not.toHaveBeenCalled();
    expect(resolutionService.resolveSceneView).toHaveBeenCalledWith(
      expect.objectContaining({
        userContext: expect.objectContaining({
          tenantId: 'tenant-1',
          memberId: '',
          channel: 'ADMIN_PREVIEW',
          isNewcomer: false,
        }),
      }),
    );
  });
});
