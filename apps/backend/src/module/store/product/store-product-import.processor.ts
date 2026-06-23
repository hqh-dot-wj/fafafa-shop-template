import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { StoreProductService } from './product.service';
import {
  STORE_PRODUCT_IMPORT_JOB,
  STORE_PRODUCT_IMPORT_QUEUE,
  STORE_PRODUCT_IMPORT_WORKER_CONCURRENCY,
  StoreProductImportJobPayload,
} from './store-product-import.queue.constants';

@Injectable()
@Processor(STORE_PRODUCT_IMPORT_QUEUE)
export class StoreProductImportProcessor {
  private readonly logger = new Logger(StoreProductImportProcessor.name);

  constructor(private readonly productService: StoreProductService) {}

  @Process({ name: STORE_PRODUCT_IMPORT_JOB, concurrency: STORE_PRODUCT_IMPORT_WORKER_CONCURRENCY })
  async handleImport(job: Job<StoreProductImportJobPayload>) {
    const { tenantId } = job.data;
    this.logger.log(`处理店铺商品导入任务: jobId=${job.id}, tenantId=${tenantId}`);

    try {
      return await this.productService.processImportExcelJob(job.data);
    } catch (error) {
      this.logger.error(`店铺商品导入任务失败: jobId=${job.id}, tenantId=${tenantId}`, error);
      throw error;
    }
  }
}
