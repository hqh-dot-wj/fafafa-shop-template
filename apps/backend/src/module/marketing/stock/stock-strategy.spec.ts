import { MarketingStockMode } from '@prisma/client';
import { InventoryStrategyFactory, StrongLockStrategy, LazyCheckStrategy } from './stock-strategy';
import { MarketingStockService } from './stock.service';

describe('InventoryStrategyFactory', () => {
  const mockStockService = {
    reserveQuota: jest.fn(),
    releaseQuota: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
  } as unknown as MarketingStockService;

  let factory: InventoryStrategyFactory;

  beforeEach(() => {
    factory = new InventoryStrategyFactory(mockStockService);
    jest.clearAllMocks();
  });

  it('Given STRONG_LOCK 模式, When getStrategy, Then 返回 StrongLockStrategy', () => {
    const strategy = factory.getStrategy(MarketingStockMode.STRONG_LOCK);
    expect(strategy).toBeInstanceOf(StrongLockStrategy);
  });

  it('Given LAZY_CHECK 模式, When getStrategy, Then 返回 LazyCheckStrategy', () => {
    const strategy = factory.getStrategy(MarketingStockMode.LAZY_CHECK);
    expect(strategy).toBeInstanceOf(LazyCheckStrategy);
  });
});

describe('StrongLockStrategy', () => {
  const mockStockService = {
    reserveQuota: jest.fn(),
    releaseQuota: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
  } as unknown as MarketingStockService;

  let strategy: StrongLockStrategy;

  beforeEach(() => {
    strategy = new StrongLockStrategy(mockStockService);
    jest.clearAllMocks();
  });

  describe('lock', () => {
    it('Given configId 和 amount, When lock, Then 调用 reserveQuota(STRONG_LOCK)', async () => {
      (mockStockService.reserveQuota as jest.Mock).mockResolvedValue(true);

      const result = await strategy.lock('config1', 1);

      expect(result).toBe(true);
      expect(mockStockService.reserveQuota).toHaveBeenCalledWith('config1', 1, MarketingStockMode.STRONG_LOCK);
    });
  });

  describe('release', () => {
    it('Given configId 和 amount, When release, Then 调用 releaseQuota', async () => {
      await strategy.release('config1', 1);

      expect(mockStockService.releaseQuota).toHaveBeenCalledWith('config1', 1);
    });
  });
});

describe('LazyCheckStrategy', () => {
  const mockStockService = {
    reserveQuota: jest.fn(),
    releaseQuota: jest.fn(),
    decrement: jest.fn(),
    increment: jest.fn(),
  } as unknown as MarketingStockService;

  let strategy: LazyCheckStrategy;

  beforeEach(() => {
    strategy = new LazyCheckStrategy(mockStockService);
    jest.clearAllMocks();
  });

  describe('lock', () => {
    it('Given 任意参数, When lock, Then 直接返回 true（不锁定）', async () => {
      const result = await strategy.lock('config1', 1);

      expect(result).toBe(true);
      expect(mockStockService.reserveQuota).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('Given 任意参数, When release, Then 不执行任何操作', async () => {
      await strategy.release('config1', 1);

      expect(mockStockService.releaseQuota).not.toHaveBeenCalled();
    });
  });
});
