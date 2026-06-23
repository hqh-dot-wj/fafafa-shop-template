import { Module } from '@nestjs/common';
import { CouponManagementController } from './management.controller';
import { CouponStatisticsService } from '../statistics/statistics.service';
import { CouponSchedulerService } from '../scheduler/scheduler.service';
import { CouponDistributionModule } from '../distribution/distribution.module';
import { CouponUsageModule } from '../usage/usage.module';
import { CouponTemplateModule } from '../template/template.module';
import { MemberRepository } from 'src/module/admin/member/member.repository';
import { MarketingEventsModule } from '../../events/events.module';
import { CouponRefundCompensationService } from './refund-compensation.service';

/**
 * 优惠券管理模块
 * 提供优惠券的统计、定时任务、管理接口
 */
@Module({
  imports: [CouponTemplateModule, CouponDistributionModule, CouponUsageModule, MarketingEventsModule],
  controllers: [CouponManagementController],
  providers: [CouponStatisticsService, CouponSchedulerService, CouponRefundCompensationService, MemberRepository],
  exports: [CouponStatisticsService],
})
export class CouponManagementModule {}
