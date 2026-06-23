import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Result, ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { TenantSkuRepository } from '../product/tenant-sku.repository';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { ExportTable, ExportHeader } from 'src/common/utils/export';
import { getErrorInfo } from 'src/common/utils/error';
import { ListStockDto, UpdateStockDto, BatchUpdateStockDto } from './dto';

export interface StockOrderItem {
  skuId: string;
  quantity: number;
}

/**
 * 库存管理服务层
 * 处理库存的查询和更新逻辑
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly tenantSkuRepo: TenantSkuRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** JWT 中 userId 可能为 number，流水表 operatorId 为 VarChar */
  private static toOperatorIdString(operatorId?: string | number | null): string {
    if (operatorId == null || operatorId === '') {
      return '';
    }
    return String(operatorId);
  }

  private static toFiniteNumber(value: unknown, message: string): number {
    const parsed = Number(value);
    BusinessException.throwIf(!Number.isFinite(parsed), message);
    return parsed;
  }

  /**
   * 分页查询库存列表
   */
  async findAll(tenantId: string, query: ListStockDto) {
    const [records, total] = await this.tenantSkuRepo.findStockList(tenantId, {
      skip: query.skip,
      take: query.take,
      productName: query.productName,
    });
    return Result.page(records, total);
  }

  /**
   * 更新库存数量
   *
   * @description
   * 使用 TenantSkuRepository 原子操作,租户隔离,防负库存
   * 成功后写入库存变动流水表
   */
  async updateStock(tenantId: string, dto: UpdateStockDto, operatorId?: string | number | null) {
    const { skuId, stockChange, reason } = dto;
    const change = StockService.toFiniteNumber(stockChange, '库存变动值必须为有效数字');

    BusinessException.throwIf(change === 0, '库存变动值不能为零');

    const result = await this.applyTenantStockChange(tenantId, skuId, change);

    if (!result.updated) {
      if (!result.sku) {
        throw new BusinessException(ResponseCode.DATA_NOT_FOUND, 'SKU不存在或无权访问');
      }
      throw new BusinessException(
        ResponseCode.BUSINESS_ERROR,
        `库存不足,当前库存: ${result.sku.stock}, 需要: ${Math.abs(change)}`,
      );
    }

    const stockAfter = result.sku.stock;
    const stockBefore = stockAfter - change;

    await this.createStockLog(
      tenantId,
      skuId,
      StockService.toOperatorIdString(operatorId),
      change,
      stockBefore,
      stockAfter,
      reason ?? null,
    );

    return Result.ok(result.sku);
  }

  async deductForOrderItems(tenantId: string, items: StockOrderItem[], skuNameById = new Map<string, string>()) {
    // 逐项处理用于保留第一个失败 SKU 的明确错误；订单事务负责统一回滚已扣减项。
    for (const item of items) {
      const quantity = Number(item.quantity);
      BusinessException.throwIf(!Number.isFinite(quantity) || quantity <= 0, '库存扣减数量必须大于0');

      const result = await this.applyTenantStockChange(tenantId, item.skuId, -quantity);
      if (!result.updated) {
        const skuName = skuNameById.get(item.skuId) || item.skuId;
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, `商品 ${skuName} 库存不足`);
      }

      const stockAfter = result.sku.stock;
      await this.createStockLog(tenantId, item.skuId, '', -quantity, stockAfter + quantity, stockAfter, '订单下单扣减');
    }
  }

  async releaseForOrderItems(tenantId: string, items: StockOrderItem[]) {
    // 释放库存不阻断取消流程，逐项记录缺失 SKU 并继续处理剩余明细。
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      const result = await this.applyTenantStockChange(tenantId, item.skuId, quantity);
      if (!result.updated) {
        this.logger.warn(`订单库存释放跳过: tenantId=${tenantId}, skuId=${item.skuId}`);
        continue;
      }

      const stockAfter = result.sku.stock;
      await this.createStockLog(tenantId, item.skuId, '', quantity, stockAfter - quantity, stockAfter, '订单取消释放');
    }
  }

  /**
   * 批量调整库存
   * 单个失败不影响其他，返回成功/失败统计及明细
   */
  async batchUpdateStock(tenantId: string, dto: BatchUpdateStockDto, operatorId?: string | number | null) {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of dto.items) {
      const change = Number(item.stockChange);
      if (!Number.isFinite(change)) {
        results.push({ id: item.skuId, success: false, error: '库存变动值必须为有效数字' });
        failCount++;
        continue;
      }

      if (change === 0) {
        results.push({ id: item.skuId, success: false, error: '库存变动值不能为零' });
        failCount++;
        continue;
      }

      try {
        const result = await this.applyTenantStockChange(tenantId, item.skuId, change);

        if (!result.updated) {
          const msg = !result.sku
            ? 'SKU不存在或无权访问'
            : `库存不足,当前库存: ${result.sku.stock}, 需要: ${Math.abs(change)}`;
          results.push({ id: item.skuId, success: false, error: msg });
          failCount++;
          continue;
        }

        const stockAfter = result.sku.stock;
        const stockBefore = stockAfter - change;

        await this.createStockLog(
          tenantId,
          item.skuId,
          StockService.toOperatorIdString(operatorId),
          change,
          stockBefore,
          stockAfter,
          item.reason ?? null,
        );

        results.push({ id: item.skuId, success: true });
        successCount++;
      } catch (error) {
        const { message } = getErrorInfo(error);
        results.push({ id: item.skuId, success: false, error: message });
        failCount++;
      }
    }

    return Result.ok(
      { successCount, failCount, details: results },
      `批量调整完成: 成功 ${successCount} 个, 失败 ${failCount} 个`,
    );
  }

  /**
   * 导出库存数据（Excel）
   * 最多导出 5000 条
   */
  async exportStock(query: ListStockDto, res: Response) {
    const tenantId = TenantContext.getTenantId();
    const [records] = await this.tenantSkuRepo.findStockList(tenantId, {
      skip: 0,
      take: 5000,
      productName: query.productName,
    });

    const exportData = records.map((sku) => {
      const spec = sku.globalSku?.specValues;
      return {
        productName: sku.tenantProd?.product?.name ?? '',
        specValues: typeof spec === 'string' ? spec : spec ? JSON.stringify(spec) : '',
        stock: sku.stock,
        price: Number(sku.price),
        skuId: sku.id,
      };
    });

    const headers: ExportHeader[] = [
      { title: '商品名称', dataIndex: 'productName', width: 30 },
      { title: '规格', dataIndex: 'specValues', width: 20 },
      { title: '库存', dataIndex: 'stock', width: 10 },
      { title: '售价', dataIndex: 'price', width: 12 },
      { title: 'SKU ID', dataIndex: 'skuId', width: 36 },
    ];

    const filename = `库存数据_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await ExportTable({ data: exportData, header: headers, sheetName: '库存列表', filename }, res);
  }

  private async createStockLog(
    tenantId: string,
    tenantSkuId: string,
    operatorId: string,
    stockChange: number,
    stockBefore: number,
    stockAfter: number,
    reason: string | null,
  ) {
    await this.prisma.pmsStockLog.create({
      data: {
        tenantId,
        tenantSkuId,
        operatorId,
        stockChange,
        stockBefore,
        stockAfter,
        reason,
      },
    });
  }

  private async applyTenantStockChange(tenantId: string, skuId: string, change: number) {
    return this.tenantSkuRepo.updateStockForTenant(tenantId, skuId, change);
  }
}
