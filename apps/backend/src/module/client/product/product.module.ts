import { Module } from '@nestjs/common';
import { ClientProductController } from './product.controller';
import { ClientProductService } from './product.service';
import { PrismaModule } from 'src/prisma/prisma.module';

import { MarketingPlayModule } from 'src/module/marketing/play/play.module';
import { MarketingModule } from 'src/module/marketing/marketing.module';

import { ClientProductRepository } from './product.repository';
import { ProductQueryFallbackService } from './product-query-fallback.service';

@Module({
  imports: [PrismaModule, MarketingPlayModule, MarketingModule],
  controllers: [ClientProductController],
  providers: [ClientProductService, ClientProductRepository, ProductQueryFallbackService],
  exports: [ClientProductService, ClientProductRepository, ProductQueryFallbackService],
})
export class ClientProductModule {}
