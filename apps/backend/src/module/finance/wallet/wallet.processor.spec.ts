import { Test, TestingModule } from '@nestjs/testing';
import { WalletProcessor } from './wallet.processor';
import { WalletService } from './wallet.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { WalletJobType } from './wallet-queue.types';
import { Decimal } from '@prisma/client/runtime/library';
import { TransType } from '@prisma/client';

describe('WalletProcessor', () => {
  let processor: WalletProcessor;

  const mockWalletService = {
    addBalance: jest.fn(),
    deductBalance: jest.fn(),
    freezeBalance: jest.fn(),
    unfreezeBalance: jest.fn(),
  };

  const mockRedisClient = {
    get: jest.fn(),
    setex: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletProcessor,
        { provide: WalletService, useValue: mockWalletService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    processor = module.get<WalletProcessor>(WalletProcessor);
    jest.clearAllMocks();
  });

  const createJob = (data: any) => ({ data, attemptsMade: 0 }) as any;

  describe('handleJob - 幂等性检查', () => {
    it('Given 已处理过的 idempotencyKey, When handleJob, Then 直接返回缓存结果', async () => {
      const cachedResult = { success: true, memberId: 'm1', balanceAfter: '110' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.INCREASE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '10',
          transType: TransType.COMMISSION_IN,
          relatedId: 'order1',
          remark: '佣金结算',
          idempotencyKey: 'inc:order1:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result).toEqual(cachedResult);
      expect(mockWalletService.addBalance).not.toHaveBeenCalled();
    });
  });

  describe('handleJob - INCREASE_BALANCE', () => {
    it('Given 增加余额任务, When handleJob, Then 调用 addBalance 并缓存结果', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.addBalance.mockResolvedValue({
        balance: new Decimal(110),
      });

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.INCREASE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '10',
          transType: TransType.COMMISSION_IN,
          relatedId: 'order1',
          remark: '佣金结算',
          idempotencyKey: 'inc:order1:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.memberId).toBe('m1');
      expect(result.balanceAfter).toBe('110');
      expect(mockWalletService.addBalance).toHaveBeenCalledWith('m1', expect.any(Decimal), 'order1', '佣金结算');
      expect(mockRedisClient.setex).toHaveBeenCalled();
    });
  });

  describe('handleJob - DECREASE_BALANCE', () => {
    it('Given 扣减余额任务, When handleJob, Then 调用 deductBalance', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.deductBalance.mockResolvedValue({
        balance: new Decimal(90),
      });

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.DECREASE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '10',
          transType: TransType.REFUND_DEDUCT,
          relatedId: 'order1',
          remark: '退款扣除',
          idempotencyKey: 'dec:order1:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.balanceAfter).toBe('90');
      expect(mockWalletService.deductBalance).toHaveBeenCalled();
    });
  });

  describe('handleJob - FREEZE_BALANCE', () => {
    it('Given 冻结余额任务, When handleJob, Then 调用 freezeBalance', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.freezeBalance.mockResolvedValue(undefined);

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.FREEZE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '50',
          relatedId: 'withdrawal1',
          idempotencyKey: 'freeze:w1:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result.success).toBe(true);
      expect(result.memberId).toBe('m1');
      expect(mockWalletService.freezeBalance).toHaveBeenCalledWith('m1', expect.any(Decimal));
    });
  });

  describe('handleJob - UNFREEZE_BALANCE', () => {
    it('Given 解冻余额任务, When handleJob, Then 调用 unfreezeBalance', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.unfreezeBalance.mockResolvedValue(undefined);

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.UNFREEZE_BALANCE,
          memberId: 'm1',
          tenantId: 't1',
          amount: '50',
          relatedId: 'withdrawal1',
          idempotencyKey: 'unfreeze:w1:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result.success).toBe(true);
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith('m1', expect.any(Decimal));
    });
  });

  describe('handleJob - BATCH_SETTLE', () => {
    it('Given 批量结算全部成功, When handleJob, Then 返回 success=true', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.addBalance.mockResolvedValue({ balance: new Decimal(100) });

      const result = await processor.handleJob(
        createJob({
          type: WalletJobType.BATCH_SETTLE,
          memberId: 'batch',
          tenantId: 't1',
          items: [
            { memberId: 'm1', amount: '10', commissionId: 'c1' },
            { memberId: 'm2', amount: '20', commissionId: 'c2' },
          ],
          idempotencyKey: 'batch:uuid1',
          createdAt: new Date(),
        }),
      );

      expect(result.success).toBe(true);
      expect(mockWalletService.addBalance).toHaveBeenCalledTimes(2);
    });

    it('Given 批量结算部分失败, When handleJob, Then 应抛出错误让 Bull 重试', async () => {
      // BUG-2 复现：m1 成功入账，m2 失败，但 handleBatchSettle 只返回 { success: false }
      // 不抛出错误 → Bull 认为 job 完成 → 幂等 key 写入失败结果 → m2 永久丢款
      // 预期：应抛出，让 Bull 重试整个 job；DB 唯一约束保证 m1 重试时不重复入账
      mockRedisClient.get.mockResolvedValue(null);
      mockWalletService.addBalance
        .mockResolvedValueOnce({ balance: new Decimal(100) })
        .mockRejectedValueOnce(new Error('余额异常'));

      await expect(
        processor.handleJob(
          createJob({
            type: WalletJobType.BATCH_SETTLE,
            memberId: 'batch',
            tenantId: 't1',
            items: [
              { memberId: 'm1', amount: '10', commissionId: 'c1' },
              { memberId: 'm2', amount: '20', commissionId: 'c2' },
            ],
            idempotencyKey: 'batch:uuid1',
            createdAt: new Date(),
          }),
        ),
      ).rejects.toThrow('余额异常');

      // 失败时不能写入幂等 key，否则重试时直接返回失败结果
      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });
  });

  describe('handleJob - 未知任务类型', () => {
    it('Given 未知任务类型, When handleJob, Then 抛出错误', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        processor.handleJob(
          createJob({
            type: 'UNKNOWN_TYPE',
            memberId: 'm1',
            tenantId: 't1',
            idempotencyKey: 'unknown:uuid1',
            createdAt: new Date(),
          }),
        ),
      ).rejects.toThrow('Unknown job type');
    });
  });

  describe('onFailed', () => {
    it('Given 任务永久失败, When onFailed, Then 记录日志不抛异常', async () => {
      // 验证 onFailed 不会抛出异常
      await expect(
        processor.onFailed(
          createJob({
            type: WalletJobType.INCREASE_BALANCE,
            memberId: 'm1',
          }),
          new Error('permanent failure'),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
