import { Injectable } from '@nestjs/common';
import { OmsOrderItem } from '@prisma/client';
import { StockService } from 'src/module/store/stock/stock.service';
import { OrderItemDto } from '../dto/order.dto';
import { CheckoutPreviewItemVo } from '../vo/order.vo';

@Injectable()
export class OrderInventoryPort {
  constructor(private readonly stockService: StockService) {}

  async deductForOrderItems(tenantId: string, items: OrderItemDto[], previewItems: CheckoutPreviewItemVo[]) {
    const skuNameById = new Map(previewItems.map((previewItem) => [previewItem.skuId, previewItem.productName]));
    await this.stockService.deductForOrderItems(tenantId, items, skuNameById);
  }

  async releaseForOrderItems(tenantId: string, items: Pick<OmsOrderItem, 'skuId' | 'quantity'>[]) {
    await this.stockService.releaseForOrderItems(tenantId, items);
  }
}
