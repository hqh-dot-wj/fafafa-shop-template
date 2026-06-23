import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PlayInstanceService } from '../instance/instance.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { ActivityLifecycleScheduler } from './lifecycle.scheduler';

describe('ActivityLifecycleScheduler', () => {
  let scheduler: ActivityLifecycleScheduler;

  const mockPrisma = {
    playInstance: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    storePlayConfig: {
      updateMany: jest.fn(),
    },
  };

  const mockInstanceService = {
    transitStatus: jest.fn(),
  };

  const mockRedisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityLifecycleScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlayInstanceService, useValue: mockInstanceService },
        { provide: RedisService, useValue: mockRedisService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    scheduler = module.get<ActivityLifecycleScheduler>(ActivityLifecycleScheduler);
    jest.clearAllMocks();
  });

  // R-CONCUR-MAAS-01
  it('Given 未获得分布式锁, When handleTimeoutInstances, Then 跳过超时处理', async () => {
    mockRedisService.tryLock.mockResolvedValue(false);

    await scheduler.handleTimeoutInstances();

    expect(mockPrisma.playInstance.findMany).not.toHaveBeenCalled();
    expect(mockRedisService.unlock).not.toHaveBeenCalled();
  });

  // R-FLOW-MAAS-01
  it('Given 获得分布式锁且无待处理实例, When handleTimeoutInstances, Then 正常完成并释放锁', async () => {
    mockRedisService.tryLock.mockResolvedValue(true);
    mockPrisma.playInstance.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    mockRedisService.unlock.mockResolvedValue(1);

    await scheduler.handleTimeoutInstances();

    expect(mockPrisma.playInstance.findMany).toHaveBeenCalledTimes(2);
    expect(mockRedisService.unlock).toHaveBeenCalledTimes(1);
  });

  // 原 cleanupExpiredData spec 已随 SCHEDULER-AUDIT Phase B dead-code 清理一并下线：
  // 调度器侧 PlayInstance 缺少 archived 字段，任务实际只 count + log 不做归档，
  // 直接删除以避免运维误以为有归档行为；如需归档请另起 Phase。
});
