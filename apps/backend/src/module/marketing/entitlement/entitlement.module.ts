import { Module } from '@nestjs/common';
import { CouponModule } from '../coupon/coupon.module';
import { ProductActivityViewModule } from '../product-activity-view/product-activity-view.module';
import { PointsModule } from '../points/points.module';
import { EntitlementController } from './entitlement.controller';
import { EntitlementService } from './entitlement.service';
import { CouponPoolAdapter } from './adapters/coupon-pool.adapter';
import { ProductPoolAdapter } from './adapters/product-pool.adapter';
import { PointsPoolAdapter } from './adapters/points-pool.adapter';
import { EntitlementPoolRepository } from './entitlement-pool.repository';

@Module({
  imports: [ProductActivityViewModule, CouponModule, PointsModule],
  controllers: [EntitlementController],
  providers: [EntitlementService, ProductPoolAdapter, CouponPoolAdapter, PointsPoolAdapter, EntitlementPoolRepository],
  exports: [EntitlementService],
})
export class EntitlementModule {}
