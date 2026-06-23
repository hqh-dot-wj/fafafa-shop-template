import { ProductType, PublishStatus, StoreProductAuditStatus } from '@prisma/client';
import { ProductSyncConsumer, ProductSyncProducer } from './product-sync.queue';

describe('ProductSyncProducer', () => {
  const add = jest.fn();
  const queue = { add } as any;
  const producer = new ProductSyncProducer(queue);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该发送 off-shelf 事件', async () => {
    await producer.notifyOffShelf('p1');
    expect(add).toHaveBeenCalledWith('off-shelf', { productId: 'p1' });
  });

  it('应该发送 on-shelf 事件', async () => {
    await producer.notifyOnShelf('p1');
    expect(add).toHaveBeenCalledWith('on-shelf', { productId: 'p1' });
  });

  it('应该发送 sku-changed 事件', async () => {
    await producer.notifySkuChanged('p1');
    expect(add).toHaveBeenCalledWith('sku-changed', { productId: 'p1' });
  });

  it('应该发送 guide-price-changed 事件', async () => {
    await producer.notifyGuidePriceChanged('p1');
    expect(add).toHaveBeenCalledWith('guide-price-changed', { productId: 'p1' });
  });
});

describe('ProductSyncConsumer', () => {
  const updateMany = jest.fn();
  const prisma = {
    pmsTenantProduct: {
      updateMany
    }
  } as any;
  const consumer = new ProductSyncConsumer(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 2 });
  });

  it('off-shelf 应下架并写入阻断原因', async () => {
    await consumer.handleOffShelf({ data: { productId: 'p1' } } as any);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'p1' },
        data: expect.objectContaining({
          status: PublishStatus.OFF_SHELF,
          syncBlockedReason: expect.stringContaining('总部商品已下架')
        })
      }),
    );
  });

  it('on-shelf 应清理阻断原因', async () => {
    await consumer.handleOnShelf({ data: { productId: 'p1' } } as any);

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'p1' },
        data: { syncBlockedReason: null }
      }),
    );
  });

  it('sku-changed 应按 REAL/SERVICE 分流更新', async () => {
    await consumer.handleSkuChanged({ data: { productId: 'p1' } } as any);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { productId: 'p1', product: { is: { type: ProductType.REAL } } },
        data: expect.objectContaining({
          status: PublishStatus.OFF_SHELF,
          auditStatus: StoreProductAuditStatus.DRAFT,
          syncBlockedReason: expect.stringContaining('SKU结构已变更')
        })
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { productId: 'p1', product: { is: { type: ProductType.SERVICE } } },
        data: expect.objectContaining({
          syncBlockedReason: expect.stringContaining('SKU结构已变更')
        })
      }),
    );
  });

  it('guide-price-changed 应按 REAL/SERVICE 分流写入提示', async () => {
    await consumer.handleGuidePriceChanged({ data: { productId: 'p1' } } as any);

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { productId: 'p1', product: { is: { type: ProductType.REAL } } },
        data: expect.objectContaining({
          syncBlockedReason: expect.stringContaining('指导价已变更')
        })
      }),
    );
    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { productId: 'p1', product: { is: { type: ProductType.SERVICE } } },
        data: expect.objectContaining({
          syncBlockedReason: expect.stringContaining('指导价已变更')
        })
      }),
    );
  });
});
