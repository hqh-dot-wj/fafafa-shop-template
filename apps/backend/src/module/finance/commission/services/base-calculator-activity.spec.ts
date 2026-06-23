import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { BaseCalculatorService } from './base-calculator.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';

describe('BaseCalculatorService - 活动佣金路径', () => {
  let service: BaseCalculatorService;

  const mockPrisma = {
    pmsTenantSku: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaseCalculatorService,
        { provide: PrismaService, useValue: mockPrisma },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<BaseCalculatorService>(BaseCalculatorService);
    jest.clearAllMocks();
  });

  it('Given NONE 模式, When calculateCommissionBase, Then 该项不参与分佣', async () => {
    const order = {
      totalAmount: new Decimal(200),
      payAmount: new Decimal(200),
      items: [
        {
          skuId: 'sku-1',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: 'NONE',
          activityCommissionRateSnapshot: null,
          orderItemFinalPaid: new Decimal(100),
        },
        {
          skuId: 'sku-2',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: null,
          activityCommissionRateSnapshot: null,
          orderItemFinalPaid: null,
        },
      ],
    };

    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
      {
        id: 'sku-2',
        distMode: 'RATIO',
        distRate: new Decimal(0.1),
        isExchangeProduct: false,
        globalSku: {},
      },
    ]);

    const result = await service.calculateCommissionBase(order);

    // sku-1 (NONE) 被跳过；sku-2 走 SKU 逻辑: 100 × 0.1 = 10
    expect(result.base.toFixed(2)).toBe('10.00');
    expect(result.activityPool.toFixed(2)).toBe('0.00');
  });

  it('Given FIXED_RATE 模式, When calculateCommissionBase, Then 按 orderItemFinalPaid × rate 计算佣金池', async () => {
    const order = {
      totalAmount: new Decimal(100),
      payAmount: new Decimal(80),
      items: [
        {
          skuId: 'sku-act',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: 'FIXED_RATE',
          activityCommissionRateSnapshot: new Decimal(0.15),
          orderItemFinalPaid: new Decimal(80),
        },
      ],
    };

    // FIXED_RATE 不查 SKU
    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([]);

    const result = await service.calculateCommissionBase(order);

    // 佣金池 = 80 × 0.15 = 12
    expect(result.base.toFixed(2)).toBe('12.00');
    expect(result.activityPool.toFixed(2)).toBe('12.00');
  });

  it('Given INHERIT 模式, When calculateCommissionBase, Then 走现有 SKU 分销逻辑', async () => {
    const order = {
      totalAmount: new Decimal(100),
      payAmount: new Decimal(100),
      items: [
        {
          skuId: 'sku-inherit',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: 'INHERIT',
          activityCommissionRateSnapshot: null,
          orderItemFinalPaid: new Decimal(100),
        },
      ],
    };

    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
      {
        id: 'sku-inherit',
        distMode: 'RATIO',
        distRate: new Decimal(0.08),
        isExchangeProduct: false,
        globalSku: {},
      },
    ]);

    const result = await service.calculateCommissionBase(order);

    // INHERIT 走 SKU 逻辑: 100 × 0.08 = 8
    expect(result.base.toFixed(2)).toBe('8.00');
    expect(result.activityPool.toFixed(2)).toBe('0.00');
  });

  it('Given 混合订单（FIXED_RATE + 普通）, When calculateCommissionBase, Then 两部分佣金叠加', async () => {
    const order = {
      totalAmount: new Decimal(300),
      payAmount: new Decimal(280),
      items: [
        {
          skuId: 'sku-act',
          totalAmount: new Decimal(200),
          quantity: 1,
          activityCommissionModeSnapshot: 'FIXED_RATE',
          activityCommissionRateSnapshot: new Decimal(0.1),
          orderItemFinalPaid: new Decimal(180),
        },
        {
          skuId: 'sku-normal',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: null,
          activityCommissionRateSnapshot: null,
          orderItemFinalPaid: null,
        },
      ],
    };

    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([
      {
        id: 'sku-normal',
        distMode: 'RATIO',
        distRate: new Decimal(0.05),
        isExchangeProduct: false,
        globalSku: {},
      },
    ]);

    const result = await service.calculateCommissionBase(order);

    // 活动池 = 180 × 0.10 = 18
    // SKU 基数 = 100 × 0.05 = 5
    // 总基数 = 18 + 5 = 23
    expect(result.activityPool.toFixed(2)).toBe('18.00');
    expect(result.base.toFixed(2)).toBe('23.00');
  });

  it('Given 全部 NONE, When calculateCommissionBase, Then 返回 0', async () => {
    const order = {
      totalAmount: new Decimal(100),
      payAmount: new Decimal(100),
      items: [
        {
          skuId: 'sku-none',
          totalAmount: new Decimal(100),
          quantity: 1,
          activityCommissionModeSnapshot: 'NONE',
          activityCommissionRateSnapshot: null,
          orderItemFinalPaid: new Decimal(100),
        },
      ],
    };

    mockPrisma.pmsTenantSku.findMany.mockResolvedValue([]);

    const result = await service.calculateCommissionBase(order);

    expect(result.base.toFixed(2)).toBe('0.00');
    expect(result.activityPool.toFixed(2)).toBe('0.00');
  });
});
