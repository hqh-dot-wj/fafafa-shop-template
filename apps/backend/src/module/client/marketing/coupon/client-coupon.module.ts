import { Module } from '@nestjs/common';
import { CouponDistributionModule } from 'src/module/marketing/coupon/distribution/distribution.module';
import { CouponTemplateModule } from 'src/module/marketing/coupon/template/template.module';
import { ClientCouponController } from './client-coupon.controller';

@Module({
  imports: [CouponDistributionModule, CouponTemplateModule],
  controllers: [ClientCouponController],
})
export class ClientCouponModule {}
