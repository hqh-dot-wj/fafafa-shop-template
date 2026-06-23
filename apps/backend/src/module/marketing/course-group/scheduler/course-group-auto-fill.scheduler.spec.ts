import { CourseGroupAutoFillScheduler } from './course-group-auto-fill.scheduler';

describe('CourseGroupAutoFillScheduler', () => {
  const courseGroupBuyService = {
    runAutoFillSweep: jest.fn(),
  };

  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };

  let scheduler: CourseGroupAutoFillScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new CourseGroupAutoFillScheduler(courseGroupBuyService as any, redisService as any);
  });

  it('should skip auto fill sweep when scheduler lock is unavailable', async () => {
    redisService.tryLock.mockResolvedValue(null);

    await scheduler.handleAutoFill();

    expect(courseGroupBuyService.runAutoFillSweep).not.toHaveBeenCalled();
    expect(redisService.unlock).not.toHaveBeenCalled();
  });

  it('should run auto fill sweep and release lock when scheduler lock is acquired', async () => {
    redisService.tryLock.mockResolvedValue('token-1');
    redisService.unlock.mockResolvedValue(1);
    courseGroupBuyService.runAutoFillSweep.mockResolvedValue(undefined);

    await scheduler.handleAutoFill();

    expect(courseGroupBuyService.runAutoFillSweep).toHaveBeenCalledTimes(1);
    expect(redisService.unlock).toHaveBeenCalledWith('lock:marketing:course-group:auto-fill', 'token-1');
  });
});
