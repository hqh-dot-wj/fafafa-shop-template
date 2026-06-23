import { Test, TestingModule } from '@nestjs/testing';
import { MainService } from './main.service';
import { MenuService } from '../admin/system/menu/menu.service';
import { StoreOrderRepository } from '../store/order/store-order.repository';
import { ProductRepository } from '../pms/product/product.repository';
import { MemberRepository } from '../admin/member/member.repository';
import { UpgradeApplyRepository } from '../admin/upgrade/upgrade-apply.repository';
import { RedisService } from 'src/module/common/redis/redis.service';
import { Decimal } from '@prisma/client/runtime/library';
import { DelFlagEnum } from 'src/common/enum/index';
import { CommissionQueryPort } from '../finance/ports/commission-query.port';
import { WithdrawalQueryPort } from '../finance/ports/withdrawal-query.port';
import { WalletQueryPort } from '../finance/ports/wallet-query.port';

describe('MainService', () => {
  let service: MainService;
  let storeOrderRepo: StoreOrderRepository;
  let productRepo: ProductRepository;
  let memberRepo: MemberRepository;

  const mockMenuService = {
    getMenuListByUserId: jest.fn(),
  };

  const mockWalletQueryPort = {
    findByMemberId: jest.fn(),
  };

  const mockCommissionQueryPort = {
    aggregate: jest.fn(),
  };

  const mockStoreOrderRepo = {
    aggregate: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockProductRepo = {
    count: jest.fn(),
  };

  const mockMemberRepo = {
    count: jest.fn(),
  };

  const mockWithdrawalQueryPort = {
    count: jest.fn().mockResolvedValue(0),
  };

  const mockUpgradeApplyRepo = {
    countPending: jest.fn().mockResolvedValue(0),
  };

  const mockRedisService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MainService,
        { provide: MenuService, useValue: mockMenuService },
        { provide: WalletQueryPort, useValue: mockWalletQueryPort },
        { provide: CommissionQueryPort, useValue: mockCommissionQueryPort },
        { provide: StoreOrderRepository, useValue: mockStoreOrderRepo },
        { provide: ProductRepository, useValue: mockProductRepo },
        { provide: MemberRepository, useValue: mockMemberRepo },
        { provide: WithdrawalQueryPort, useValue: mockWithdrawalQueryPort },
        { provide: UpgradeApplyRepository, useValue: mockUpgradeApplyRepo },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<MainService>(MainService);
    storeOrderRepo = module.get<StoreOrderRepository>(StoreOrderRepository);
    productRepo = module.get<ProductRepository>(ProductRepository);
    memberRepo = module.get<MemberRepository>(MemberRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    const tenantId = 'test-tenant-123';

    it('should return dashboard statistics with valid data', async () => {
      // Mock wallet balance
      mockWalletQueryPort.findByMemberId.mockResolvedValue({
        id: 'wallet-1',
        memberId: `STORE_${tenantId}`,
        balance: new Decimal(5000.5),
        frozen: new Decimal(0),
        totalIncome: new Decimal(10000),
      });

      // Mock today's orders
      mockStoreOrderRepo.aggregate
        .mockResolvedValueOnce({
          _sum: { payAmount: new Decimal(1500.25) },
          _count: 15,
        })
        // Mock month's orders
        .mockResolvedValueOnce({
          _sum: { payAmount: new Decimal(25000.75) },
        });

      // Mock product count
      mockProductRepo.count.mockResolvedValue(150);

      // Mock member count
      mockMemberRepo.count.mockResolvedValue(320);
      mockStoreOrderRepo.count.mockResolvedValue(9);
      mockWithdrawalQueryPort.count.mockResolvedValue(4);
      mockUpgradeApplyRepo.countPending.mockResolvedValue(2);

      // Mock commission stats
      mockCommissionQueryPort.aggregate
        // Settled commission
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(3000) },
        })
        // Pending commission
        .mockResolvedValueOnce({
          _sum: { amount: new Decimal(500) },
        });

      const result = await service.getDashboardStats(tenantId);

      expect(result).toEqual({
        walletBalance: 5000.5,
        todayGMV: 1500.25,
        todayOrderCount: 15,
        monthGMV: 25000.75,
        productCount: 150,
        memberCount: 320,
        settledCommission: 3000,
        pendingCommission: 500,
        pendingOrderCount: 9,
        pendingWithdrawalCount: 4,
        pendingUpgradeCount: 2,
      });

      // Verify wallet service was called correctly
      expect(mockWalletQueryPort.findByMemberId).toHaveBeenCalledWith(`STORE_${tenantId}`);

      // Verify order aggregations
      expect(mockStoreOrderRepo.aggregate).toHaveBeenCalledTimes(2);

      // Verify product count
      expect(mockProductRepo.count).toHaveBeenCalledWith({
        delFlag: DelFlagEnum.NORMAL,
      });

      // Verify member count
      expect(mockMemberRepo.count).toHaveBeenCalledWith({ tenantId });

      // Verify commission aggregations
      expect(mockCommissionQueryPort.aggregate).toHaveBeenCalledTimes(2);
    });

    it('should return zero wallet balance when wallet not found', async () => {
      // Mock wallet not found
      mockWalletQueryPort.findByMemberId.mockResolvedValue(null);

      // Mock other data
      mockStoreOrderRepo.aggregate
        .mockResolvedValueOnce({
          _sum: { payAmount: new Decimal(0) },
          _count: 0,
        })
        .mockResolvedValueOnce({
          _sum: { payAmount: new Decimal(0) },
        });

      mockProductRepo.count.mockResolvedValue(0);
      mockMemberRepo.count.mockResolvedValue(0);
      mockStoreOrderRepo.count.mockResolvedValue(0);
      mockWithdrawalQueryPort.count.mockResolvedValue(0);
      mockUpgradeApplyRepo.countPending.mockResolvedValue(0);

      mockCommissionQueryPort.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal(0) } })
        .mockResolvedValueOnce({ _sum: { amount: new Decimal(0) } });

      const result = await service.getDashboardStats(tenantId);

      expect(result.walletBalance).toBe(0);
    });

    it('should handle null aggregation results gracefully', async () => {
      mockWalletQueryPort.findByMemberId.mockResolvedValue({
        balance: new Decimal(0),
      });

      // Mock null results
      mockStoreOrderRepo.aggregate
        .mockResolvedValueOnce({
          _sum: { payAmount: null },
          _count: 0,
        })
        .mockResolvedValueOnce({
          _sum: { payAmount: null },
        });

      mockProductRepo.count.mockResolvedValue(0);
      mockMemberRepo.count.mockResolvedValue(0);
      mockStoreOrderRepo.count.mockResolvedValue(0);
      mockWithdrawalQueryPort.count.mockResolvedValue(0);
      mockUpgradeApplyRepo.countPending.mockResolvedValue(0);

      mockCommissionQueryPort.aggregate
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getDashboardStats(tenantId);

      expect(result).toEqual({
        walletBalance: 0,
        todayGMV: 0,
        todayOrderCount: 0,
        monthGMV: 0,
        productCount: 0,
        memberCount: 0,
        settledCommission: 0,
        pendingCommission: 0,
        pendingOrderCount: 0,
        pendingWithdrawalCount: 0,
        pendingUpgradeCount: 0,
      });
    });

    it('should throw error when data fetching fails', async () => {
      mockWalletQueryPort.findByMemberId.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.getDashboardStats(tenantId)).rejects.toThrow('Database connection failed');
    });
  });

  describe('getRouters', () => {
    it('should return routers for a user', async () => {
      const userId = 1;
      const mockMenus = [
        { menuId: 1, menuName: 'Home', path: '/home' },
        { menuId: 2, menuName: 'Users', path: '/users' },
      ];

      mockMenuService.getMenuListByUserId.mockResolvedValue(mockMenus);

      const result = await service.getRouters(userId);

      expect(result).toEqual({
        code: 200,
        data: mockMenus,
        msg: '操作成功',
      });

      expect(mockMenuService.getMenuListByUserId).toHaveBeenCalledWith(userId);
    });
  });
});
