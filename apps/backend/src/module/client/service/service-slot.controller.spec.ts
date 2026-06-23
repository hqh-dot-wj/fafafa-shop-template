import { BusinessException } from 'src/common/exceptions';
import { ServiceSlotController } from './service-slot.controller';
import { ServiceSlotService } from './service-slot.service';

describe('ServiceSlotController', () => {
  const serviceSlotService = {
    lockSlot: jest.fn(),
  } as unknown as jest.Mocked<Pick<ServiceSlotService, 'lockSlot'>>;

  let controller: ServiceSlotController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ServiceSlotController(serviceSlotService as unknown as ServiceSlotService);
  });

  it('Given 时间段可锁定, When lockSlot, Then 返回锁定成功', async () => {
    serviceSlotService.lockSlot.mockResolvedValue(true);

    const result = await controller.lockSlot('member-1', { date: '2099-01-01', time: '09:00' });

    expect(result.msg).toBe('锁定成功');
    expect(serviceSlotService.lockSlot).toHaveBeenCalledWith('2099-01-01', '09:00', 'member-1');
  });

  it('Given 时间段已被占用, When lockSlot, Then 抛出业务异常', async () => {
    serviceSlotService.lockSlot.mockResolvedValue(false);

    await expect(controller.lockSlot('member-1', { date: '2099-01-01', time: '09:00' })).rejects.toThrow(
      BusinessException,
    );
  });
});
