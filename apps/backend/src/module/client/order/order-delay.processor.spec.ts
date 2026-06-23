import { Test, TestingModule } from '@nestjs/testing';
import { OrderDelayProcessor } from './order-delay.processor';
import { OrderAutoCancelConfigService } from './config/order-auto-cancel.config';
import { OrderService } from './order.service';

describe('OrderDelayProcessor', () => {
  let processor: OrderDelayProcessor;

  const mockOrderService = {
    cancelOrderBySystem: jest.fn(),
  };
  const mockAutoCancelConfig = {
    getOptions: jest.fn(() => ({ reason: '超时未支付自动关闭' })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderDelayProcessor,
        { provide: OrderService, useValue: mockOrderService },
        { provide: OrderAutoCancelConfigService, useValue: mockAutoCancelConfig },
      ],
    }).compile();

    processor = module.get<OrderDelayProcessor>(OrderDelayProcessor);
    jest.clearAllMocks();
  });

  it('Given cancel_unpaid 任务, When handleCancelUnpaid, Then 调用系统自动取消', async () => {
    mockOrderService.cancelOrderBySystem.mockResolvedValue(undefined);

    await processor.handleCancelUnpaid({ data: { orderId: 'order-1', reason: '自定义超时原因' } } as any);

    expect(mockOrderService.cancelOrderBySystem).toHaveBeenCalledWith('order-1', '自定义超时原因');
  });

  it('Given cancel_unpaid 任务缺少原因, When handleCancelUnpaid, Then 使用当前默认原因兜底', async () => {
    mockOrderService.cancelOrderBySystem.mockResolvedValue(undefined);

    await processor.handleCancelUnpaid({ data: { orderId: 'order-1' } } as any);

    expect(mockOrderService.cancelOrderBySystem).toHaveBeenCalledWith('order-1', '超时未支付自动关闭');
  });

  it('Given 取消过程抛错, When handleCancelUnpaid, Then 异常继续抛出用于重试', async () => {
    mockOrderService.cancelOrderBySystem.mockRejectedValue(new Error('db timeout'));

    await expect(processor.handleCancelUnpaid({ data: { orderId: 'order-2' } } as any)).rejects.toThrow('db timeout');
  });
});
