import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProductType, PublishStatus, StoreProductAuditStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

export const PRODUCT_SYNC_QUEUE = 'product-sync';
const REASONS = {
  OFF_SHELF: '总部商品已下架，门店商品已自动下架，请等待总部恢复后再上架',
  SKU_CHANGED_REAL: '总部SKU结构已变更，门店商品已转入整改态，请重新核对后提审',
  SKU_CHANGED_SERVICE: '总部SKU结构已变更，请在下次提审前重新核对服务配置',
  GUIDE_PRICE_REAL: '总部指导价已变更，请复核门店售价与分佣后再经营',
  GUIDE_PRICE_SERVICE: '总部指导价已变更，请按服务策略复核价格与分佣'
} as const;

type TenantSyncRule = {
  where?: Prisma.PmsTenantProductWhereInput;
  data: Prisma.PmsTenantProductUpdateManyMutationInput;
};

const TENANT_SYNC_RULES: Record<'off-shelf' | 'on-shelf' | 'sku-changed' | 'guide-price-changed', TenantSyncRule[]> = {
  'off-shelf': [
    {
      data: {
        status: PublishStatus.OFF_SHELF,
        syncBlockedReason: REASONS.OFF_SHELF
      }
    }
  ],
  'on-shelf': [
    {
      data: { syncBlockedReason: null }
    }
  ],
  'sku-changed': [
    {
      where: { product: { is: { type: ProductType.REAL } } },
      data: {
        status: PublishStatus.OFF_SHELF,
        auditStatus: StoreProductAuditStatus.DRAFT,
        syncBlockedReason: REASONS.SKU_CHANGED_REAL
      }
    },
    {
      where: { product: { is: { type: ProductType.SERVICE } } },
      data: { syncBlockedReason: REASONS.SKU_CHANGED_SERVICE }
    }
  ],
  'guide-price-changed': [
    {
      where: { product: { is: { type: ProductType.REAL } } },
      data: { syncBlockedReason: REASONS.GUIDE_PRICE_REAL }
    },
    {
      where: { product: { is: { type: ProductType.SERVICE } } },
      data: { syncBlockedReason: REASONS.GUIDE_PRICE_SERVICE }
    }
  ]
};

@Injectable()
export class ProductSyncProducer {
  constructor(@InjectQueue(PRODUCT_SYNC_QUEUE) private readonly productSyncQueue: Queue) {}

  /**
   * Notify that a global product has been taken off-shelf.
   * All tenant products should be updated to OFF_SHELF status synchronously or asynchronously.
   */
  async notifyOffShelf(productId: string) {
    await this.productSyncQueue.add('off-shelf', { productId });
  }

  async notifyOnShelf(productId: string) {
    await this.productSyncQueue.add('on-shelf', { productId });
  }

  async notifySkuChanged(productId: string) {
    await this.productSyncQueue.add('sku-changed', { productId });
  }

  async notifyGuidePriceChanged(productId: string) {
    await this.productSyncQueue.add('guide-price-changed', { productId });
  }
}

@Processor(PRODUCT_SYNC_QUEUE)
export class ProductSyncConsumer {
  private readonly logger = new Logger(ProductSyncConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  private async applyRules(productId: string, rules: TenantSyncRule[]) {
    const tasks = rules.map((rule) =>
      this.prisma.pmsTenantProduct.updateMany({
        where: {
          productId,
          ...(rule.where || {})
        },
        data: rule.data
      }),
    );

    return Promise.all(tasks);
  }

  @Process('off-shelf')
  async handleOffShelf(job: Job<{ productId: string }>) {
    const { productId } = job.data;
    this.logger.log(`Processing off-shelf sync for productId: ${productId}`);

    try {
      const [result] = await this.applyRules(productId, TENANT_SYNC_RULES['off-shelf']);

      this.logger.log(`Synced off-shelf status for ${result.count} tenant products.`);
    } catch (error) {
      this.logger.error(`Failed to sync off-shelf for productId: ${productId}`, error);
      throw error;
    }
  }

  @Process('on-shelf')
  async handleOnShelf(job: Job<{ productId: string }>) {
    const { productId } = job.data;
    this.logger.log(`Processing on-shelf sync for productId: ${productId}`);

    try {
      const [result] = await this.applyRules(productId, TENANT_SYNC_RULES['on-shelf']);
      this.logger.log(`Cleared sync block for ${result.count} tenant products.`);
    } catch (error) {
      this.logger.error(`Failed to sync on-shelf for productId: ${productId}`, error);
      throw error;
    }
  }

  @Process('sku-changed')
  async handleSkuChanged(job: Job<{ productId: string }>) {
    const { productId } = job.data;
    this.logger.log(`Processing sku-changed sync for productId: ${productId}`);

    try {
      const [realResult, serviceResult] = await this.applyRules(productId, TENANT_SYNC_RULES['sku-changed']);

      this.logger.log(
        `SKU changed synced: REAL affected ${realResult.count}, SERVICE affected ${serviceResult.count}.`
      );
    } catch (error) {
      this.logger.error(`Failed to sync sku-changed for productId: ${productId}`, error);
      throw error;
    }
  }

  @Process('guide-price-changed')
  async handleGuidePriceChanged(job: Job<{ productId: string }>) {
    const { productId } = job.data;
    this.logger.log(`Processing guide-price-changed sync for productId: ${productId}`);

    try {
      const [realResult, serviceResult] = await this.applyRules(productId, TENANT_SYNC_RULES['guide-price-changed']);

      this.logger.log(
        `Guide price changed synced: REAL affected ${realResult.count}, SERVICE affected ${serviceResult.count}.`
      );
    } catch (error) {
      this.logger.error(`Failed to sync guide-price-changed for productId: ${productId}`, error);
      throw error;
    }
  }
}
