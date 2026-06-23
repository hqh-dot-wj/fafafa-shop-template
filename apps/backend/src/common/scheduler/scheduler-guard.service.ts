import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';

/**
 * 根据环境变量控制 Cron 定时任务的启停
 *
 * 开发环境下 watch 模式长时间运行会导致内存泄漏，
 * 禁用 Cron 可显著降低内存压力。
 *
 * 控制方式：环境变量 SCHEDULER_ENABLED
 * - 未设置时：development 默认 false，其他环境默认 true
 * - 设置为 'true' / 'false' 时：以显式值为准
 */
@Injectable()
export class SchedulerGuardService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerGuardService.name);

  constructor(private readonly schedulerRegistry: SchedulerRegistry) {}

  onApplicationBootstrap() {
    if (this.isSchedulerEnabled()) {
      return;
    }

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const names: string[] = [];

    cronJobs.forEach((job, name) => {
      job.stop();
      names.push(name);
    });

    if (names.length > 0) {
      this.logger.warn(
        `[Scheduler Guard] 当前环境已禁用 ${names.length} 个 Cron 定时任务。` +
          `设置 SCHEDULER_ENABLED=true 可手动启用。`,
      );
      this.logger.debug(`[Scheduler Guard] 已停止: ${names.join(', ')}`);
    }
  }

  private isSchedulerEnabled(): boolean {
    const envVal = process.env.SCHEDULER_ENABLED;
    if (envVal !== undefined) {
      return envVal === 'true' || envVal === '1';
    }
    return process.env.NODE_ENV !== 'development';
  }
}
