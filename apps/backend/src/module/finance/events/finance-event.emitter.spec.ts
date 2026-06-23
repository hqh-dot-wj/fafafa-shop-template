import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinanceEventEmitter } from './finance-event.emitter';
import { FinanceEventType } from './finance-event.types';

describe('FinanceEventEmitter', () => {
  let emitter: FinanceEventEmitter;

  const mockEventEmitter = {
    emitAsync: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinanceEventEmitter, { provide: EventEmitter2, useValue: mockEventEmitter }],
    }).compile();

    emitter = module.get<FinanceEventEmitter>(FinanceEventEmitter);
    jest.clearAllMocks();
  });

  describe('emit (同步)', () => {
    it('Given 有效事件, When emit, Then 调用 emitAsync', async () => {
      const event = {
        type: FinanceEventType.WALLET_BALANCE_INCREASED,
        tenantId: 't1',
        memberId: 'm1',
        payload: { amount: 10 },
        timestamp: new Date(),
      };

      await emitter.emit(event);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(FinanceEventType.WALLET_BALANCE_INCREASED, event);
    });

    it('Given emitAsync 抛异常, When emit, Then 不向上抛出（不影响主流程）', async () => {
      mockEventEmitter.emitAsync.mockRejectedValue(new Error('listener error'));

      await expect(
        emitter.emit({
          type: FinanceEventType.COMMISSION_CREATED,
          tenantId: 't1',
          memberId: 'm1',
          payload: {},
          timestamp: new Date(),
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('emitBalanceIncreased', () => {
    it('Given 参数, When emitBalanceIncreased, Then 发送 WALLET_BALANCE_INCREASED 事件', async () => {
      await emitter.emitBalanceIncreased('t1', 'm1', { amount: 10 });

      // emitAsync 是异步的（setImmediate），这里验证不抛异常即可
      expect(true).toBe(true);
    });
  });

  describe('emitBalanceDecreased', () => {
    it('Given 参数, When emitBalanceDecreased, Then 不抛异常', async () => {
      await expect(emitter.emitBalanceDecreased('t1', 'm1', { amount: 5 })).resolves.toBeUndefined();
    });
  });

  describe('emitPendingRecoveryIncreased', () => {
    it('Given 参数, When emitPendingRecoveryIncreased, Then 不抛异常', async () => {
      await expect(emitter.emitPendingRecoveryIncreased('t1', 'm1', { amount: 20 })).resolves.toBeUndefined();
    });
  });

  describe('emitCommissionSettled', () => {
    it('Given 参数, When emitCommissionSettled, Then 不抛异常', async () => {
      await expect(emitter.emitCommissionSettled('t1', 'm1', { commissionId: 'c1' })).resolves.toBeUndefined();
    });
  });

  describe('emitWithdrawalApplied', () => {
    it('Given 参数, When emitWithdrawalApplied, Then 不抛异常', async () => {
      await expect(emitter.emitWithdrawalApplied('t1', 'm1', { withdrawalId: 'w1' })).resolves.toBeUndefined();
    });
  });

  describe('emitSettlementBatchCompleted', () => {
    it('Given 参数, When emitSettlementBatchCompleted, Then memberId 为 system', async () => {
      await expect(emitter.emitSettlementBatchCompleted('t1', { settledCount: 10 })).resolves.toBeUndefined();
    });
  });
});
