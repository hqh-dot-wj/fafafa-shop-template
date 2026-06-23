import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartRepository } from './cart.repository';
import { ResolutionModule } from 'src/module/marketing/resolution/resolution.module';
import { DistributionModule } from 'src/module/store/distribution/distribution.module';

/**
 * C端购物车模块
 */
@Module({
  imports: [ResolutionModule, DistributionModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService, CartRepository],
})
export class ClientCartModule {}
