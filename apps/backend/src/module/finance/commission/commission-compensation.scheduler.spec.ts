import { Queue } from 'bull';
import { OrderQueryPort } from '../ports/order-query.port';
import { CommissionCompensationScheduler } from './commission-compensation.scheduler';

describe('CommissionCompensationScheduler', () => {
  const mockOrderQueryPort = {
    findPaidOrdersMissingCommissions: jest.fn(),
  };

  const mockCommissionQueue = {
    add: jest.fn(),
  };

  const scheduler = new CommissionCompensationScheduler(
    mockOrderQueryPort as unknown as OrderQueryPort,
    mockCommissionQueue as unknown as Queue,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('BUG-6: Given 漏算订单, When compensateJob, Then 通过 OrderQueryPort 查询（不直接访问 prisma）', async () => {
    mockOrderQueryPort.findPaidOrdersMissingCommissions.mockResolvedValue([
      { id: 'order1', tenantId: 'tenant1' },
      { id: 'order2', tenantId: 'tenant2' },
    ]);
    mockCommissionQueue.add.mockResolvedValue({});

    await scheduler.compensateJob();

    expect(mockOrderQueryPort.findPaidOrdersMissingCommissions).toHaveBeenCalledTimes(1);
    const [windowStart, windowEnd, limit] = mockOrderQueryPort.findPaidOrdersMissingCommissions.mock.calls[0];
    expect(windowEnd.getTime() - windowStart.getTime()).toBeGreaterThan(20 * 3600 * 1000); // 窗口 > 20h
    expect(limit).toBe(200);

    expect(mockCommissionQueue.add).toHaveBeenCalledTimes(2);
    expect(mockCommissionQueue.add).toHaveBeenCalledWith(
      { orderId: 'order1', tenantId: 'tenant1' },
      expect.objectContaining({ jobId: 'calc:commission:order1' }),
    );
  });

  // C2.2: Bull 默认会跳过已存在 jobId 的入队请求。补偿任务若不主动清理已完成/失败的旧 job，
  // 同一 orderId 永远无法被再次入队 → 漏佣无人察觉。removeOnComplete/Fail 让 job 跑完即销毁。
  it('补偿入队必须带 removeOnComplete 与 removeOnFail，避免旧 job 占位导致再次入队被跳过', async () => {
    mockOrderQueryPort.findPaidOrdersMissingCommissions.mockResolvedValue([{ id: 'order-x', tenantId: 'tenant-x' }]);
    mockCommissionQueue.add.mockResolvedValue({});

    await scheduler.compensateJob();

    const [, options] = mockCommissionQueue.add.mock.calls[0];
    expect(options).toMatchObject({
      jobId: 'calc:commission:order-x',
      removeOnComplete: true,
      removeOnFail: true,
    });
  });

  it('Given 无漏算订单, When compensateJob, Then 不入队', async () => {
    mockOrderQueryPort.findPaidOrdersMissingCommissions.mockResolvedValue([]);

    await scheduler.compensateJob();

    expect(mockCommissionQueue.add).not.toHaveBeenCalled();
  });
});
