import { Injectable, Logger } from '@nestjs/common';
import { StatusEnum } from 'src/common/enum';
import { PrismaService } from 'src/prisma/prisma.service';
import { CODE_MANAGED_JOB_DEFAULTS, JOB_SOURCE_TYPE } from '../constants/code-managed-job.constant';
import { CodeManagedJobDefinition, JobDefinitionSyncResult } from '../interfaces/code-managed-job.interface';
import { TaskService } from '../task.service';

interface ApplyDefinitionsOptions {
  overwriteCodeOwnedFields: boolean;
}

@Injectable()
export class JobDefinitionSyncService {
  private readonly logger = new Logger(JobDefinitionSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
  ) {}

  async syncOnStartup() {
    const definitions = this.taskService.getCodeManagedJobs();
    const jobs = await this.prisma.sysJob.findMany({
      where: { sourceType: JOB_SOURCE_TYPE.CODE_MANAGED },
    });

    return this.applyDefinitions(definitions, jobs, { overwriteCodeOwnedFields: false });
  }

  async syncDefinitions() {
    const definitions = this.taskService.getCodeManagedJobs();
    const jobs = await this.prisma.sysJob.findMany({
      where: { sourceType: JOB_SOURCE_TYPE.CODE_MANAGED },
    });

    return this.applyDefinitions(definitions, jobs, { overwriteCodeOwnedFields: true });
  }

  private async applyDefinitions(
    definitions: CodeManagedJobDefinition[],
    jobs: Array<Record<string, any>>,
    options: ApplyDefinitionsOptions,
  ): Promise<JobDefinitionSyncResult> {
    this.assertNoDuplicateSourceKey(jobs);

    const jobsBySourceKey = new Map(jobs.map((job) => [job.sourceKey, job]));
    const definitionKeys = new Set(definitions.map((d) => d.key));
    const result: JobDefinitionSyncResult = {
      createdCount: 0,
      updatedCount: 0,
      driftedCount: 0,
      skippedCount: 0,
      failures: [],
      orphans: [],
    };

    // 孤儿巡检：DB 有 sourceKey 但代码已无对应 @CodeManagedJob 注册，必须显式告警
    // 防止运维误以为任务在跑（JobService.initializeJobs 也会跳过这类记录但只 warn 一次）
    for (const job of jobs) {
      const sourceKey = job.sourceKey;
      if (typeof sourceKey === 'string' && sourceKey.length > 0 && !definitionKeys.has(sourceKey)) {
        result.orphans.push({
          sourceKey,
          jobName: job.jobName,
          jobId: job.jobId,
        });
        this.logger.warn(
          `[JobDefinitionSync] 发现孤儿任务 sourceKey=${sourceKey} jobId=${job.jobId} jobName="${job.jobName}"，` +
            `代码侧 @CodeManagedJob 已移除但数据库残留，请运维确认是否清理`,
        );
      }
    }

    for (const definition of definitions) {
      try {
        const persistedJob = jobsBySourceKey.get(definition.key);
        if (!persistedJob) {
          await this.prisma.sysJob.create({
            data: {
              tenantId: '000000',
              ...this.buildJobPayload(definition),
              createBy: CODE_MANAGED_JOB_DEFAULTS.CREATE_BY,
              status: definition.enabledByDefault === false ? StatusEnum.STOP : StatusEnum.NORMAL,
            },
          });
          result.createdCount++;
          continue;
        }

        if (!this.hasDefinitionDrift(persistedJob, definition)) {
          result.skippedCount++;
          continue;
        }

        result.driftedCount++;
        if (!options.overwriteCodeOwnedFields) {
          continue;
        }

        await this.prisma.sysJob.update({
          where: { jobId: persistedJob.jobId },
          data: this.buildJobPayload(definition),
        });
        result.updatedCount++;
      } catch (error) {
        result.failures.push({
          sourceKey: definition.key,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return result;
  }

  hasDefinitionDrift(job: Record<string, any>, definition: CodeManagedJobDefinition) {
    return (
      job.jobName !== definition.name ||
      job.jobGroup !== definition.group ||
      job.invokeTarget !== definition.invokeTarget ||
      job.cronExpression !== definition.cron ||
      job.sourceType !== JOB_SOURCE_TYPE.CODE_MANAGED ||
      job.sourceKey !== definition.key ||
      job.misfirePolicy !== CODE_MANAGED_JOB_DEFAULTS.MISFIRE_POLICY ||
      job.concurrent !== CODE_MANAGED_JOB_DEFAULTS.CONCURRENT
    );
  }

  private buildJobPayload(definition: CodeManagedJobDefinition) {
    return {
      jobName: definition.name,
      jobGroup: definition.group,
      invokeTarget: definition.invokeTarget,
      cronExpression: definition.cron,
      misfirePolicy: CODE_MANAGED_JOB_DEFAULTS.MISFIRE_POLICY,
      concurrent: CODE_MANAGED_JOB_DEFAULTS.CONCURRENT,
      sourceType: JOB_SOURCE_TYPE.CODE_MANAGED,
      sourceKey: definition.key,
      lastSyncedAt: new Date(),
      updateBy: CODE_MANAGED_JOB_DEFAULTS.UPDATE_BY,
      updateTime: new Date(),
    };
  }

  private assertNoDuplicateSourceKey(jobs: Array<Record<string, any>>) {
    const seen = new Set<string>();
    for (const job of jobs) {
      const sourceKey = job.sourceKey;
      if (!sourceKey) {
        continue;
      }
      if (seen.has(sourceKey)) {
        throw new Error(`检测到重复 sourceKey: ${sourceKey}`);
      }
      seen.add(sourceKey);
    }
  }
}
