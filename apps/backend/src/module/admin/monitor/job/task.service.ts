import { Prisma, Status, DelFlag } from '@prisma/client';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Task, TaskRegistry } from 'src/module/admin/common/decorators/task.decorator';
import { getErrorMessage, getErrorStack } from 'src/common/utils/error';
import { JobLogService } from './job-log.service';
import { BusinessException } from 'src/common/exceptions/index';
import { ResponseCode } from 'src/common/response';
import { PrismaService } from 'src/prisma/prisma.service';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { NoticeService } from 'src/module/admin/system/notice/notice.service';
import { VersionService } from 'src/module/admin/upload/services/version.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { CodeManagedJobRegistry } from './decorators/code-managed-job.decorator';
import { CodeManagedJobDefinition } from './interfaces/code-managed-job.interface';

@Injectable()
export class TaskService implements OnModuleInit {
  private readonly logger = new Logger(TaskService.name);
  /** 任务名 -> 任务方法（动态注册的 Service 方法） */
  private readonly taskMap = new Map<string, (...args: unknown[]) => unknown>();
  /** 代码托管任务定义 */
  private readonly codeManagedJobs = new Map<string, CodeManagedJobDefinition>();
  private serviceInstances = new Map<string, unknown>();
  private initialized = false;

  constructor(
    private moduleRef: ModuleRef,
    private jobLogService: JobLogService,
    private prisma: PrismaService,
    private noticeService: NoticeService,
    private versionService: VersionService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  onModuleInit() {
    this.ensureInitialized();
  }

  /**
   * 初始化任务映射
   */
  private initializeTasks() {
    const tasks = TaskRegistry.getInstance().getTasks();

    for (const { classOrigin, methodName, metadata } of tasks) {
      try {
        let serviceInstance = this.serviceInstances.get(classOrigin.name);
        if (!serviceInstance) {
          serviceInstance = this.moduleRef.get(classOrigin, { strict: false });
          this.serviceInstances.set(classOrigin.name, serviceInstance);
        }

        // 绑定方法到实例（动态获取的 Service 实例，方法名来自装饰器注册）
        const instance = serviceInstance as Record<string, (...args: unknown[]) => unknown>;
        const method = instance[methodName].bind(serviceInstance);
        this.taskMap.set(metadata.name, method);

        const codeManagedEntry = CodeManagedJobRegistry.getInstance().get(classOrigin, methodName);
        if (codeManagedEntry) {
          this.registerCodeManagedJob({
            ...codeManagedEntry.metadata,
            invokeTarget: metadata.name,
          });
        }
        this.logger.log(`注册任务: ${metadata.name}`);
      } catch (error) {
        this.logger.error(`注册任务失败 ${metadata.name}: ${getErrorMessage(error)}`);
      }
    }
    this.initialized = true;
  }

  private ensureInitialized() {
    if (!this.initialized) {
      this.initializeTasks();
    }
  }

  /**
   * 获取所有已注册的任务
   */
  getTasks() {
    this.ensureInitialized();
    return Array.from(this.taskMap.keys());
  }

  registerCodeManagedJob(definition: CodeManagedJobDefinition) {
    if (this.codeManagedJobs.has(definition.key)) {
      throw new Error(`代码托管任务重复注册: ${definition.key}`);
    }
    this.codeManagedJobs.set(definition.key, definition);
  }

  getCodeManagedJobs() {
    this.ensureInitialized();
    return Array.from(this.codeManagedJobs.values());
  }

  /**
   * 执行任务并记录日志
   */
  async executeTask(invokeTarget: string, jobName?: string, jobGroup?: string) {
    this.ensureInitialized();
    const startTime = new Date();
    let status: Status = Status.NORMAL;
    let jobMessage = '执行成功';
    let exceptionInfo = '';

    try {
      // 使用正则表达式解析函数名和参数
      const regex = /^([^(]+)(?:\((.*)\))?$/;
      const match = invokeTarget.match(regex);

      BusinessException.throwIfNull(match, '调用目标格式错误', ResponseCode.PARAM_INVALID);

      const [, methodName, paramsStr] = match;
      const params = paramsStr ? this.parseParams(paramsStr) : [];

      // 获取任务方法
      const taskFn = this.taskMap.get(methodName);
      BusinessException.throwIfNull(taskFn, `任务 ${methodName} 不存在`, ResponseCode.DATA_NOT_FOUND);
      // 执行任务
      await taskFn(...params);
      return true;
    } catch (error) {
      status = Status.STOP;
      jobMessage = '执行失败';
      exceptionInfo = getErrorMessage(error);
      this.logger.error(`执行任务失败: ${getErrorMessage(error)}`);
      return false;
    } finally {
      // 记录日志
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      await this.jobLogService.addJobLog({
        jobName: jobName || '未知任务',
        jobGroup: jobGroup || 'DEFAULT',
        invokeTarget,
        status: status as Status,
        jobMessage: `${jobMessage}，耗时 ${duration}ms`,
        exceptionInfo,
        createTime: startTime,
      });
    }
  }

  /**
   * 解析 invokeTarget 中的参数字符串
   *
   * 安全约束：sysJob.invokeTarget 来自数据库，任何 admin 可写，必须按白名单解析，
   * 严禁回到 new Function / eval 路径（参考 RCE 攻击面）。
   *
   * 允许的字面量：string / number / boolean / null / 纯对象 / 纯数组。
   * 拒绝：__proto__ / constructor / prototype 键、嵌套深度 > 5、长度 > 1024。
   * 任何解析失败或越界都抛 BusinessException，由 executeTask 的外层 try/catch
   * 转为 STOP 状态写入 job log，调用方不会被实际触发。
   */
  private parseParams(paramsStr: string): unknown[] {
    if (!paramsStr.trim()) {
      return [];
    }

    if (paramsStr.length > TaskService.MAX_INVOKE_TARGET_PARAMS_LEN) {
      BusinessException.throw(
        ResponseCode.PARAM_INVALID,
        `任务参数长度 ${paramsStr.length} 超过上限 ${TaskService.MAX_INVOKE_TARGET_PARAMS_LEN}`,
      );
    }

    const normalizedStr = paramsStr
      // 兼容历史：单引号字符串 → JSON 双引号
      .replace(/'/g, '"')
      // 兼容历史：未加引号的对象 key 自动补引号
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    let parsed: unknown;
    try {
      parsed = JSON.parse(`[${normalizedStr}]`);
    } catch (error) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, `任务参数格式非法: ${getErrorMessage(error)}`);
    }

    if (!Array.isArray(parsed)) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, '任务参数必须是数组');
    }

    for (const item of parsed) {
      this.assertSafeLiteral(item, 0);
    }
    return parsed;
  }

  /** 限制 sysJob.invokeTarget 参数字符串总长度，防止超长解析 DoS 与日志膨胀 */
  private static readonly MAX_INVOKE_TARGET_PARAMS_LEN = 1024;

  /** 限制对象/数组嵌套深度，避免栈溢出 */
  private static readonly MAX_PARAM_DEPTH = 5;

  /** 原型链污染常用键，无论字面键名还是 \uXXXX 转义都会被 JSON.parse 还原后命中 */
  private static readonly FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

  private assertSafeLiteral(value: unknown, depth: number): void {
    if (depth > TaskService.MAX_PARAM_DEPTH) {
      BusinessException.throw(ResponseCode.PARAM_INVALID, '任务参数嵌套过深');
    }
    if (value === null) return;
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return;
    if (Array.isArray(value)) {
      for (const item of value) this.assertSafeLiteral(item, depth + 1);
      return;
    }
    if (t === 'object') {
      // Object.prototype 不会被 JSON.parse 写入，但 own property "__proto__" 会出现，
      // 必须按 own keys 校验，包括 Unicode 转义还原后的键。
      for (const key of Object.keys(value as object)) {
        if (TaskService.FORBIDDEN_KEYS.has(key)) {
          BusinessException.throw(ResponseCode.PARAM_INVALID, `任务参数键 ${key} 不允许使用`);
        }
        this.assertSafeLiteral((value as Record<string, unknown>)[key], depth + 1);
      }
      return;
    }
    BusinessException.throw(ResponseCode.PARAM_INVALID, `任务参数含不支持的类型: ${t}`);
  }

  @Task({
    name: 'task.noParams',
    description: '无参示例任务',
  })
  async ryNoParams() {
    this.logger.log('执行无参示例任务');
  }

  @Task({
    name: 'task.params',
    description: '有参示例任务',
  })
  async ryParams(param1: string, param2: number, param3: boolean) {
    this.logger.log(`执行有参示例任务，参数：${JSON.stringify({ param1, param2, param3 })}`);
  }

  /**
   * 存储配额预警任务
   * 检查所有租户的存储使用情况，超过80%发送预警通知
   */
  @Task({
    name: 'storageQuotaAlert',
    description: '存储配额预警',
  })
  @IgnoreTenant()
  async storageQuotaAlert() {
    this.logger.log('开始执行存储配额预警任务');

    try {
      // 查询所有正常状态的租户
      const tenants = await this.prisma.sysTenant.findMany({
        where: {
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
        },
        select: {
          tenantId: true,
          companyName: true,
          storageQuota: true,
          storageUsed: true,
          contactUserName: true,
        },
      });

      let alertCount = 0;

      for (const tenant of tenants) {
        const { tenantId, companyName, storageQuota, storageUsed, contactUserName } = tenant;

        // 计算使用百分比
        const percentage = storageQuota > 0 ? (storageUsed / storageQuota) * 100 : 0;

        // 如果使用超过80%，发送预警通知
        if (percentage >= 80) {
          const remaining = storageQuota - storageUsed;
          const status = percentage >= 95 ? '严重预警' : '预警';

          const noticeContent = `
您好，${contactUserName || '管理员'}！

您的存储空间使用情况需要关注：
- 公司名称：${companyName}
- 已使用：${storageUsed}MB
- 总配额：${storageQuota}MB
- 使用率：${percentage.toFixed(2)}%
- 剩余空间：${remaining}MB

${percentage >= 95 ? '⚠️ 存储空间即将耗尽，请立即清理文件！' : '请及时清理不需要的文件，避免影响业务使用。'}

您可以通过以下方式释放空间：
1. 清理回收站中的文件
2. 删除不需要的文件
3. 联系管理员扩容存储空间
          `.trim();

          // 在对应租户上下文中创建系统通知
          await TenantContext.run({ tenantId }, async () => {
            await this.noticeService.create({
              noticeTitle: `存储空间${status}`,
              noticeType: '1', // 系统通知
              noticeContent,
              status: Status.NORMAL,
            });
          });

          alertCount++;
          this.logger.warn(`租户 ${tenantId}(${companyName}) 存储空间使用率 ${percentage.toFixed(2)}%，已发送预警通知`);
        }
      }

      this.logger.log(`存储配额预警任务执行完成，共发送 ${alertCount} 条预警通知`);
    } catch (error) {
      this.logger.error(`存储配额预警任务执行失败: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }

  /**
   * 清理旧文件版本任务
   * 批量扫描并清理超过maxVersions限制的旧版本文件
   */
  @Task({
    name: 'cleanOldFileVersions',
    description: '清理旧文件版本',
  })
  @IgnoreTenant()
  async cleanOldFileVersions() {
    this.logger.log('开始执行清理旧文件版本任务');

    try {
      // 检查自动清理配置是否启用
      const autoCleanConfig = await this.prisma.sysConfig.findFirst({
        where: this.tenantHelper.readWhereForDelegate('sysConfig', {
          configKey: 'sys.file.autoCleanVersions',
          delFlag: DelFlag.NORMAL,
        }) as Prisma.SysConfigWhereInput,
      });

      if (autoCleanConfig?.configValue !== 'true') {
        this.logger.log('自动清理旧版本功能未启用');
        return;
      }

      // 获取maxVersions配置
      const maxVersionsConfig = await this.prisma.sysConfig.findFirst({
        where: this.tenantHelper.readWhereForDelegate('sysConfig', {
          configKey: 'sys.file.maxVersions',
          delFlag: DelFlag.NORMAL,
        }) as Prisma.SysConfigWhereInput,
      });

      const maxVersions = parseInt(maxVersionsConfig?.configValue || '5');
      this.logger.log(`最大版本数限制: ${maxVersions}`);

      // 查询所有有版本的文件（按parentFileId分组）
      const filesWithVersions = await this.prisma.sysUpload.groupBy({
        by: ['parentFileId'],
        where: this.tenantHelper.readWhereForDelegate('sysUpload', {
          parentFileId: { not: null },
          delFlag: DelFlag.NORMAL,
        }) as Prisma.SysUploadWhereInput,
        _count: {
          uploadId: true,
        },
        having: {
          uploadId: {
            _count: {
              gt: 0,
            },
          },
        },
      });

      let totalCleaned = 0;

      for (const group of filesWithVersions) {
        const parentFileId = group.parentFileId;

        // 查询该文件的所有版本
        const versions = await this.prisma.sysUpload.findMany({
          where: this.tenantHelper.readWhereForDelegate('sysUpload', {
            OR: [{ uploadId: parentFileId }, { parentFileId: parentFileId }],
            delFlag: DelFlag.NORMAL,
          }) as Prisma.SysUploadWhereInput,
          orderBy: { version: 'desc' },
        });

        // 如果版本数超过限制，清理最旧的版本
        if (versions.length > maxVersions) {
          const versionsToDelete = versions.slice(maxVersions);

          for (const version of versionsToDelete) {
            try {
              // 删除物理文件
              await this.versionService.deletePhysicalFile(version);

              // 删除数据库记录
              await this.prisma.sysUpload.delete({
                where: { uploadId: version.uploadId },
              });

              totalCleaned++;
              this.logger.log(`已清理版本: ${version.uploadId}, 文件: ${version.fileName}, 版本号: ${version.version}`);
            } catch (error) {
              this.logger.error(`清理版本失败: ${version.uploadId}, 错误: ${getErrorMessage(error)}`);
            }
          }
        }
      }

      this.logger.log(`清理旧文件版本任务执行完成，共清理 ${totalCleaned} 个旧版本`);
    } catch (error) {
      this.logger.error(`清理旧文件版本任务执行失败: ${getErrorMessage(error)}`, getErrorStack(error));
      throw error;
    }
  }
}
