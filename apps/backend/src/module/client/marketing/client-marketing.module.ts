import { Module } from '@nestjs/common';
import { ClientCouponModule } from './coupon/client-coupon.module';
import { ClientPointsModule } from './points/client-points.module';
import { ClientAggregateModule } from './aggregate/client-aggregate.module';
import { ClientZoneModule } from './zone/client-zone.module';
import { ClientSceneModule } from './scene/client-scene.module';
import { ClientPlayInstanceModule } from './instance/client-play-instance.module';
import { ClientNavigationModule } from './navigation/client-navigation.module';

@Module({
  imports: [
    ClientCouponModule,
    ClientPointsModule,
    ClientAggregateModule,
    ClientZoneModule,
    ClientSceneModule,
    ClientPlayInstanceModule,
    ClientNavigationModule,
  ],
})
export class ClientMarketingModule {}
