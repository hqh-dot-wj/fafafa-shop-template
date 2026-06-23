import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { PlayInstanceModule } from '../instance/instance.module';
import { MarketingStockModule } from '../stock/stock.module';
import { UserAssetModule } from '../asset/asset.module';

/**
 * 具体玩法逻辑模块聚合
 */
import { CourseGroupBuyService } from './course-group-buy.service';
import { MemberUpgradeService } from './member-upgrade.service';
import { FlashSaleService } from './flash-sale.service';
import { PlayController } from './play.controller';

import { MemberModule } from 'src/module/admin/member/member.module';
import { AdminUpgradeModule } from 'src/module/admin/upgrade/admin-upgrade.module';

import { MarketingConfigModule } from '../config/config.module';
import { CourseGroupBuyExtensionRepository } from './course-group-buy-extension.repository';
import { PlayDispatcher } from './play.dispatcher';
import { NewcomerHandler } from '../activity/handlers/newcomer.handler';
import { DistributionGrowthHandler } from '../activity/handlers/distribution-growth.handler';
import { PolicyEvaluatorAdapter } from '../activity/handlers/policy-evaluator.adapter';
import { CampaignPolicyEvaluatorService } from '../campaign/policy-evaluator.service';
import { CouponDistributionModule } from '../coupon/distribution/distribution.module';
import { OrderContractModule } from 'src/module/client/order/contract/order-contract.module';

@Module({
  imports: [
    DiscoveryModule,
    forwardRef(() => PlayInstanceModule),
    MarketingStockModule,
    UserAssetModule,
    MemberModule,
    AdminUpgradeModule,
    OrderContractModule,
    forwardRef(() => MarketingConfigModule),
    CouponDistributionModule,
  ],
  controllers: [PlayController],
  providers: [
    CourseGroupBuyService,
    MemberUpgradeService,
    FlashSaleService,
    PlayDispatcher,
    NewcomerHandler,
    DistributionGrowthHandler,
    PolicyEvaluatorAdapter,
    CampaignPolicyEvaluatorService,
    CourseGroupBuyExtensionRepository,
  ],
  exports: [
    CourseGroupBuyService,
    MemberUpgradeService,
    FlashSaleService,
    PlayDispatcher,
    NewcomerHandler,
    DistributionGrowthHandler,
    PolicyEvaluatorAdapter,
    CourseGroupBuyExtensionRepository,
  ],
})
export class MarketingPlayModule {}
