import { Injectable, Logger } from '@nestjs/common';
import { StockAlertService } from './stock-alert.service';
import { IgnoreTenant } from 'src/common/tenant/tenant.decorator';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { Task } from 'src/module/admin/common/decorators/task.decorator';
import { CodeManagedJob } from 'src/module/admin/monitor/job/decorators/code-managed-job.decorator';

/**
 * 库存预警定时任务
 * 每日 09:00 扫描低库存 SKU 并发送站内信
 */
@Injectable()
export class StockAlertScheduler {
  private readonly logger = new Logger(StockAlertScheduler.name);

  constructor(private readonly stockAlertService: StockAlertService) {}

  /**
   * 每日 09:00 执行库存预警扫描
   */
  @IgnoreTenant()
  @CodeManagedJob({
    key: 'stock.handleStockAlert',
    name: '库存预警扫描',
    group: 'STORE',
    cron: '0 0 9 * * *',
    guardMode: 'platform-lock',
  })
  @Task({ name: 'stock.handleStockAlert', description: '库存预警扫描' })
  async handleStockAlert() {
    this.logger.log('触发库存预警定时任务');
    // Phase D2: checkLowStock 跨租户扫描 SKU 并写站内信；cron path 无 Guard 触发，
    // 进入 super-tenant context 兜底保持契约对齐。
    await TenantContext.run({ tenantId: TenantContext.SUPER_TENANT_ID, ignoreTenant: true }, async () => {
      await this.stockAlertService.checkLowStock();
    });
  }
}
