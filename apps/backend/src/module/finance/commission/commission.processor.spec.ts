import { Test, TestingModule } from '@nestjs/testing';
import { CommissionProcessor } from './commission.processor';
import { CommissionService } from './commission.service';
import { Job } from 'bull';
import { SettlementCoreService } from '../settlement-core/settlement-core.service';

describe('CommissionProcessor', () => {
  let processor: CommissionProcessor;

  const mockCommissionService = {
    calculateCommission: jest.fn(),
  };

  const mockSettlementCoreService = {
    refreshSettlementBillFromOrder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionProcessor,
        {
          provide: CommissionService,
          useValue: mockCommissionService,
        },
        {
          provide: SettlementCoreService,
          useValue: mockSettlementCoreService,
        },
      ],
    }).compile();

    processor = module.get<CommissionProcessor>(CommissionProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleCalcCommission', () => {
    const mockJob: Partial<Job> = {
      data: {
        orderId: 'order1',
        tenantId: 'tenant1',
      },
    };

    it('应该成功处理佣金计算任务', async () => {
      mockCommissionService.calculateCommission.mockResolvedValue(undefined);
      mockSettlementCoreService.refreshSettlementBillFromOrder.mockResolvedValue(undefined);

      await processor.handleCalcCommission(mockJob as Job);

      expect(mockCommissionService.calculateCommission).toHaveBeenCalledWith('order1', 'tenant1');
      expect(mockSettlementCoreService.refreshSettlementBillFromOrder).toHaveBeenCalledWith('order1', 'tenant1');
    });

    it('应该抛出异常以触发重试 - 计算失败', async () => {
      const error = new Error('Database error');
      mockCommissionService.calculateCommission.mockRejectedValue(error);

      await expect(processor.handleCalcCommission(mockJob as Job)).rejects.toThrow('Database error');

      expect(mockCommissionService.calculateCommission).toHaveBeenCalledWith('order1', 'tenant1');
      expect(mockSettlementCoreService.refreshSettlementBillFromOrder).not.toHaveBeenCalled();
    });

    it('刷新应结算单失败时应重新抛出错误以触发 Bull 重试', async () => {
      // BUG-3 复现：refreshSettlementBill 失败被内层 catch 吞掉，
      // 导致 fin_settlement_bill 与 fin_commission 永久不一致。
      // 预期：错误上浮 → Bull 标记为失败 → 自动重试
      mockCommissionService.calculateCommission.mockResolvedValue(undefined);
      mockSettlementCoreService.refreshSettlementBillFromOrder.mockRejectedValue(new Error('refresh failed'));

      await expect(processor.handleCalcCommission(mockJob as Job)).rejects.toThrow('refresh failed');

      expect(mockCommissionService.calculateCommission).toHaveBeenCalledWith('order1', 'tenant1');
      expect(mockSettlementCoreService.refreshSettlementBillFromOrder).toHaveBeenCalledWith('order1', 'tenant1');
    });
  });
});
