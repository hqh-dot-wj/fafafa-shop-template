import { Test, TestingModule } from '@nestjs/testing';
import { CommissionCalculatorService } from './commission-calculator.service';
import { L1CalculatorService } from './l1-calculator.service';
import { L2CalculatorService } from './l2-calculator.service';
import { BaseCalculatorService } from './base-calculator.service';
import { DistConfigService } from './dist-config.service';
import { CommissionValidatorService } from './commission-validator.service';
import { CommissionRepository } from '../commission.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { LevelService } from 'src/module/store/distribution/services/level.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { Decimal } from '@prisma/client/runtime/library';
import { OrderQueryPort } from '../../ports/order-query.port';
import { MemberQueryPort } from '../../ports/member-query.port';
import { DistributionQualificationQueryPort } from '../../ports/distribution-qualification-query.port';

describe('CommissionCalculatorService - Level Integration', () => {
  let service: CommissionCalculatorService;
  let l1Calculator: L1CalculatorService;
  let l2Calculator: L2CalculatorService;
  let levelService: LevelService;

  const mockPrismaService = {
    omsOrder: {
      findUnique: jest.fn(),
    },
    umsMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCommissionRepo = {
    upsert: jest.fn(),
  };

  const mockDistConfigService = {
    getDistConfig: jest.fn(),
  };

  const mockValidator = {
    checkSelfPurchase: jest.fn(),
    isUserBlacklisted: jest.fn(),
    checkDailyLimit: jest.fn(),
  };

  const mockBaseCalculator = {
    calculateCommissionBase: jest.fn(),
  };

  const mockLevelService = {
    findByLevelId: jest.fn(),
  };

  // A-T1: OrderQueryPort mock
  const mockOrderQueryPort = {
    findOrderForCommission: jest.fn(),
    findOrdersForCommission: jest.fn(),
  };

  // A-T2: MemberQueryPort mock
  const mockMemberQueryPort = {
    findMemberForCommission: jest.fn(),
    findMemberBrief: jest.fn(),
    findMembersBrief: jest.fn(),
    checkCircularReferral: jest.fn(),
  };

  const mockDistributionQualificationQueryPort = {
    findProfile: jest.fn().mockResolvedValue(null),
    findActiveProfile: jest.fn().mockResolvedValue(null),
    findActiveRelation: jest.fn().mockResolvedValue(null),
  };
  const mockDistributorEligibilityService = {
    isActive: jest.fn().mockResolvedValue(true),
    filterActive: jest.fn((_tenantId: string, memberIds: string[]) => Promise.resolve(new Set(memberIds))),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionCalculatorService,
        L1CalculatorService,
        L2CalculatorService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CommissionRepository,
          useValue: mockCommissionRepo,
        },
        {
          provide: DistConfigService,
          useValue: mockDistConfigService,
        },
        {
          provide: CommissionValidatorService,
          useValue: mockValidator,
        },
        {
          provide: BaseCalculatorService,
          useValue: mockBaseCalculator,
        },
        {
          provide: LevelService,
          useValue: mockLevelService,
        },
        {
          provide: OrderQueryPort,
          useValue: mockOrderQueryPort,
        },
        {
          provide: MemberQueryPort,
          useValue: mockMemberQueryPort,
        },
        {
          provide: DistributionQualificationQueryPort,
          useValue: mockDistributionQualificationQueryPort,
        },
        {
          provide: DistributorEligibilityService,
          useValue: mockDistributorEligibilityService,
        },
      ],
    }).compile();

    service = module.get<CommissionCalculatorService>(CommissionCalculatorService);
    l1Calculator = module.get<L1CalculatorService>(L1CalculatorService);
    l2Calculator = module.get<L2CalculatorService>(L2CalculatorService);
    levelService = module.get<LevelService>(LevelService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(l1Calculator).toBeDefined();
    expect(l2Calculator).toBeDefined();
  });

  describe('简化口径：SKU佣金池 × 分销等级比例', () => {
    it('应该使用等级直推比例计算L1佣金，不再查询商品例外配置', async () => {
      const order = {
        id: 'ORDER001',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: 'M002',
        payAmount: new Decimal(100),
        totalAmount: new Decimal(100),
        orderType: 'PRODUCT',
        items: [
          {
            skuId: 'SKU001',
            quantity: 1,
            price: new Decimal(100),
            tenantSku: {
              globalSku: {
                productId: 'P001',
                product: { categoryId: 'C001' },
              },
            },
          },
        ],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: null,
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M002',
        tenantId: 'T001',
        levelId: 2, // C2会员
        parentId: 'M003', // 有上级，不是C2全拿场景
      };

      const distConfig = {
        level1Rate: 0.1, // 租户默认10%
        level2Rate: 0.05,
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // 会员等级配置：15%（LevelVo 为百分比字符串）
      const memberLevelConfig = {
        levelId: 2,
        levelName: '高级分销员',
        level1Rate: '15.00',
        level2Rate: '8.00',
        isActive: true,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.checkSelfPurchase.mockReturnValue(false);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(memberLevelConfig);
      // M002（受益人）无正式档案；M003（上级）是活跃 C2，故 hasL2=true，不触发 C2 全拿
      mockDistributionQualificationQueryPort.findProfile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: 'ACTIVE', levelId: 2, tenantId: 'T001' });

      const result = await l1Calculator.calculateL1(order, member, distConfig, new Decimal(100), new Date());

      expect(result).not.toBeNull();
      expect(result.record.amount.toNumber()).toBe(15); // 100 * 0.15 = 15
      expect(mockLevelService.findByLevelId).toHaveBeenCalledWith('T001', 2);
    });

    it('没有等级比例时不应回退商品例外或租户默认比例', async () => {
      const order = {
        id: 'ORDER002',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: 'M002',
        payAmount: new Decimal(100),
        totalAmount: new Decimal(100),
        orderType: 'PRODUCT',
        items: [],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: null,
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M002',
        tenantId: 'T001',
        levelId: 1, // C1会员
        parentId: null,
      };

      const distConfig = {
        level1Rate: 0.1,
        level2Rate: 0.05,
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.checkSelfPurchase.mockReturnValue(false);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(null);

      const result = await l1Calculator.calculateL1(order, member, distConfig, new Decimal(100), new Date());

      expect(result).toBeNull();
    });

    it('应该使用等级团队比例计算L2佣金，不再查询商品例外配置', async () => {
      const order = {
        id: 'ORDER003',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: null,
        payAmount: new Decimal(100),
        totalAmount: new Decimal(100),
        orderType: 'PRODUCT',
        items: [],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: 'M003',
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M003',
        tenantId: 'T001',
        levelId: 2, // C2会员
        parentId: null,
      };

      const distConfig = {
        level1Rate: 0.1,
        level2Rate: 0.05, // 租户默认5%
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // 会员等级配置：L2 为 8%（LevelVo 百分比字符串）
      const memberLevelConfig = {
        levelId: 2,
        levelName: '高级分销员',
        level1Rate: '15.00',
        level2Rate: '8.00',
        isActive: true,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(memberLevelConfig);

      const result = await l2Calculator.calculateL2(
        order,
        member,
        distConfig,
        new Decimal(100),
        new Date(),
        'M002',
        1,
        false,
      );

      expect(result).not.toBeNull();
      expect(result.amount.toNumber()).toBe(8); // 100 * 0.08 = 8
      expect(mockLevelService.findByLevelId).toHaveBeenCalledWith('T001', 2);
    });

    it('应该在C2全拿场景下使用会员等级配置计算L1+L2', async () => {
      const order = {
        id: 'ORDER004',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: 'M002',
        payAmount: new Decimal(100),
        totalAmount: new Decimal(100),
        orderType: 'PRODUCT',
        items: [],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: null,
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M002',
        tenantId: 'T001',
        levelId: 2, // C2会员
        parentId: null, // 无上级，C2全拿
      };

      const distConfig = {
        level1Rate: 0.1,
        level2Rate: 0.05,
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // 会员等级配置（LevelVo 百分比字符串）
      const memberLevelConfig = {
        levelId: 2,
        levelName: '高级分销员',
        level1Rate: '15.00',
        level2Rate: '8.00',
        isActive: true,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.checkSelfPurchase.mockReturnValue(false);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(memberLevelConfig);

      const result = await l1Calculator.calculateL1(order, member, distConfig, new Decimal(100), new Date());

      // C2全拿：L1 + L2 = 15% + 8% = 23%
      expect(result).not.toBeNull();
      expect(result.record.amount.toNumber()).toBe(23); // 100 * (0.15 + 0.08) = 23
      expect(result.noL2Available).toBe(true);
    });
  });

  describe('多商品汇总后的佣金池', () => {
    it('应该对汇总后的SKU佣金池统一使用会员等级配置', async () => {
      const order = {
        id: 'ORDER005',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: 'M002',
        payAmount: new Decimal(300), // 3个商品总价
        totalAmount: new Decimal(300),
        orderType: 'PRODUCT',
        items: [],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: null,
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M002',
        tenantId: 'T001',
        levelId: 2,
        parentId: 'M003', // 有上级，不是C2全拿场景
      };

      const distConfig = {
        level1Rate: 0.1,
        level2Rate: 0.05,
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // 会员等级配置：统一 15%（LevelVo 百分比字符串）
      const memberLevelConfig = {
        levelId: 2,
        level1Rate: '15.00',
        level2Rate: '8.00',
        isActive: true,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.checkSelfPurchase.mockReturnValue(false);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(memberLevelConfig);
      // M002（受益人）无正式档案；M003（上级）是活跃 C2，故 hasL2=true，不触发 C2 全拿
      mockDistributionQualificationQueryPort.findProfile
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ status: 'ACTIVE', levelId: 2, tenantId: 'T001' });

      const result = await l1Calculator.calculateL1(order, member, distConfig, new Decimal(300), new Date());

      expect(result).not.toBeNull();
      expect(result.record.amount.toNumber()).toBe(45);
    });
  });

  describe('降级场景：无商品信息时使用会员等级配置', () => {
    it('L2计算在无商品信息时应该使用会员等级配置', async () => {
      const order = {
        id: 'ORDER006',
        tenantId: 'T001',
        memberId: 'M001',
        shareUserId: null,
        payAmount: new Decimal(100),
        totalAmount: new Decimal(100),
        orderType: 'PRODUCT',
        items: [],
      };

      const member = {
        memberId: 'M001',
        tenantId: 'T001',
        parentId: 'M002',
        indirectParentId: 'M003',
        levelId: 0,
      };

      const beneficiary = {
        memberId: 'M003',
        tenantId: 'T001',
        levelId: 2,
        parentId: null,
      };

      const distConfig = {
        level1Rate: 0.1,
        level2Rate: 0.05, // 租户默认5%
        enableCrossTenant: false,
        crossTenantRate: 1,
        commissionBaseType: 'ORIGINAL_PRICE',
        maxCommissionRate: 0.5,
      };

      // 会员等级配置：L2 8%（LevelVo 百分比字符串）
      const memberLevelConfig = {
        levelId: 2,
        level1Rate: '15.00',
        level2Rate: '8.00',
        isActive: true,
      };

      // A-T2: 使用 MemberQueryPort mock
      mockMemberQueryPort.findMemberBrief.mockResolvedValue(beneficiary);
      mockValidator.isUserBlacklisted.mockResolvedValue(false);
      mockLevelService.findByLevelId.mockResolvedValue(memberLevelConfig);

      // 无商品信息
      const result = await l2Calculator.calculateL2(
        order,
        member,
        distConfig,
        new Decimal(100),
        new Date(),
        'M002',
        1,
        false,
      );

      // 应该使用会员等级配置的8%，而不是租户默认的5%
      expect(result).not.toBeNull();
      expect(result.amount.toNumber()).toBe(8); // 100 * 0.08 = 8
    });
  });
});
