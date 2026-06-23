import { OrderAutoCancelScheduler } from './order-auto-cancel.scheduler';
import { TenantContext } from 'src/common/tenant/tenant.context';

describe('OrderAutoCancelScheduler', () => {
  const orderRepo = {
    findTimedOutUnpaidOrders: jest.fn(),
  };
  const orderService = {
    cancelOrderBySystem: jest.fn(),
  };
  const redisService = {
    tryLock: jest.fn(),
    unlock: jest.fn(),
  };
  const autoCancelConfig = {
    getOptions: jest.fn(() => ({
      timeoutMinutes: 30,
      timeoutMs: 30 * 60 * 1000,
      reason: '超时未支付自动关闭',
      sweepBatchSize: 100,
      sweepLockTtlMs: 55_000,
    })),
  };

  let scheduler: OrderAutoCancelScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new OrderAutoCancelScheduler(
      orderRepo as any,
      orderService as any,
      redisService as any,
      autoCancelConfig as any,
    );
    redisService.tryLock.mockResolvedValue('lock-token');
    redisService.unlock.mockResolvedValue(1);
    orderRepo.findTimedOutUnpaidOrders.mockResolvedValue([]);
    orderService.cancelOrderBySystem.mockResolvedValue({ status: 'cancelled' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Given 扫描锁已被占用, When cancelTimedOutUnpaidOrders, Then 跳过扫描', async () => {
    redisService.tryLock.mockResolvedValue(null);

    await scheduler.cancelTimedOutUnpaidOrders();

    expect(orderRepo.findTimedOutUnpaidOrders).not.toHaveBeenCalled();
    expect(redisService.unlock).not.toHaveBeenCalled();
  });

  it('Given 延迟任务丢失或 Worker 重启后仍有超时待支付订单, When cancelTimedOutUnpaidOrders, Then 逐单调用系统取消并释放锁', async () => {
    orderRepo.findTimedOutUnpaidOrders.mockResolvedValue([{ id: 'order-1' }, { id: 'order-2' }]);

    await scheduler.cancelTimedOutUnpaidOrders();

    expect(orderRepo.findTimedOutUnpaidOrders).toHaveBeenCalledWith(expect.any(Date), 100);
    expect(orderService.cancelOrderBySystem).toHaveBeenCalledWith('order-1', '超时未支付自动关闭');
    expect(orderService.cancelOrderBySystem).toHaveBeenCalledWith('order-2', '超时未支付自动关闭');
    expect(redisService.unlock).toHaveBeenCalledWith('lock:order:auto-cancel:sweep', 'lock-token');
  });

  it('Given 自定义支付超时配置, When cancelTimedOutUnpaidOrders, Then 按配置计算截止时间和锁过期时间', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-08T12:00:00.000Z'));
    autoCancelConfig.getOptions.mockReturnValueOnce({
      timeoutMinutes: 10,
      timeoutMs: 10 * 60 * 1000,
      reason: '自定义超时关闭',
      sweepBatchSize: 5,
      sweepLockTtlMs: 12_000,
    });
    orderRepo.findTimedOutUnpaidOrders.mockResolvedValue([{ id: 'order-1' }]);

    await scheduler.cancelTimedOutUnpaidOrders();

    const [deadline, take] = orderRepo.findTimedOutUnpaidOrders.mock.calls[0];
    expect(redisService.tryLock).toHaveBeenCalledWith('lock:order:auto-cancel:sweep', 12_000);
    expect(deadline.toISOString()).toBe('2026-05-08T11:50:00.000Z');
    expect(take).toBe(5);
    expect(orderService.cancelOrderBySystem).toHaveBeenCalledWith('order-1', '自定义超时关闭');
  });

  it('Given 当前请求上下文带普通租户, When 执行兜底扫描, Then 使用忽略租户上下文扫描全局超时订单', async () => {
    let observedContext: { tenantId?: string; ignoreTenant: boolean } | undefined;
    orderRepo.findTimedOutUnpaidOrders.mockImplementation(async () => {
      observedContext = {
        tenantId: TenantContext.getTenantId(),
        ignoreTenant: TenantContext.isIgnoreTenant(),
      };
      return [];
    });

    await TenantContext.run({ tenantId: 'tenant-user', ignoreTenant: false }, () =>
      scheduler.cancelTimedOutUnpaidOrders(),
    );

    expect(observedContext).toEqual({
      tenantId: TenantContext.SUPER_TENANT_ID,
      ignoreTenant: true,
    });
  });

  it('Given 单条订单取消失败, When cancelTimedOutUnpaidOrders, Then 继续处理后续订单', async () => {
    orderRepo.findTimedOutUnpaidOrders.mockResolvedValue([{ id: 'order-1' }, { id: 'order-2' }]);
    orderService.cancelOrderBySystem.mockRejectedValueOnce(new Error('db timeout')).mockResolvedValueOnce({
      status: 'cancelled',
    });

    await scheduler.cancelTimedOutUnpaidOrders();

    expect(orderService.cancelOrderBySystem).toHaveBeenCalledTimes(2);
    expect(redisService.unlock).toHaveBeenCalledWith('lock:order:auto-cancel:sweep', 'lock-token');
  });
});
