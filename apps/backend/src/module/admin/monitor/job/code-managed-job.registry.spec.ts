import { CodeManagedJobRegistry } from './decorators/code-managed-job.decorator';
import 'src/module/finance/settlement/settlement.scheduler';
import 'src/module/store/product/stock-alert.scheduler';

describe('CodeManagedJobRegistry', () => {
  it('注册财务结算任务为 self-managed', () => {
    const entry = CodeManagedJobRegistry.getInstance()
      .getAll()
      .find(item => item.metadata.key === 'finance.settleJob');

    expect(entry?.metadata).toEqual(
      expect.objectContaining({
        key: 'finance.settleJob',
        group: 'FINANCE',
        guardMode: 'self-managed',
      }),
    );
  });

  it('注册库存预警任务为 platform-lock', () => {
    const entry = CodeManagedJobRegistry.getInstance()
      .getAll()
      .find(item => item.metadata.key === 'stock.handleStockAlert');

    expect(entry?.metadata).toEqual(
      expect.objectContaining({
        key: 'stock.handleStockAlert',
        group: 'STORE',
        guardMode: 'platform-lock',
      }),
    );
  });
});
