import { Test, TestingModule } from '@nestjs/testing';
import { ResolutionAuditArchiveScheduler } from './resolution-audit-archive.scheduler';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ResolutionAuditArchiveScheduler', () => {
  let scheduler: ResolutionAuditArchiveScheduler;

  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  const prismaService = {
    mktResolutionAudit: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolutionAuditArchiveScheduler,
        { provide: RedisService, useValue: redisService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    scheduler = module.get<ResolutionAuditArchiveScheduler>(ResolutionAuditArchiveScheduler);
    jest.clearAllMocks();
  });

  it('未获取锁时应跳过', async () => {
    redisService.tryLock.mockResolvedValue(null);

    await scheduler.archiveOldResolutionAudits();

    expect(prismaService.mktResolutionAudit.deleteMany).not.toHaveBeenCalled();
    expect(redisService.unlock).not.toHaveBeenCalled();
  });

  it('获取锁后应执行删除', async () => {
    redisService.tryLock.mockResolvedValue('t1');
    redisService.unlock.mockResolvedValue(undefined);
    prismaService.mktResolutionAudit.deleteMany.mockResolvedValue({ count: 12 });

    await scheduler.archiveOldResolutionAudits();

    expect(prismaService.mktResolutionAudit.deleteMany).toHaveBeenCalledTimes(1);
    expect(redisService.unlock).toHaveBeenCalled();
  });
});
