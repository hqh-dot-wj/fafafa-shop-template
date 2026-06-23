import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { StoreProductController } from './product.controller';
import { StoreProductService } from './product.service';
import { StockAlertService } from './stock-alert.service';
import { StockAlertScheduler } from './stock-alert.scheduler';
import { ProfitValidator } from './profit-validator';
import { TenantProductRepository } from './tenant-product.repository';
import { TenantSkuRepository } from './tenant-sku.repository';
import { ProductSyncProducer, ProductSyncConsumer, PRODUCT_SYNC_QUEUE } from './product-sync.queue';
import { StoreProductImportProcessor } from './store-product-import.processor';
import { STORE_PRODUCT_IMPORT_QUEUE } from './store-product-import.queue.constants';
import { NotificationModule } from 'src/module/notification/notification.module';
import { StoreProductQueryFallbackService } from './store-product-query-fallback.service';

@Module({
  imports: [BullModule.registerQueue({ name: PRODUCT_SYNC_QUEUE }, { name: STORE_PRODUCT_IMPORT_QUEUE }), NotificationModule],
  controllers: [StoreProductController],
  providers: [
    StoreProductService,
    StockAlertService,
    StockAlertScheduler,
    ProfitValidator,
    TenantProductRepository,
    TenantSkuRepository,
    ProductSyncProducer,
    ProductSyncConsumer,
    StoreProductImportProcessor,
    StoreProductQueryFallbackService,
  ],
  exports: [StoreProductService, TenantProductRepository, TenantSkuRepository, ProductSyncProducer, StoreProductQueryFallbackService],
})
export class StoreProductModule {}
