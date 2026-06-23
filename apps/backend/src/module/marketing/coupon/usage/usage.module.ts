import { Module } from '@nestjs/common';
import { CouponUsageService } from './usage.service';
import { CouponUsageRepository } from './usage.repository';
import { CouponDistributionModule } from '../distribution/distribution.module';
import { CouponTemplateModule } from '../template/template.module';
import { MarketingEventsModule } from '../../events/events.module';
import { OrderContractModule } from 'src/module/client/order/contract/order-contract.module';

/**
 * 优惠券使用模块
 * 提供优惠券的验证、计算、锁定、使用、解锁、退还功能
 *
 * 引入 CouponTemplateModule 用于读取退款延期策略 (refundExpireExtendDays)
 */
@Module({
  imports: [CouponDistributionModule, CouponTemplateModule, OrderContractModule, MarketingEventsModule],
  providers: [CouponUsageService, CouponUsageRepository],
  exports: [CouponUsageService, CouponUsageRepository],
})
export class CouponUsageModule {}
