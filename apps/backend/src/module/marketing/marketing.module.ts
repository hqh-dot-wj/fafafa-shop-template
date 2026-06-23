import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MarketingTemplateModule } from './template/template.module';
import { MarketingConfigModule } from './config/config.module';
import { PlayInstanceModule } from './instance/instance.module';
import { MarketingStockModule } from './stock/stock.module';
import { UserAssetModule } from './asset/asset.module';
import { MarketingSchedulerModule } from './scheduler/scheduler.module';
import { MarketingEventsModule } from './events/events.module';
import { RuleModule } from './rule/rule.module';
import { CouponModule } from './coupon/coupon.module';
import { PointsModule } from './points/points.module';
import { OrderIntegrationModule } from './integration/integration.module';
import { ApprovalModule } from './approval/approval.module';
import { ActivityModule } from './activity/activity.module';
import { MarketingCacheInterceptor } from './common/cache.interceptor';
import { ResolutionModule } from './resolution/resolution.module';
import { MarketingSceneModule } from './scene/scene.module';
import { MarketingPolicyModule } from './policy/policy.module';
import { ReportModule } from './report/report.module';
import { MarketingRuntimeLedgerModule } from './marketing-runtime-ledger.module';
import { MarketingCacheIndexService } from './common/cache-index.service';
import { CourseGroupModule } from './course-group/course-group.module';
import { ActivityItemModule } from './activity-item/activity-item.module';
import { NavigationModule } from './navigation/navigation.module';
import { ProductActivityViewModule } from './product-activity-view/product-activity-view.module';
import { MarketingProtocolModule } from './protocol/protocol.module';
import { CampaignShellModule } from './campaign-shell/campaign-shell.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { MarketingSchemaModule } from './schema/schema.module';
import { MarketingBusinessDashboardController } from './marketing-business-dashboard.controller';
import { MarketingBusinessDashboardService } from './marketing-business-dashboard.service';

/**
 * 营销大模块聚合器 (MaaS Core)
 */
@Module({
  controllers: [MarketingBusinessDashboardController],
  imports: [
    MarketingTemplateModule,
    MarketingConfigModule,
    PlayInstanceModule,
    MarketingStockModule,
    UserAssetModule,
    MarketingSchedulerModule,
    MarketingEventsModule,
    RuleModule,
    CouponModule,
    PointsModule,
    OrderIntegrationModule,
    ApprovalModule,
    ActivityModule,
    ResolutionModule,
    MarketingSceneModule,
    MarketingPolicyModule,
    ReportModule,
    MarketingProtocolModule,
    CampaignShellModule,
    EntitlementModule,
    MarketingSchemaModule,
    MarketingRuntimeLedgerModule,
    CourseGroupModule,
    ActivityItemModule,
    NavigationModule,
    ProductActivityViewModule,
    // 运行时延迟解析，打破聚合根与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('./play/play.module').MarketingPlayModule),
  ],
  exports: [
    MarketingTemplateModule,
    MarketingConfigModule,
    PlayInstanceModule,
    MarketingStockModule,
    UserAssetModule,
    MarketingSchedulerModule,
    MarketingEventsModule,
    RuleModule,
    CouponModule,
    PointsModule,
    OrderIntegrationModule,
    ApprovalModule,
    ActivityModule,
    ResolutionModule,
    MarketingSceneModule,
    MarketingPolicyModule,
    ReportModule,
    MarketingProtocolModule,
    CampaignShellModule,
    EntitlementModule,
    MarketingSchemaModule,
    CourseGroupModule,
    ActivityItemModule,
    NavigationModule,
    ProductActivityViewModule,
    // 运行时延迟解析，打破聚合根与玩法模块的静态循环依赖
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('./play/play.module').MarketingPlayModule),
  ],
  providers: [
    MarketingBusinessDashboardService,
    MarketingCacheIndexService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MarketingCacheInterceptor,
    },
  ],
})
export class MarketingModule {}
