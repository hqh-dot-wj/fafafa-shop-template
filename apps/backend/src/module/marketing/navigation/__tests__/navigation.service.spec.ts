import { NavigationService } from '../navigation.service';

describe('NavigationService', () => {
  const prisma = {
    pmsCategory: {
      findMany: jest.fn(),
    },
    mktScene: {
      findMany: jest.fn(),
    },
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
  };

  let service: NavigationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NavigationService(prisma as any, tenantHelper as any);
  });

  it('client tree should only expose published/active scenes', async () => {
    prisma.pmsCategory.findMany.mockResolvedValue([
      {
        catId: 1,
        parentId: null,
        name: '根分类',
        sort: 1,
      },
    ]);
    prisma.mktScene.findMany.mockResolvedValue([
      {
        id: 'scene-1',
        sceneCode: 'ACTIVE_SCENE',
        sceneName: '已发布场景',
        pageRoute: '/pages/product/list?sceneCode=ACTIVE_SCENE',
        status: 'ACTIVE',
      },
      {
        id: 'scene-2',
        sceneCode: 'DRAFT_SCENE',
        sceneName: '草稿场景',
        pageRoute: '/pages/product/list?sceneCode=DRAFT_SCENE',
        status: 'DRAFT',
      },
    ]);

    const result = await service.getClientTree('000000');
    const root = result.data?.nodes?.[0];
    const sceneCodes = (root?.children ?? []).filter((node) => node.nodeType === 'SCENE').map((node) => node.code);

    expect(sceneCodes).toEqual(['ACTIVE_SCENE']);
  });

  it('admin tree should fall back when stored scene route is no longer whitelisted', async () => {
    prisma.pmsCategory.findMany.mockResolvedValue([
      {
        catId: 1,
        parentId: null,
        name: '根分类',
        sort: 1,
      },
    ]);
    prisma.mktScene.findMany.mockResolvedValue([
      {
        id: 'scene-legacy',
        sceneCode: 'FLASH_SALE',
        sceneName: '历史秒杀场景',
        sceneType: 'MARKETING',
        pageRoute: '/pages/marketing/flash',
        status: 'ACTIVE',
      },
    ]);

    const result = await service.getAdminTree('000000');
    const sceneNode = result.data?.nodes?.[0]?.children?.find((node) => node.nodeType === 'SCENE');

    expect(sceneNode?.pagePath).toBe('/pages/product/list?sceneCode=FLASH_SALE&sourceType=SCENE');
  });
});
