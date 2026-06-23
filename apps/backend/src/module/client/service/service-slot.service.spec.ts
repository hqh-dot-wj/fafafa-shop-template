import { ServiceSlotService } from './service-slot.service';

describe('ServiceSlotService', () => {
  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
    get: jest.fn(),
  };

  let service: ServiceSlotService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ServiceSlotService(redisService as never);
  });

  it('Given 可用服务资源, When lockSlot, Then 使用服务资源锁预占 5 分钟', async () => {
    redisService.tryLock.mockResolvedValue('token-1');

    const locked = await service.lockSlot('2099-01-01', '09:00', 'member-1');

    expect(locked).toBe(true);
    expect(redisService.tryLock).toHaveBeenCalledWith('service:lock:2099-01-01:09:00', 300 * 1000);
  });

  it('Given 服务资源锁 token, When releaseServiceResource, Then 释放对应时间段', async () => {
    redisService.unlock.mockResolvedValue(1);

    const released = await service.releaseServiceResource('2099-01-01', '09:00', 'token-1');

    expect(released).toBe(true);
    expect(redisService.unlock).toHaveBeenCalledWith('service:lock:2099-01-01:09:00', 'token-1');
  });

  it('Given 时间段已被锁定, When getTimeSlots, Then 标记为已约满', async () => {
    redisService.get.mockImplementation(async (key: string) =>
      key === 'service:lock:2099-01-01:09:00' ? 'token-1' : null,
    );

    const slots = await service.getTimeSlots('2099-01-01');

    expect(slots[0]).toMatchObject({
      time: '09:00',
      available: false,
      reason: '已约满',
    });
  });
});
