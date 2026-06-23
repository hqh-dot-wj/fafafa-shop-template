import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { WalletQueueService } from './wallet-queue.service';
import { WalletJobType } from './wallet-queue.types';
import { TransType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('WalletQueueService', () => {
  let service: WalletQueueService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    getWaitingCount: jest.fn().mockResolvedValue(5),
    getActiveCount: jest.fn().mockResolvedValue(2),
    getCompletedCount: jest.fn().mockResolvedValue(100),
    getFailedCount: jest.fn().mockResolvedValue(3),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletQueueService, { provide: getQueueToken('WALLET_OPERATIONS'), useValue: mockQueue }],
    }).compile();

    service = module.get<WalletQueueService>(WalletQueueService);
    jest.clearAllMocks();
  });

  describe('enqueueIncreaseBalance', () => {
    it('Given 有效参数, When enqueueIncreaseBalance, Then 入队成功并返回 jobId', async () => {
      const jobId = await service.enqueueIncreaseBalance(
        'm1',
        't1',
        new Decimal(10),
        TransType.COMMISSION_IN,
        'order1',
        '佣金结算',
      );

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletJobType.INCREASE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '10',
          transType: TransType.COMMISSION_IN,
          relatedId: 'order1',
          remark: '佣金结算',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        }),
      );
    });

    it('Given 自定义幂等键, When enqueueIncreaseBalance, Then 使用自定义幂等键', async () => {
      await service.enqueueIncreaseBalance(
        'm1',
        't1',
        '10',
        TransType.COMMISSION_IN,
        'order1',
        '佣金结算',
        'custom-key',
      );

      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: 'custom-key' }),
        expect.any(Object),
      );
    });

    it('Given 字符串金额, When enqueueIncreaseBalance, Then 正确序列化', async () => {
      await service.enqueueIncreaseBalance('m1', 't1', '99.99', TransType.COMMISSION_IN, 'order1', '佣金结算');

      expect(mockQueue.add).toHaveBeenCalledWith(expect.objectContaining({ amount: '99.99' }), expect.any(Object));
    });
  });

  describe('enqueueDecreaseBalance', () => {
    it('Given 有效参数, When enqueueDecreaseBalance, Then 入队成功', async () => {
      const jobId = await service.enqueueDecreaseBalance(
        'm1',
        't1',
        new Decimal(50),
        TransType.REFUND_DEDUCT,
        'order1',
        '退款扣除',
      );

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletJobType.DECREASE_BALANCE,
          amount: '50',
        }),
        expect.any(Object),
      );
    });
  });

  describe('enqueueFreezeBalance', () => {
    it('Given 有效参数, When enqueueFreezeBalance, Then 入队成功', async () => {
      const jobId = await service.enqueueFreezeBalance('m1', 't1', new Decimal(100), 'withdrawal1');

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletJobType.FREEZE_BALANCE,
          amount: '100',
          relatedId: 'withdrawal1',
        }),
        expect.any(Object),
      );
    });
  });

  describe('enqueueUnfreezeBalance', () => {
    it('Given 有效参数, When enqueueUnfreezeBalance, Then 入队成功', async () => {
      const jobId = await service.enqueueUnfreezeBalance('m1', 't1', new Decimal(100), 'withdrawal1');

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletJobType.UNFREEZE_BALANCE,
        }),
        expect.any(Object),
      );
    });
  });

  describe('enqueueBatchSettle', () => {
    it('Given 多个结算项, When enqueueBatchSettle, Then 打包入队', async () => {
      const items = [
        { memberId: 'm1', amount: new Decimal(10), commissionId: 'c1' },
        { memberId: 'm2', amount: new Decimal(20), commissionId: 'c2' },
      ];

      const jobId = await service.enqueueBatchSettle('t1', items);

      expect(jobId).toBe('job-1');
      expect(mockQueue.add).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletJobType.BATCH_SETTLE,
          memberId: 'batch',
          items: [
            { memberId: 'm1', amount: '10', commissionId: 'c1' },
            { memberId: 'm2', amount: '20', commissionId: 'c2' },
          ],
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('Given 空结算列表, When enqueueBatchSettle, Then 入队空 items', async () => {
      await service.enqueueBatchSettle('t1', []);

      expect(mockQueue.add).toHaveBeenCalledWith(expect.objectContaining({ items: [] }), expect.any(Object));
    });
  });

  describe('getQueueStatus', () => {
    it('Given 队列有任务, When getQueueStatus, Then 返回各状态计数', async () => {
      const status = await service.getQueueStatus();

      expect(status).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
      });
    });
  });
});
