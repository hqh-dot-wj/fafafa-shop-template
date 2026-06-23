import { Controller, Post, Body, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Api } from 'src/common/decorators/api.decorator';
import { User } from 'src/common/decorators/user.decorator';
import { RequirePermission } from 'src/module/admin/common/decorators/require-permission.decorator';
import { Operlog } from 'src/module/admin/common/decorators/operlog.decorator';
import { BusinessType } from 'src/common/constant/business.constant';
import { StockService } from './stock.service';
import { CurrentTenant } from 'src/common/tenant/tenant.decorator';
import { ListStockDto, UpdateStockDto, BatchUpdateStockDto } from './dto';
import { StockVo } from './vo';
import { BatchOperationResult } from '../common/dto/batch-operation-result.dto';

@ApiTags('库存管理')
@ApiBearerAuth('Authorization')
@Controller('store/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Api({ summary: '获取库存列表', type: StockVo, isPager: true })
  @RequirePermission('store:stock:list')
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('list')
  async getList(@CurrentTenant() tenantId: string, @Body() dto: ListStockDto) {
    return this.stockService.findAll(tenantId, dto);
  }

  @Api({ summary: '更新库存' })
  @RequirePermission('store:stock:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('update')
  async update(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateStockDto,
    @User('userId') userId?: string | number,
  ) {
    return this.stockService.updateStock(tenantId, dto, userId);
  }

  @Api({ summary: '批量调整库存', type: BatchOperationResult })
  @RequirePermission('store:stock:update')
  @Operlog({ businessType: BusinessType.UPDATE })
  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Post('batch/update')
  async batchUpdate(
    @CurrentTenant() tenantId: string,
    @Body() dto: BatchUpdateStockDto,
    @User('userId') userId?: string | number,
  ) {
    return this.stockService.batchUpdateStock(tenantId, dto, userId);
  }

  /**
   * @sloCategory admin
   * @sloLatency P99 < 2000ms
   * @sloAvailability 99%
   */
  @Get('export')
  @Api({ summary: '导出库存数据' })
  @RequirePermission('store:stock:list')
  @Operlog({ businessType: BusinessType.EXPORT })
  async exportStock(@Query() query: ListStockDto, @Res() res: Response) {
    return this.stockService.exportStock(query, res);
  }
}
