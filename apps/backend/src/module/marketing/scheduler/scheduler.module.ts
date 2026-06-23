import { Module, forwardRef } from '@nestjs/common';
import { ActivityLifecycleScheduler } from './lifecycle.scheduler';
import { PlayInstanceModule } from '../instance/instance.module';
import { MarketingStockModule } from '../stock/stock.module';
import { ResolutionModule } from '../resolution/resolution.module';
import { ResolutionAlertScheduler } from './resolution-alert.scheduler';
import { ResolutionAuditArchiveScheduler } from './resolution-audit-archive.scheduler';
import { AggregateUsageScheduler } from './aggregate-usage.scheduler';
import { CourseGroupAutoFillScheduler } from '../course-group/scheduler/course-group-auto-fill.scheduler';
import { CourseGroupReconcileScheduler } from '../course-group/scheduler/course-group-reconcile.scheduler';

/**
 * 营销调度器模块
 *
 * @description
 * 管理所有营销相关的定时任务，包括：
 * - 超时实例自动处理
 * - 活动自动上下架
 * - 过期数据清理
 * - 系统健康检查
 */
@Module({
  imports: [
    PlayInstanceModule,
    MarketingStockModule,
    ResolutionModule,
    // 运行时延迟解析，打破调度与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('../play/play.module').MarketingPlayModule),
  ],
  providers: [
    ActivityLifecycleScheduler,
    ResolutionAlertScheduler,
    ResolutionAuditArchiveScheduler,
    AggregateUsageScheduler,
    CourseGroupAutoFillScheduler,
    CourseGroupReconcileScheduler,
  ],
  exports: [
    ActivityLifecycleScheduler,
    ResolutionAlertScheduler,
    ResolutionAuditArchiveScheduler,
    AggregateUsageScheduler,
    CourseGroupAutoFillScheduler,
    CourseGroupReconcileScheduler,
  ],
})
export class MarketingSchedulerModule {}
