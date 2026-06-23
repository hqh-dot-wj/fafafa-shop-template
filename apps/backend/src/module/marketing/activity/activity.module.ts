import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CouponDistributionModule } from '../coupon/distribution/distribution.module';
import { MarketingLifecyclePolicyService } from '../protocol/lifecycle-policy.service';
import { ActivityCenterService } from './activity-center.service';
import { ActivityClientController } from './activity-client.controller';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';
import { TouchpointRepository } from './touchpoint.repository';
import { TouchpointService } from './touchpoint.service';

/**
 * 营销活动模块
 *
 * @description
 * 统一活动层（配置型活动）：新人专享、首单优惠、满减、会员日等。
 * 与 Play 引擎（交易型玩法）并列，共同构成营销能力分层。
 */
@Module({
  imports: [
    CouponDistributionModule,
    PrismaModule,
    // 运行时延迟解析，复用统一 PlayDispatcher。
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 动态模块需延迟加载
    forwardRef(() => require('../play/play.module').MarketingPlayModule),
  ],
  controllers: [ActivityClientController],
  providers: [
    ActivityService,
    ActivityCenterService,
    ActivityRepository,
    TouchpointRepository,
    TouchpointService,
    MarketingLifecyclePolicyService,
  ],
  exports: [ActivityService, ActivityCenterService, TouchpointService],
})
export class ActivityModule {}
