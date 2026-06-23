import { MarketingStockMode } from '@prisma/client';
import { PlayController } from './play.controller';
import type { CourseGroupBuyService } from './course-group-buy.service';
import type { PlayDispatcher, PlayMetadata } from './play.dispatcher';

const courseGroupBuyService = {} as CourseGroupBuyService;

describe('PlayController', () => {
  const metadata: PlayMetadata = {
    code: 'COURSE_GROUP_BUY',
    name: '拼班课程',
    hasInstance: true,
    hasState: true,
    canFail: true,
    canParallel: true,
    ruleSchema: class CourseGroupRules {},
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '课程拼团',
  };

  function createController(dispatcherOverride: Partial<PlayDispatcher> = {}) {
    const playDispatcher = {
      getAllPlayTypes: jest.fn(() => [metadata]),
      getMetadata: jest.fn(() => metadata),
      hasHandler: jest.fn(() => true),
      hasInstance: jest.fn(() => true),
      hasState: jest.fn(() => true),
      canFail: jest.fn(() => true),
      canParallel: jest.fn(() => true),
      ...dispatcherOverride,
    } as unknown as PlayDispatcher;

    return new PlayController(playDispatcher, courseGroupBuyService);
  }

  it('获取所有玩法类型时应返回可序列化 VO，不暴露 ruleSchema 构造器', async () => {
    const controller = createController();

    const result = await controller.getAllPlayTypes();

    expect(result.data).toEqual([
      {
        code: 'COURSE_GROUP_BUY',
        name: '拼班课程',
        hasInstance: true,
        hasState: true,
        canFail: true,
        canParallel: true,
        defaultStockMode: MarketingStockMode.LAZY_CHECK,
        description: '课程拼团',
      },
    ]);
    expect(result.data?.[0]).not.toHaveProperty('ruleSchema');
  });

  it('获取单个玩法元数据时应沿用同一 VO 边界', async () => {
    const controller = createController();

    const result = await controller.getPlayType('COURSE_GROUP_BUY');

    expect(result.data?.code).toBe('COURSE_GROUP_BUY');
    expect(result.data).not.toHaveProperty('ruleSchema');
  });

  it('玩法存在性和特性查询应返回统一响应包，便于前端请求层解析 data', async () => {
    const controller = createController();

    await expect(controller.checkPlayExists('COURSE_GROUP_BUY')).resolves.toMatchObject({
      code: 200,
      data: { code: 'COURSE_GROUP_BUY', exists: true },
    });
    await expect(controller.getPlayFeatures('COURSE_GROUP_BUY')).resolves.toMatchObject({
      code: 200,
      data: {
        code: 'COURSE_GROUP_BUY',
        hasInstance: true,
        hasState: true,
        canFail: true,
        canParallel: true,
      },
    });
  });
});
