import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationStatus, SettlementExecutionStatus } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { CODE_MANAGED_JOB_METADATA } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';
import { TASK_METADATA } from 'src/module/admin/common/decorators/task.decorator';
import { SettlementCoreService } from './settlement-core.service';
import { SettlementExecutionService } from './settlement-execution.service';
import { SettlementReconciliationScheduler } from './settlement-reconciliation.scheduler';

describe('SettlementReconciliationScheduler', () => {
  let scheduler: SettlementReconciliationScheduler;

  const mockPrisma = {
    finSettlementExecution: {
      findMany: jest.fn(),
    },
  };

  const mockRedisClient = {
    set: jest.fn(),
    del: jest.fn(),
  };

  // Phase A2 后调度器走 RedisService.tryLock/unlock 的 token 化 API；
  // getClient 仍保留供 raw client 路径（本调度器目前未使用，仅为兼容历史 mock 桥接）。
  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    tryLock: jest.fn().mockResolvedValue('mock-token'),
    unlock: jest.fn().mockResolvedValue(1),
  };

  const mockSettlementExecutionService = {
    query: jest.fn(),
  };

  const mockSettlementCoreService = {
    updateExecutionFromChannel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementReconciliationScheduler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedisService },
        { provide: SettlementExecutionService, useValue: mockSettlementExecutionService },
        { provide: SettlementCoreService, useValue: mockSettlementCoreService },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    scheduler = module.get<SettlementReconciliationScheduler>(SettlementReconciliationScheduler);
    jest.clearAllMocks();
  });

  it('Given reconcileJob 方法, When 检查任务装饰器, Then 存在代码托管任务元数据', () => {
    const codeManagedMetadata = Reflect.getMetadata(CODE_MANAGED_JOB_METADATA, scheduler.reconcileJob);
    const taskMetadata = Reflect.getMetadata(TASK_METADATA, scheduler.reconcileJob);

    expect(codeManagedMetadata).toBeDefined();
    expect(codeManagedMetadata).toMatchObject({
      key: 'settlement.reconcileJob',
    });
    expect(taskMetadata).toMatchObject({
      name: 'settlement.reconcileJob',
    });
  });

  it('Given 执行中结算单查单成功, When reconcileJob, Then 回写执行结果与对账状态', async () => {
    mockRedisService.tryLock.mockResolvedValueOnce('mock-token');
    mockPrisma.finSettlementExecution.findMany.mockResolvedValue([
      {
        id: 'exec-1',
        executeNo: 'STE-001',
        status: SettlementExecutionStatus.PROCESSING,
        bill: {
          id: 'bill-1',
          payRecord: {
            transactionId: '420000000001',
          },
        },
      },
    ]);
    mockSettlementExecutionService.query.mockResolvedValue({
      executionStatus: SettlementExecutionStatus.SUCCESS,
      billStatus: 'SUCCESS',
      issueStatus: ReconciliationStatus.MATCHED,
      externalNo: 'ps-order-001',
      stage: 'CHANNEL_SUCCESS',
      message: '微信分账已完成',
      responsePayload: { state: 'FINISHED' },
    });

    await scheduler.reconcileJob();

    expect(mockSettlementExecutionService.query).toHaveBeenCalledWith(
      expect.objectContaining({
        execution: expect.objectContaining({ id: 'exec-1' }),
      }),
    );
    expect(mockSettlementCoreService.updateExecutionFromChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        executionId: 'exec-1',
        executionStatus: SettlementExecutionStatus.SUCCESS,
        issueStatus: ReconciliationStatus.MATCHED,
      }),
    );
    // Phase A2: 锁释放走 token 化 unlock(KEY, token)
    expect(mockRedisService.unlock).toHaveBeenCalledWith('lock:settlement:reconciliation', 'mock-token');
  });
});
