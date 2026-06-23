import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { BusinessException } from 'src/common/exceptions';
import { StatusEnum } from 'src/common/enum/index';
import { Result, ResponseCode } from 'src/common/response';
import { FormatDateFields } from 'src/common/utils/index';
import { ExportTable } from 'src/common/utils/export';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CreateJobDto, ListJobDto } from './dto/create-job.dto';
import { JOB_EDITABLE_MODE, JOB_SOURCE_TYPE } from './constants/code-managed-job.constant';
import { CodeManagedJobDefinition } from './interfaces/code-managed-job.interface';
import { JobDefinitionSyncService } from './services/job-definition-sync.service';
import { TaskService } from './task.service';

@Injectable()
export class JobService implements OnModuleInit {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly redisService: RedisService,
    private readonly tenantHelper: TenantHelper,
    private readonly jobDefinitionSyncService: JobDefinitionSyncService,
  ) {}

  async onModuleInit() {
    await this.jobDefinitionSyncService.syncOnStartup();
    await this.initializeJobs();
  }

  // 初始化任务
  private async initializeJobs() {
    const jobs = await this.prisma.sysJob.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { status: StatusEnum.NORMAL }) as Prisma.SysJobWhereInput,
    });
    const codeManagedDefinitions = this.getCodeManagedJobMap();

    jobs.forEach((job) => {
      if (job.sourceType === JOB_SOURCE_TYPE.CODE_MANAGED) {
        const definition = job.sourceKey ? codeManagedDefinitions.get(job.sourceKey) : undefined;
        if (!definition) {
          this.logger.warn(`代码托管任务定义已移除，跳过注册: ${job.sourceKey ?? job.jobName}`);
          return;
        }

        this.addCronJob(job.jobName, job.cronExpression, job.invokeTarget, definition);
        return;
      }

      this.addCronJob(job.jobName, job.cronExpression, job.invokeTarget);
    });
  }

  // 查询任务列表
  async list(query: ListJobDto) {
    const where: Prisma.SysJobWhereInput = {};

    if (query.jobName) {
      where.jobName = { contains: query.jobName };
    }
    if (query.jobGroup) {
      where.jobGroup = query.jobGroup;
    }
    if (query.status) {
      where.status = query.status as StatusEnum;
    }

    const scopedWhere = this.tenantHelper.readWhereForDelegate('sysJob', where) as Prisma.SysJobWhereInput;
    const definitions = this.getCodeManagedJobMap();

    const [list, total] = await this.prisma.$transaction([
      this.prisma.sysJob.findMany({
        where: scopedWhere,
        skip: query.skip,
        take: query.take,
        orderBy: {
          createTime: 'desc',
        },
      }),
      this.prisma.sysJob.count({ where: scopedWhere }),
    ]);

    return Result.page(FormatDateFields(list.map((job) => this.decorateJob(job, definitions))), total);
  }

  // 获取单个任务
  async getJob(jobId: number) {
    const job = await this.prisma.sysJob.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: Number(jobId) }) as Prisma.SysJobWhereInput,
    });
    BusinessException.throwIfNull(job, '任务不存在', ResponseCode.DATA_NOT_FOUND);
    return Result.ok(this.decorateJob(job, this.getCodeManagedJobMap()));
  }

  // 创建任务
  @Transactional()
  async create(createJobDto: CreateJobDto, userName: string) {
    const job = await this.prisma.sysJob.create({
      data: {
        ...createJobDto,
        sourceType: JOB_SOURCE_TYPE.MANUAL,
        sourceKey: null,
        lastSyncedAt: null,
        status: createJobDto.status as StatusEnum,
        createBy: userName,
        updateBy: userName,
      },
    });

    if (job.status === StatusEnum.NORMAL) {
      this.addCronJob(job.jobName, job.cronExpression, createJobDto.invokeTarget);
    }

    return Result.ok();
  }

  @Transactional()
  async update(jobId: number, updateJobDto: Partial<CreateJobDto>, userName: string) {
    const job = await this.prisma.sysJob.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: Number(jobId) }) as Prisma.SysJobWhereInput,
    });
    BusinessException.throwIfNull(job, '任务不存在', ResponseCode.DATA_NOT_FOUND);

    const normalizedUpdateDto = this.normalizeUpdatePayload(job, updateJobDto);
    const nextStatus = normalizedUpdateDto.status ?? job.status;
    const nextCron = normalizedUpdateDto.cronExpression ?? job.cronExpression;
    const nextInvokeTarget = normalizedUpdateDto.invokeTarget ?? job.invokeTarget;

    const hasJobConfigChanged =
      nextCron !== job.cronExpression || nextStatus !== job.status || nextInvokeTarget !== job.invokeTarget;

    if (hasJobConfigChanged) {
      const cronJob = this.getCronJob(job.jobName);
      if (cronJob) {
        this.deleteCronJob(job.jobName);
      }

      if (nextStatus === StatusEnum.NORMAL) {
        const definition = this.getCodeManagedDefinition(job.sourceType, job.sourceKey);
        if (job.sourceType === JOB_SOURCE_TYPE.CODE_MANAGED && !definition) {
          BusinessException.throw(ResponseCode.PARAM_INVALID, '代码托管任务定义已移除，无法启用');
        }
        this.addCronJob(job.jobName, nextCron, nextInvokeTarget, definition);
      }
    }

    await this.prisma.sysJob.update({
      where: { jobId: Number(jobId) },
      data: {
        ...normalizedUpdateDto,
        status: normalizedUpdateDto.status as StatusEnum,
        updateBy: userName,
        updateTime: new Date(),
      },
    });

    return Result.ok();
  }

  @Transactional()
  async remove(jobIds: number | number[]) {
    const ids = Array.isArray(jobIds) ? jobIds : [jobIds];
    const jobs = await this.prisma.sysJob.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: { in: ids } }) as Prisma.SysJobWhereInput,
    });

    if (jobs.some((job) => job.sourceType === JOB_SOURCE_TYPE.CODE_MANAGED)) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, '代码托管任务不允许手动删除');
    }

    for (const job of jobs) {
      try {
        this.deleteCronJob(job.jobName);
      } catch {
        // ignore
      }
    }

    await this.prisma.sysJob.deleteMany({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: { in: ids } }) as Prisma.SysJobWhereInput,
    });
    return Result.ok();
  }

  // 改变任务状态
  async changeStatus(jobId: number, status: StatusEnum, userName: string) {
    const job = await this.prisma.sysJob.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: Number(jobId) }) as Prisma.SysJobWhereInput,
    });
    BusinessException.throwIfNull(job, '任务不存在', ResponseCode.DATA_NOT_FOUND);

    const cronJob = this.getCronJob(job.jobName);
    const definition = this.getCodeManagedDefinition(job.sourceType, job.sourceKey);

    if (status === StatusEnum.NORMAL) {
      if (job.sourceType === JOB_SOURCE_TYPE.CODE_MANAGED && !definition) {
        BusinessException.throw(ResponseCode.PARAM_INVALID, '代码托管任务定义已移除，无法启用');
      }

      if (!cronJob) {
        this.addCronJob(job.jobName, job.cronExpression, job.invokeTarget, definition);
      } else {
        cronJob.start();
      }
    } else if (cronJob) {
      cronJob.stop();
    }

    await this.prisma.sysJob.update({
      where: { jobId: Number(jobId) },
      data: {
        status: status as StatusEnum,
        updateBy: userName,
        updateTime: new Date(),
      },
    });

    return Result.ok();
  }

  // 立即执行一次
  async run(jobId: number) {
    const job = await this.prisma.sysJob.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysJob', { jobId: Number(jobId) }) as Prisma.SysJobWhereInput,
    });
    BusinessException.throwIfNull(job, '任务不存在', ResponseCode.DATA_NOT_FOUND);

    await this.taskService.executeTask(job.invokeTarget, job.jobName, job.jobGroup);
    return Result.ok();
  }

  async syncDefinitions() {
    return Result.ok(await this.jobDefinitionSyncService.syncDefinitions());
  }

  // 添加定时任务到调度器
  private addCronJob(
    name: string,
    cronTime: string | null,
    invokeTarget: string,
    definition?: CodeManagedJobDefinition,
  ) {
    if (!cronTime) {
      return;
    }

    // Quartz 允许日/周字段用 `?` 占位，node-cron 不识别 `?`：必须全部替换为 `*`，
    // 否则「日和周都是 `?`」（例如 `0 0 12 ? * ?`）会触发 node-cron 解析失败。
    cronTime = cronTime.replaceAll('?', '*');
    const executionHandler = definition
      ? this.createExecutionHandler(definition)
      : this.createManualExecutionHandler(name, invokeTarget);

    const job = new CronJob(cronTime, executionHandler);
    this.schedulerRegistry.addCronJob(name, job as CronJob);
    job.start();
  }

  private createManualExecutionHandler(name: string, invokeTarget: string) {
    return this.withPlatformLock(name, invokeTarget, async () => {
      await this.taskService.executeTask(invokeTarget, name);
    });
  }

  private createExecutionHandler(definition: Pick<CodeManagedJobDefinition, 'key' | 'invokeTarget' | 'guardMode'>) {
    const baseHandler = async () => {
      await this.taskService.executeTask(definition.invokeTarget);
    };
    if (definition.guardMode === 'self-managed') {
      return baseHandler;
    }
    return this.withPlatformLock(definition.key, definition.invokeTarget, baseHandler);
  }

  private withPlatformLock(lockName: string, invokeTarget: string, handler: () => Promise<unknown>) {
    return async () => {
      const lockKey = `sys:job:${lockName}`;
      const lockToken = await this.redisService.tryLock(lockKey, 30000);

      if (!lockToken) {
        this.logger.warn(`定时任务 ${lockName} 未获取到锁，跳过本次执行`);
        return;
      }

      try {
        this.logger.warn(`定时任务 ${lockName} 正在执行，调用方法: ${invokeTarget}`);
        await handler();
      } finally {
        await this.redisService.unlock(lockKey, lockToken);
      }
    };
  }

  private deleteCronJob(name: string) {
    this.schedulerRegistry.deleteCronJob(name);
  }

  private getCronJob(name: string): CronJob | null {
    try {
      return this.schedulerRegistry.getCronJob(name) as unknown as CronJob;
    } catch {
      return null;
    }
  }

  private normalizeUpdatePayload(job: Record<string, any>, updateJobDto: Partial<CreateJobDto>) {
    if (job.sourceType !== JOB_SOURCE_TYPE.CODE_MANAGED) {
      return updateJobDto;
    }

    const allowedKeys = new Set(['status', 'remark']);
    const changedCodeOwnedKeys = Object.keys(updateJobDto).filter((key) => {
      if (!allowedKeys.has(key)) {
        return updateJobDto[key as keyof CreateJobDto] !== undefined;
      }
      return false;
    });

    if (changedCodeOwnedKeys.length > 0) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, '代码托管任务仅允许修改状态和备注');
    }

    return {
      status: updateJobDto.status,
      remark: updateJobDto.remark,
    };
  }

  private decorateJob(job: Record<string, any>, definitions: Map<string, CodeManagedJobDefinition>) {
    const sourceType = job.sourceType ?? JOB_SOURCE_TYPE.MANUAL;
    const definition =
      sourceType === JOB_SOURCE_TYPE.CODE_MANAGED && job.sourceKey ? definitions.get(job.sourceKey) : undefined;

    return {
      ...job,
      sourceType,
      sourceKey: job.sourceKey ?? undefined,
      editableMode:
        sourceType === JOB_SOURCE_TYPE.CODE_MANAGED ? JOB_EDITABLE_MODE.STATUS_REMARK_ONLY : JOB_EDITABLE_MODE.FULL,
      definitionDrift:
        sourceType === JOB_SOURCE_TYPE.CODE_MANAGED && definition
          ? this.jobDefinitionSyncService.hasDefinitionDrift(job, definition)
          : false,
      definitionRemoved: sourceType === JOB_SOURCE_TYPE.CODE_MANAGED && !definition,
      guardMode: definition?.guardMode,
    };
  }

  private getCodeManagedJobMap() {
    return new Map(this.taskService.getCodeManagedJobs().map((definition) => [definition.key, definition]));
  }

  private getCodeManagedDefinition(sourceType?: string | null, sourceKey?: string | null) {
    if (sourceType !== JOB_SOURCE_TYPE.CODE_MANAGED || !sourceKey) {
      return undefined;
    }
    return this.getCodeManagedJobMap().get(sourceKey);
  }

  /**
   * 导出定时任务为xlsx文件
   * @param res
   */
  async export(res: Response, body: ListJobDto) {
    const list = await this.list(body);
    const options = {
      sheetName: '定时任务',
      data: list.data.rows,
      header: [
        { title: '任务编号', dataIndex: 'jobId' },
        { title: '任务名称', dataIndex: 'jobName' },
        { title: '任务组名', dataIndex: 'jobGroup' },
        { title: '调用目标字符串', dataIndex: 'invokeTarget' },
        { title: 'cron执行表达式', dataIndex: 'cronExpression' },
      ],
      dictMap: {
        status: {
          '0': '成功',
          '1': '失败',
        },
        jobGroup: {
          SYSTEM: '系统',
          DEFAULT: '默认',
          FINANCE: '财务',
          MARKETING: '营销',
          STORE: '商城',
        },
      },
    };
    return await ExportTable(options, res);
  }
}
