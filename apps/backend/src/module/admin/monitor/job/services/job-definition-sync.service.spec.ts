import { StatusEnum } from 'src/common/enum';
import { createPrismaMock, PrismaMock } from 'src/test-utils/prisma-mock';
import { JobDefinitionSyncService } from './job-definition-sync.service';

describe('JobDefinitionSyncService', () => {
  let prisma: PrismaMock;
  let service: JobDefinitionSyncService;

  const taskService = {
    getCodeManagedJobs: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    service = new JobDefinitionSyncService(prisma as any, taskService as any);
  });

  it('启动同步时自动补齐缺失任务，但不覆盖运维字段', async () => {
    taskService.getCodeManagedJobs.mockReturnValue([
      {
        key: 'stock.handleStockAlert',
        name: '库存预警扫描',
        group: 'STORE',
        cron: '0 0 9 * * *',
        guardMode: 'platform-lock',
        invokeTarget: 'stock.handleStockAlert',
        enabledByDefault: true,
      },
    ]);
    prisma.sysJob.findMany.mockResolvedValue([]);

    const result = await service.syncOnStartup();

    expect(prisma.sysJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'CODE_MANAGED',
          sourceKey: 'stock.handleStockAlert',
          jobName: '库存预警扫描',
          status: StatusEnum.NORMAL,
        }),
      }),
    );
    expect(result.createdCount).toBe(1);
    expect(result.updatedCount).toBe(0);
  });

  it('手动同步只回写代码拥有字段，保留 status 和 remark', async () => {
    taskService.getCodeManagedJobs.mockReturnValue([
      {
        key: 'finance.settleJob',
        name: '佣金结算到钱包',
        group: 'FINANCE',
        cron: '0 */5 * * * *',
        guardMode: 'self-managed',
        invokeTarget: 'finance.settleJob',
        enabledByDefault: true,
      },
    ]);
    prisma.sysJob.findMany.mockResolvedValue([
      {
        jobId: 1,
        sourceType: 'CODE_MANAGED',
        sourceKey: 'finance.settleJob',
        jobName: '旧名称',
        jobGroup: 'DEFAULT',
        invokeTarget: 'old.target',
        cronExpression: '0 */30 * * * *',
        status: '1',
        remark: '人工停用',
      },
    ]);

    const result = await service.syncDefinitions();

    expect(prisma.sysJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { jobId: 1 },
        data: expect.objectContaining({
          jobName: '佣金结算到钱包',
          jobGroup: 'FINANCE',
          invokeTarget: 'finance.settleJob',
          cronExpression: '0 */5 * * * *',
        }),
      }),
    );
    const updatePayload = prisma.sysJob.update.mock.calls[0][0].data;
    expect(updatePayload.status).toBeUndefined();
    expect(updatePayload.remark).toBeUndefined();
    expect(result.updatedCount).toBe(1);
  });

  it('代码侧已移除但数据库还有的任务被标记为孤儿并 warn 告警', async () => {
    taskService.getCodeManagedJobs.mockReturnValue([
      {
        key: 'finance.settleJob',
        name: '佣金结算到钱包',
        group: 'FINANCE',
        cron: '0 */5 * * * *',
        guardMode: 'self-managed',
        invokeTarget: 'finance.settleJob',
      },
    ]);
    prisma.sysJob.findMany.mockResolvedValue([
      {
        jobId: 11,
        sourceType: 'CODE_MANAGED',
        sourceKey: 'finance.settleJob',
        jobName: '佣金结算到钱包',
        jobGroup: 'FINANCE',
        invokeTarget: 'finance.settleJob',
        cronExpression: '0 */5 * * * *',
        misfirePolicy: 'IGNORE',
        concurrent: 'N',
      },
      {
        jobId: 99,
        sourceType: 'CODE_MANAGED',
        sourceKey: 'marketing.cleanupExpiredData',
        jobName: '清理过期营销数据',
        jobGroup: 'MARKETING',
        invokeTarget: 'marketing.cleanupExpiredData',
        cronExpression: '0 0 2 * * *',
      },
    ]);
    const warnSpy = jest
      .spyOn((service as unknown as { logger: { warn: jest.Mock } }).logger, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.syncOnStartup();

    expect(result.orphans).toEqual([
      { sourceKey: 'marketing.cleanupExpiredData', jobName: '清理过期营销数据', jobId: 99 },
    ]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('marketing.cleanupExpiredData');
    // 孤儿不影响在场 definition 的 create / update / skip 计数（细节由其他用例覆盖）
    expect(result.failures).toEqual([]);
    warnSpy.mockRestore();
  });

  it('启动同步发现同一 sourceKey 重复时直接抛错', async () => {
    taskService.getCodeManagedJobs.mockReturnValue([
      {
        key: 'marketing.cleanupExpiredData',
        name: '清理营销过期数据',
        group: 'MARKETING',
        cron: '0 */30 * * * *',
        guardMode: 'self-managed',
        invokeTarget: 'marketing.cleanupExpiredData',
      },
    ]);
    prisma.sysJob.findMany.mockResolvedValue([
      { jobId: 1, sourceType: 'CODE_MANAGED', sourceKey: 'marketing.cleanupExpiredData' },
      { jobId: 2, sourceType: 'CODE_MANAGED', sourceKey: 'marketing.cleanupExpiredData' },
    ]);

    await expect(service.syncOnStartup()).rejects.toThrow('sourceKey');
  });
});
