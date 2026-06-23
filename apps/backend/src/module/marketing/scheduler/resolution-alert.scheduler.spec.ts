import { Test, TestingModule } from '@nestjs/testing';
import { ResolutionAlertScheduler } from './resolution-alert.scheduler';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ResolutionObservabilityService } from '../resolution/resolution-observability.service';

describe('ResolutionAlertScheduler', () => {
  let scheduler: ResolutionAlertScheduler;

  // C3.3 引入"昨日有流量"预筛后调度器会通过 redisService.getClient().smembers 读
  // aggregate / compat 两个活跃租户集合。默认让 smembers 返回空数组 → 走兜底"全租户"分支，
  // 这样既有用例的全租户语义不变。
  const smembersMock = jest.fn();
  const redisClientMock = { smembers: smembersMock };
  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
    getClient: jest.fn(() => redisClientMock),
  };

  const prismaService = {
    sysTenant: {
      findMany: jest.fn(),
    },
  };

  const observabilityService = {
    getDashboard: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolutionAlertScheduler,
        { provide: RedisService, useValue: redisService },
        { provide: PrismaService, useValue: prismaService },
        { provide: ResolutionObservabilityService, useValue: observabilityService },
      ],
    }).compile();

    scheduler = module.get<ResolutionAlertScheduler>(ResolutionAlertScheduler);
    jest.clearAllMocks();
    // 默认：活跃集合两端都空 → 触发兜底全租户分支
    smembersMock.mockResolvedValue([]);
  });

  it('未获取锁时应跳过执行', async () => {
    redisService.tryLock.mockResolvedValue(null);

    await scheduler.publishResolutionAlerts();

    expect(prismaService.sysTenant.findMany).not.toHaveBeenCalled();
    expect(observabilityService.getDashboard).not.toHaveBeenCalled();
    expect(redisService.unlock).not.toHaveBeenCalled();
  });

  it('获取锁后应遍历租户并触发告警写入（兜底全扫路径）', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(undefined);
    prismaService.sysTenant.findMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }]);
    observabilityService.getDashboard.mockResolvedValue({
      overview: {},
      topScenes: [],
    });

    await scheduler.publishResolutionAlerts();

    expect(prismaService.sysTenant.findMany).toHaveBeenCalledTimes(1);
    expect(observabilityService.getDashboard).toHaveBeenNthCalledWith(1, 't1');
    expect(observabilityService.getDashboard).toHaveBeenNthCalledWith(2, 't2');
    expect(redisService.unlock).toHaveBeenCalledWith(expect.any(String), 'token-1');
  });

  // C3.3: 活跃集合非空时，应当**只**对活跃租户写告警，避免遍历全部租户都跑一遍 dashboard 重查询
  it('活跃集合非空时仅对活跃租户调 getDashboard', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(undefined);
    smembersMock
      .mockResolvedValueOnce(['t1']) // aggregate 活跃
      .mockResolvedValueOnce(['t2', 't1']); // compat 活跃，与 aggregate 取并集后为 { t1, t2 }
    prismaService.sysTenant.findMany.mockResolvedValue([
      { tenantId: 't1' },
      { tenantId: 't2' },
      { tenantId: 't3' }, // 无流量租户，应当被跳过
    ]);
    observabilityService.getDashboard.mockResolvedValue({});

    await scheduler.publishResolutionAlerts();

    const calledTenants = observabilityService.getDashboard.mock.calls.map((args) => args[0]).sort();
    expect(calledTenants).toEqual(['t1', 't2']);
    expect(observabilityService.getDashboard).not.toHaveBeenCalledWith('t3');
  });

  // ultrareview rqxa0c2jb #bug_001：observability 集合是覆盖直连 /scene 与缓存失效路径的唯一来源，
  // aggregate/compat 都空但 observability 非空时必须按 observability 命中租户预筛，否则会漏告警
  it('仅 observability 集合非空时也按其作为预筛源命中 dashboard', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(undefined);
    smembersMock
      .mockResolvedValueOnce([]) // aggregate 空
      .mockResolvedValueOnce([]) // compat 空
      .mockResolvedValueOnce(['t3']); // observability 命中 t3（scene-only 路径）
    prismaService.sysTenant.findMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }, { tenantId: 't3' }]);
    observabilityService.getDashboard.mockResolvedValue({});

    await scheduler.publishResolutionAlerts();

    expect(observabilityService.getDashboard).toHaveBeenCalledWith('t3');
    expect(observabilityService.getDashboard).not.toHaveBeenCalledWith('t1');
    expect(observabilityService.getDashboard).not.toHaveBeenCalledWith('t2');
  });

  // C3.3: 活跃集合两端都为空（新部署冷启动）时必须回退到全租户，避免漏告警
  it('活跃集合为空时回退到全租户（避免新部署冷启动漏告警）', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(undefined);
    smembersMock.mockResolvedValue([]); // 双方都为空
    prismaService.sysTenant.findMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }]);
    observabilityService.getDashboard.mockResolvedValue({});

    await scheduler.publishResolutionAlerts();

    expect(observabilityService.getDashboard).toHaveBeenCalledTimes(2);
  });

  // C3.3: smembers 抛错（Redis 异常）也必须回退到全租户兜底，避免观测链路单点拖死告警
  it('Redis smembers 失败时回退到全租户', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(undefined);
    smembersMock.mockRejectedValue(new Error('redis down'));
    prismaService.sysTenant.findMany.mockResolvedValue([{ tenantId: 't1' }, { tenantId: 't2' }]);
    observabilityService.getDashboard.mockResolvedValue({});

    await scheduler.publishResolutionAlerts();

    expect(observabilityService.getDashboard).toHaveBeenCalledTimes(2);
  });
});
