import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalReconciliationScheduler } from './withdrawal-reconciliation.scheduler';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { WithdrawalStatus } from '@prisma/client';
import { CODE_MANAGED_JOB_METADATA } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { TASK_METADATA } from 'src/module/admin/common/decorators/task.decorator';
import { WithdrawalPaymentService } from './withdrawal-payment.service';
import { WithdrawalAuditService } from './withdrawal-audit.service';
import { WithdrawalRepository } from './withdrawal.repository';

describe('WithdrawalReconciliationScheduler', () => {
  let scheduler: WithdrawalReconciliationScheduler;

  const mockTx = {
    finWithdrawal: { update: jest.fn() },
  };

  const mockPrisma = {
    finWithdrawal: { findMany: jest.fn() },
    $transaction: jest.fn((cb: any) => cb(mockTx)),
  };

  const mockRedisClient = {
    set: jest.fn(),
    del: jest.fn(),
    get: jest.fn(),
  };

  // Phase A2 后调度器走 RedisService.tryLock/unlock 的 token 化 API；
  // getClient 保留供历史 raw client 路径桥接（本调度器目前已不再使用 raw client）。
  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    tryLock: jest.fn().mockResolvedValue('mock-token'),
    unlock: jest.fn().mockResolvedValue(1),
  };

  const mockWalletService = {
    unfreezeBalance: jest.fn(),
    deductFrozen: jest.fn(),
  };

  const mockPaymentService = {
    queryStatus: jest.fn(),
  };

  const mockAuditService = {
    retryPayment: jest.fn(),
    completeChannelConfirmedSuccess: jest.fn(),
  };

  const mockWithdrawalRepo = {
    updateStatusIfCurrent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalReconciliationScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: WithdrawalPaymentService, useValue: mockPaymentService },
        { provide: WithdrawalAuditService, useValue: mockAuditService },
        { provide: WithdrawalRepository, useValue: mockWithdrawalRepo },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    scheduler = module.get<WithdrawalReconciliationScheduler>(WithdrawalReconciliationScheduler);
    jest.clearAllMocks();
    mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(1);
    mockAuditService.completeChannelConfirmedSuccess.mockResolvedValue(true);
  });

  describe('Cron 元数据', () => {
    it('Given reconcileJob 方法, When 检查任务装饰器, Then 存在代码托管任务元数据', () => {
      const codeManagedMetadata = Reflect.getMetadata(CODE_MANAGED_JOB_METADATA, scheduler.reconcileJob);
      const taskMetadata = Reflect.getMetadata(TASK_METADATA, scheduler.reconcileJob);

      expect(codeManagedMetadata).toBeDefined();
      expect(codeManagedMetadata).toMatchObject({
        key: 'withdrawal.reconcileJob',
      });
      expect(taskMetadata).toMatchObject({
        name: 'withdrawal.reconcileJob',
      });
    });
  });

  describe('reconcileJob - 分布式锁', () => {
    it('Given 获取锁成功, When reconcileJob, Then 执行对账并释放锁', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce('mock-token');
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([]);

      await scheduler.reconcileJob();

      // Phase A2: 走 RedisService.tryLock(KEY, ttlMs)，TTL 单位毫秒
      expect(mockRedisService.tryLock).toHaveBeenCalledWith('lock:withdrawal:reconciliation', 5 * 60 * 1000);
      expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:withdrawal:reconciliation', 'mock-token');
    });

    // C2.3: 积压 > take 上限时，未带 orderBy 会让最老记录永远排不到处理位次
    it('对账查询必须按 createTime 升序，确保积压时最老记录优先处理', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce('mock-token');
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([]);

      await scheduler.reconcileJob();

      expect(mockPrisma.finWithdrawal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createTime: 'asc' },
          take: 50,
        }),
      );
    });

    it('Given 获取锁失败, When reconcileJob, Then 跳过执行', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce(null);

      await scheduler.reconcileJob();

      expect(mockPrisma.finWithdrawal.findMany).not.toHaveBeenCalled();
      expect(mockRedisService.unlock).not.toHaveBeenCalled();
    });

    it('Given 获取锁异常, When reconcileJob, Then 跳过执行不抛异常', async () => {
      mockRedisService.tryLock.mockRejectedValueOnce(new Error('Redis connection error'));

      await expect(scheduler.reconcileJob()).resolves.toBeUndefined();
      expect(mockPrisma.finWithdrawal.findMany).not.toHaveBeenCalled();
      expect(mockRedisService.unlock).not.toHaveBeenCalled();
    });
  });

  describe('reconcileJob - 对账逻辑', () => {
    beforeEach(() => {
      mockRedisService.tryLock.mockResolvedValue('mock-token');
    });

    it('Given 无超时记录, When reconcileJob, Then 不处理任何记录', async () => {
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([]);

      await scheduler.reconcileJob();

      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
      expect(mockPaymentService.queryStatus).not.toHaveBeenCalled();
    });

    it('Given 有无 paymentNo 的失败记录且无法重试, When reconcileJob, Then CAS 自动驳回并解冻余额', async () => {
      const failedRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        paymentNo: null,
        status: WithdrawalStatus.FAILED,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([failedRecord]);
      mockAuditService.retryPayment.mockResolvedValue(false);

      await scheduler.reconcileJob();

      expect(mockAuditService.retryPayment).toHaveBeenCalledWith('w1');
      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'w1',
        WithdrawalStatus.FAILED,
        expect.objectContaining({
          status: WithdrawalStatus.REJECTED,
          auditRemark: expect.stringContaining('系统对账'),
        }),
      );
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith('m1', 50);
    });

    it('Given 无 paymentNo 的失败记录重试成功, When reconcileJob, Then 不自动驳回或解冻', async () => {
      const failedRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        paymentNo: null,
        status: WithdrawalStatus.FAILED,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([failedRecord]);
      mockAuditService.retryPayment.mockResolvedValue(true);

      await scheduler.reconcileJob();

      expect(mockAuditService.retryPayment).toHaveBeenCalledWith('w1');
      expect(mockWithdrawalRepo.updateStatusIfCurrent).not.toHaveBeenCalled();
      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
    });

    it('Given 无 paymentNo 的超时记录 CAS 失败, When reconcileJob, Then 不解冻余额', async () => {
      const failedRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        paymentNo: null,
        status: WithdrawalStatus.FAILED,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([failedRecord]);
      mockAuditService.retryPayment.mockResolvedValue(false);
      mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(0);

      await scheduler.reconcileJob();

      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'w1',
        WithdrawalStatus.FAILED,
        expect.objectContaining({ status: WithdrawalStatus.REJECTED }),
      );
      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
    });

    it('Given 有 paymentNo 的处理中记录, When reconcileJob, Then 查询支付平台并在成功后委托审核服务完成入账', async () => {
      const processingRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        actualAmount: 48,
        paymentNo: 'WX123456',
        status: WithdrawalStatus.PROCESSING as WithdrawalStatus,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([processingRecord]);
      mockPaymentService.queryStatus.mockResolvedValue({
        status: 'SUCCESS',
        rawStatus: 'SUCCESS',
        finishTime: new Date('2026-04-23T12:00:00+08:00'),
      });

      await scheduler.reconcileJob();

      expect(mockPaymentService.queryStatus).toHaveBeenCalledWith('WX123456');
      expect(mockAuditService.completeChannelConfirmedSuccess).toHaveBeenCalledWith(
        processingRecord,
        'WX123456',
        WithdrawalStatus.PROCESSING,
        new Date('2026-04-23T12:00:00+08:00'),
      );
      expect(mockWalletService.deductFrozen).not.toHaveBeenCalled();
    });

    it('Given 有 paymentNo 的记录通道失败, When reconcileJob, Then CAS 终止并只在成功后解冻余额', async () => {
      const processingRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        actualAmount: 48,
        paymentNo: 'WX123456',
        status: WithdrawalStatus.PROCESSING as WithdrawalStatus,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([processingRecord]);
      mockPaymentService.queryStatus.mockResolvedValue({
        status: 'FAILED',
        rawStatus: 'FAIL',
        failReason: '通道失败',
      });

      await scheduler.reconcileJob();

      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'w1',
        WithdrawalStatus.PROCESSING,
        expect.objectContaining({
          status: WithdrawalStatus.REJECTED,
          failReason: '通道失败',
          auditRemark: expect.stringContaining('通道确认失败'),
        }),
      );
      expect(mockWalletService.unfreezeBalance).toHaveBeenCalledWith('m1', 50);
    });

    it('Given 有 paymentNo 的记录通道失败但 CAS 失败, When reconcileJob, Then 不解冻余额', async () => {
      const processingRecord = {
        id: 'w1',
        memberId: 'm1',
        amount: 50,
        actualAmount: 48,
        paymentNo: 'WX123456',
        status: WithdrawalStatus.PROCESSING as WithdrawalStatus,
      };
      mockPrisma.finWithdrawal.findMany.mockResolvedValue([processingRecord]);
      mockPaymentService.queryStatus.mockResolvedValue({
        status: 'FAILED',
        rawStatus: 'FAIL',
        failReason: '通道失败',
      });
      mockWithdrawalRepo.updateStatusIfCurrent.mockResolvedValue(0);

      await scheduler.reconcileJob();

      expect(mockWithdrawalRepo.updateStatusIfCurrent).toHaveBeenCalledWith(
        'w1',
        WithdrawalStatus.PROCESSING,
        expect.objectContaining({ status: WithdrawalStatus.REJECTED }),
      );
      expect(mockWalletService.unfreezeBalance).not.toHaveBeenCalled();
    });

    it('Given 多条失败记录且部分处理异常, When reconcileJob, Then 继续处理其余记录', async () => {
      const records = [
        { id: 'w1', memberId: 'm1', amount: 50, paymentNo: null, status: WithdrawalStatus.FAILED },
        { id: 'w2', memberId: 'm2', amount: 30, paymentNo: null, status: WithdrawalStatus.FAILED },
      ];
      mockPrisma.finWithdrawal.findMany.mockResolvedValue(records);
      mockPrisma.$transaction
        .mockRejectedValueOnce(new Error('DB error'))
        .mockImplementationOnce((cb: any) => cb(mockTx));
      mockAuditService.retryPayment.mockResolvedValue(false);

      await scheduler.reconcileJob();

      // 第二条记录仍应被处理
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('reconcileJob - 锁释放保证', () => {
    it('Given 对账过程中抛异常, When reconcileJob, Then 仍然释放锁', async () => {
      mockRedisService.tryLock.mockResolvedValueOnce('mock-token');
      mockPrisma.finWithdrawal.findMany.mockRejectedValue(new Error('DB error'));

      await expect(scheduler.reconcileJob()).rejects.toThrow('DB error');
      // Phase A2: 释放锁走 token 化 unlock
      expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:withdrawal:reconciliation', 'mock-token');
    });
  });
});
