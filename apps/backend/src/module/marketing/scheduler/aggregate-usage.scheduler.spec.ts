import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { AggregateUsageScheduler } from './aggregate-usage.scheduler';
import {
  MARKETING_AGGREGATE_TENANT_SET_KEY,
  MARKETING_COMPAT_TENANT_SET_KEY,
  marketingAggregateDailyCountKey,
  marketingAggregateEverUsedKey,
} from '../marketing-aggregate-traffic.constants';

describe('AggregateUsageScheduler', () => {
  let scheduler: AggregateUsageScheduler;
  let redis: {
    tryLock: jest.Mock;
    unlock: jest.Mock;
    get: jest.Mock;
    incr: jest.Mock;
    del: jest.Mock;
    set: jest.Mock;
    getClient: jest.Mock;
  };
  let prisma: { sysConfig: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } };

  const yesterdayYmd = '20260415';

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-16T12:00:00.000Z'));

    const smembers = jest.fn(async (key: string) => {
      if (key === MARKETING_AGGREGATE_TENANT_SET_KEY) return [];
      if (key === MARKETING_COMPAT_TENANT_SET_KEY) return [];
      return [];
    });
    const srem = jest.fn();

    redis = {
      tryLock: jest.fn().mockResolvedValue('token'),
      unlock: jest.fn(),
      get: jest.fn(),
      incr: jest.fn(),
      del: jest.fn(),
      set: jest.fn(),
      getClient: jest.fn(() => ({ smembers, srem })),
    };
    prisma = {
      sysConfig: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AggregateUsageScheduler,
        { provide: RedisService, useValue: redis },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    scheduler = module.get(AggregateUsageScheduler);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should finish immediately when no tracked tenants', async () => {
    await scheduler.disableIdleAggregateEndpoints();

    expect(prisma.sysConfig.findFirst).not.toHaveBeenCalled();
    expect(redis.unlock).toHaveBeenCalled();
  });

  it('should disable aggregate switch after 14 consecutive zero-traffic UTC days', async () => {
    const smembers = jest.fn(async (key: string) => {
      if (key === MARKETING_AGGREGATE_TENANT_SET_KEY) return ['t1'];
      if (key === MARKETING_COMPAT_TENANT_SET_KEY) return [];
      return [];
    });
    const srem = jest.fn();
    redis.getClient.mockReturnValue({ smembers, srem });
    redis.get.mockImplementation(async (key: string) => {
      if (key === marketingAggregateEverUsedKey('t1')) return '1';
      if (key === marketingAggregateDailyCountKey('t1', yesterdayYmd)) return 0;
      return null;
    });
    redis.incr.mockResolvedValue(14);
    prisma.sysConfig.findFirst.mockResolvedValue({ configId: 'cfg-1' });

    await scheduler.disableIdleAggregateEndpoints();

    expect(prisma.sysConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { configId: 'cfg-1' },
        data: expect.objectContaining({
          configValue: 'N',
          remark: expect.stringContaining('14'),
        }),
      }),
    );
    expect(prisma.sysConfig.create).not.toHaveBeenCalled();
    expect(srem).toHaveBeenCalledWith(MARKETING_AGGREGATE_TENANT_SET_KEY, 't1');
  });

  it('should keep aggregate switch enabled when zero-traffic streak is less than 14 days', async () => {
    const smembers = jest.fn(async (key: string) => {
      if (key === MARKETING_AGGREGATE_TENANT_SET_KEY) return ['t1'];
      if (key === MARKETING_COMPAT_TENANT_SET_KEY) return [];
      return [];
    });
    redis.getClient.mockReturnValue({ smembers, srem: jest.fn() });
    redis.get.mockImplementation(async (key: string) => {
      if (key === marketingAggregateEverUsedKey('t1')) return '1';
      if (key === marketingAggregateDailyCountKey('t1', yesterdayYmd)) return 0;
      return null;
    });
    redis.incr.mockResolvedValue(13);

    await scheduler.disableIdleAggregateEndpoints();

    expect(prisma.sysConfig.findFirst).not.toHaveBeenCalled();
    expect(prisma.sysConfig.update).not.toHaveBeenCalled();
    expect(prisma.sysConfig.create).not.toHaveBeenCalled();
  });
});
