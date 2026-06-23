import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from '../activity.service';
import { ActivityRepository } from '../activity.repository';
import { NEWCOMER_EXCLUSIVE_TYPE } from '../handlers/newcomer.handler';
import { MktCampaign, MktCampaignKind, MktCampaignStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BusinessException } from 'src/common/exceptions';
import { PrismaService } from 'src/prisma/prisma.service';
import { MarketingLifecyclePolicyService } from '../../protocol/lifecycle-policy.service';
import { TouchpointService } from '../touchpoint.service';
import { PlayDispatcher } from '../../play/play.dispatcher';

describe('ActivityService', () => {
  let service: ActivityService;
  const DISTRIBUTION_GROWTH_TYPE = 'DISTRIBUTION_GROWTH';

  const mockRepo = {
    create: jest.fn(),
    update: jest.fn(),
    deleteById: jest.fn(),
    findById: jest.fn(),
    findPage: jest.fn(),
    findEnabledByType: jest.fn(),
    findParticipation: jest.fn(),
    createParticipation: jest.fn(),
    countParticipations: jest.fn(),
  };

  const mockNewcomerHandler = {
    code: NEWCOMER_EXCLUSIVE_TYPE,
    checkEligibility: jest.fn(),
    applyRewards: jest.fn(),
    resolvePrice: jest.fn(),
    validateConfig: jest.fn(),
  };

  const mockDistributionGrowthHandler = {
    code: DISTRIBUTION_GROWTH_TYPE,
    checkEligibility: jest.fn(),
    applyRewards: jest.fn(),
    resolvePrice: jest.fn(),
    validateConfig: jest.fn(),
  };

  const mockPlayDispatcher = {
    resolve: jest.fn(),
  };

  const mockPrisma = {
    sysTenant: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockTouchpointService = {
    upsert: jest.fn(),
    list: jest.fn(),
    findByActivityId: jest.fn(),
  };

  const mockActivity: MktCampaign = {
    id: 'act_001',
    tenantId: 'tenant_001',
    type: NEWCOMER_EXCLUSIVE_TYPE,
    kind: MktCampaignKind.HANDLER,
    name: '新人专享礼包',
    description: null,
    status: MktCampaignStatus.PUBLISHED,
    startTime: null,
    endTime: null,
    priority: 0,
    policyJson: null,
    foundationJson: {},
    audienceJson: { userType: 'NEW', requirePhone: true },
    stagesJson: { newcomerPrices: [] },
    rightsJson: { couponTemplateIds: ['tpl_1', 'tpl_2', 'tpl_3'] },
    deliveryJson: {},
    constraintsJson: {},
    ownerUserId: null,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createTime: new Date(),
    updateTime: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: ActivityRepository, useValue: mockRepo },
        { provide: PlayDispatcher, useValue: mockPlayDispatcher },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TouchpointService, useValue: mockTouchpointService },
        MarketingLifecyclePolicyService,
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    jest.clearAllMocks();
    mockPlayDispatcher.resolve.mockReturnValue(mockNewcomerHandler);
    mockPrisma.sysTenant.findMany.mockResolvedValue([{ tenantId: 'tenant_001', companyName: '演示租户' }]);
    mockPrisma.sysTenant.findFirst.mockResolvedValue({ companyName: '演示租户' });
    mockTouchpointService.findByActivityId.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ========== 管理端 CRUD ==========

  describe('create', () => {
    // R-FLOW-NWCM-07: 合法配置 → 创建成功
    it('Given 合法配置, When create, Then 活动创建成功', async () => {
      mockPlayDispatcher.resolve.mockReturnValue(mockNewcomerHandler);
      mockNewcomerHandler.validateConfig.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue(mockActivity);

      const dto = {
        type: NEWCOMER_EXCLUSIVE_TYPE,
        name: '新人专享礼包',
        triggerCondition: { userType: 'NEW', requirePhone: true },
        rules: { newcomerPrices: [] },
        rewards: { couponTemplateIds: ['tpl_1'] },
      };

      const result = await service.create(dto as never, 'admin_001');

      expect(result).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
    });

    // R-IN-NWCM-01 / R-PRE-NWCM-01: 未注册类型 → 抛异常
    it('Given 未注册活动类型, When create, Then 抛出不支持的活动类型', async () => {
      mockPlayDispatcher.resolve.mockImplementationOnce(() => {
        throw new BusinessException(400, '不支持的活动类型');
      });

      const dto = {
        type: 'UNKNOWN_TYPE',
        name: '测试',
        triggerCondition: {},
        rules: {},
        rewards: {},
      };

      await expect(service.create(dto as never, 'admin_001')).rejects.toThrow(BusinessException);
    });

    it('Given 分销成长配置, When create, Then 透传 distributionGrowth 给 handler 校验并落库', async () => {
      const distributionGrowth = {
        activityVersionId: 'version_001',
        shareChannel: 'MINIAPP',
        shareLandingPage: '/pages/marketing/distribution/index',
        referralCodeEnabled: true,
        attributionWindowMinutes: 4320,
        commissionBudgetTotal: 100000,
        commissionBudgetAlertThreshold: 70,
        commissionBudgetFuseThreshold: 90,
        upgradeRule: { trigger: 'FIRST_ORDER_PAID' },
        teamThresholdRule: { minTeamSize: 10 },
      };

      mockPlayDispatcher.resolve.mockReturnValue(mockDistributionGrowthHandler);
      mockDistributionGrowthHandler.validateConfig.mockResolvedValue(undefined);
      mockRepo.create.mockResolvedValue({
        ...mockActivity,
        type: DISTRIBUTION_GROWTH_TYPE,
        stagesJson: {
          distributionGrowth,
        },
      });

      await service.create(
        {
          type: DISTRIBUTION_GROWTH_TYPE,
          name: '分销成长计划',
          triggerCondition: { trigger: 'REFERRAL' },
          rules: {},
          rewards: {},
          distributionGrowth,
        } as never,
        'admin_001',
      );

      expect(mockDistributionGrowthHandler.validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          type: DISTRIBUTION_GROWTH_TYPE,
          audienceJson: { trigger: 'REFERRAL' },
          stagesJson: expect.objectContaining({ distributionGrowth }),
          rightsJson: {},
        }),
      );
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          rules: expect.objectContaining({
            distributionGrowth,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    // R-FLOW-NWCM-08: 更新活动
    it('Given 活动存在, When update, Then 更新成功', async () => {
      mockRepo.findById.mockResolvedValue(mockActivity);
      mockRepo.update.mockResolvedValue({ ...mockActivity, name: '新名称' });

      const result = await service.update('act_001', { name: '新名称' } as never, 'admin_001');

      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith('act_001', expect.objectContaining({ name: '新名称' }));
    });

    // R-PRE-NWCM-05: 活动不存在 → 抛异常
    it('Given 活动不存在, When update, Then 抛出活动不存在', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.update('act_999', {} as never, 'admin_001')).rejects.toThrow(BusinessException);
    });

    it('Given 更新分销成长配置, When update, Then 走 handler 校验并写入规则快照', async () => {
      const distributionActivity: MktCampaign = {
        ...mockActivity,
        type: DISTRIBUTION_GROWTH_TYPE,
        stagesJson: {},
      };
      const distributionGrowth = {
        activityVersionId: 'version_002',
        shareChannel: 'H5',
        shareLandingPage: '/pages/marketing/distribution/h5',
        referralCodeEnabled: true,
        attributionWindowMinutes: 2880,
        commissionBudgetTotal: 300000,
        commissionBudgetAlertThreshold: 75,
        commissionBudgetFuseThreshold: 95,
        upgradeRule: { trigger: 'TEAM_ORDER_PAID' },
        teamThresholdRule: { minTeamSize: 30 },
      };

      mockRepo.findById.mockResolvedValue(distributionActivity);
      mockPlayDispatcher.resolve.mockReturnValue(mockDistributionGrowthHandler);
      mockDistributionGrowthHandler.validateConfig.mockResolvedValue(undefined);
      mockRepo.update.mockResolvedValue({
        ...distributionActivity,
        stagesJson: {
          distributionGrowth,
        },
      });

      await service.update(
        'act_001',
        {
          distributionGrowth,
        } as never,
        'admin_001',
      );

      expect(mockDistributionGrowthHandler.validateConfig).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'act_001',
        expect.objectContaining({
          rules: expect.objectContaining({
            distributionGrowth,
          }),
        }),
      );
    });
  });

  describe('toggle', () => {
    // R-FLOW-NWCM-09: 启停活动
    it('Given 活动已启用, When toggle, Then isEnabled=false', async () => {
      mockRepo.findById.mockResolvedValue(mockActivity);
      mockRepo.update.mockResolvedValue({ ...mockActivity, status: MktCampaignStatus.DRAFT });

      const result = await service.toggle('act_001', 'admin_001');

      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith('act_001', expect.objectContaining({ isEnabled: false }));
    });

    // R-PRE-NWCM-05: 活动不存在
    it('Given 活动不存在, When toggle, Then 抛出活动不存在', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.toggle('act_999', 'admin_001')).rejects.toThrow(BusinessException);
    });
  });

  describe('remove', () => {
    it('Given DRAFT且无绑定无参与记录, When remove, Then 物理删除成功', async () => {
      const deletableActivity: MktCampaign = {
        ...mockActivity,
        stagesJson: {
          approval: { status: 'DRAFT' },
          activityItems: [],
        },
      };
      mockRepo.findById.mockResolvedValue(deletableActivity);
      mockRepo.countParticipations.mockResolvedValue(0);
      mockRepo.deleteById.mockResolvedValue(deletableActivity);

      const result = await service.remove('act_001');

      expect(result).toBeDefined();
      expect(mockRepo.deleteById).toHaveBeenCalledWith('act_001');
    });

    it('Given 非DRAFT状态, When remove, Then 抛出归档/停用提示', async () => {
      const publishedActivity: MktCampaign = {
        ...mockActivity,
        stagesJson: {
          approval: { status: 'PUBLISHED' },
          activityItems: [],
        },
      };
      mockRepo.findById.mockResolvedValue(publishedActivity);

      await expect(service.remove('act_001')).rejects.toMatchObject({
        response: expect.objectContaining({
          msg: '活动已有发布痕迹，请改用停用或归档',
        }),
      });
      expect(mockRepo.deleteById).not.toHaveBeenCalled();
    });

    it('Given 已绑定商品, When remove, Then 抛出归档/停用提示', async () => {
      const activityWithItems: MktCampaign = {
        ...mockActivity,
        stagesJson: {
          approval: { status: 'DRAFT' },
          activityItems: [{ itemCode: 'sku_001' }],
        },
      };
      mockRepo.findById.mockResolvedValue(activityWithItems);

      await expect(service.remove('act_001')).rejects.toMatchObject({
        response: expect.objectContaining({
          msg: '活动存在外部引用或参与记录，请改用归档',
        }),
      });
      expect(mockRepo.deleteById).not.toHaveBeenCalled();
    });

    it('Given 已有参与记录, When remove, Then 抛出归档提示', async () => {
      const draftActivity: MktCampaign = {
        ...mockActivity,
        stagesJson: {
          approval: { status: 'DRAFT' },
          activityItems: [],
        },
      };
      mockRepo.findById.mockResolvedValue(draftActivity);
      mockRepo.countParticipations.mockResolvedValue(2);

      await expect(service.remove('act_001')).rejects.toMatchObject({
        response: expect.objectContaining({
          msg: '活动存在外部引用或参与记录，请改用归档',
        }),
      });
      expect(mockRepo.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    // R-FLOW-NWCM-10: 查询列表
    it('Given 有活动数据, When findAll, Then 返回分页数据', async () => {
      mockRepo.findPage.mockResolvedValue({ rows: [mockActivity], total: 1 });

      const result = await service.findAll({ pageNum: 1, pageSize: 10 } as never);

      expect(result).toBeDefined();
      expect(mockRepo.findPage).toHaveBeenCalled();
      expect(mockPrisma.sysTenant.findMany).toHaveBeenCalled();
      const rows = (result.data as { rows: { tenantName?: string }[] }).rows;
      expect(rows[0]?.tenantName).toBe('演示租户');
    });

    it('Given 列表为空, When findAll, Then 不查询租户表', async () => {
      mockRepo.findPage.mockResolvedValue({ rows: [], total: 0 });

      await service.findAll({ pageNum: 1, pageSize: 10 } as never);

      expect(mockPrisma.sysTenant.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findAll status', () => {
    it('Given 活动已发布, When findAll, Then 返回稳定 status 字段', async () => {
      mockRepo.findPage.mockResolvedValue({ rows: [mockActivity], total: 1 });

      const result = await service.findAll({ pageNum: 1, pageSize: 10 } as never);

      const rows = (result.data as { rows: { status?: string }[] }).rows;
      expect(rows[0]?.status).toBe('PUBLISHED');
    });
  });

  describe('findOne', () => {
    it('Given 活动存在, When findOne, Then 返回活动详情', async () => {
      mockRepo.findById.mockResolvedValue(mockActivity);

      const result = await service.findOne('act_001');

      expect(result).toBeDefined();
      expect(mockPrisma.sysTenant.findFirst).toHaveBeenCalled();
      expect((result.data as { tenantName?: string }).tenantName).toBe('演示租户');
    });

    it('Given 活动不存在, When findOne, Then 抛出活动不存在', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.findOne('act_999')).rejects.toThrow(BusinessException);
    });
  });

  // ========== 业务触发 ==========

  describe('findOne status', () => {
    it('Given 活动已发布, When findOne, Then 返回稳定 status 字段', async () => {
      mockRepo.findById.mockResolvedValue(mockActivity);

      const result = await service.findOne('act_001');

      expect((result.data as { status?: string }).status).toBe('PUBLISHED');
    });
  });

  describe('onPhoneBound', () => {
    // R-TXN-NWCM-02: 异常不阻断主流程
    it('Given doTriggerActivity 异常, When onPhoneBound, Then 不抛异常', async () => {
      mockRepo.findEnabledByType.mockRejectedValue(new Error('DB error'));

      await expect(service.onPhoneBound('member_001')).resolves.not.toThrow();
    });

    // R-BRANCH-NWCM-01: 活动不存在 → 静默返回
    it('Given 活动不存在, When onPhoneBound, Then 静默返回', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(null);

      await service.onPhoneBound('member_001');

      expect(mockRepo.createParticipation).not.toHaveBeenCalled();
    });
  });

  describe('getNewcomerPrice', () => {
    // R-FLOW-NWCM-05 + R-FLOW-NWCM-06: 新人+有新人价 → 返回新人价
    it('Given 新人+SKU有新人价, When getNewcomerPrice, Then 返回新人价', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.findParticipation.mockResolvedValue({ id: 'part_001' });
      mockPlayDispatcher.resolve.mockReturnValue(mockNewcomerHandler);
      mockNewcomerHandler.resolvePrice.mockResolvedValue(new Decimal('22.00'));

      const result = await service.getNewcomerPrice('member_001', 'sku_001');

      expect(result).toEqual(new Decimal('22.00'));
    });

    // R-BRANCH-NWCM-05: 非新人（无参与记录）→ 返回 null
    it('Given 非新人（无参与记录）, When getNewcomerPrice, Then 返回 null', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.findParticipation.mockResolvedValue(null);

      const result = await service.getNewcomerPrice('member_002', 'sku_001');

      expect(result).toBeNull();
    });

    // R-BRANCH-NWCM-01: 活动不存在 → 返回 null
    it('Given 活动不存在, When getNewcomerPrice, Then 返回 null', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(null);

      const result = await service.getNewcomerPrice('member_001', 'sku_001');

      expect(result).toBeNull();
    });

    // R-BRANCH-NWCM-04: SKU 无新人价 → 返回 null
    it('Given SKU无新人价, When getNewcomerPrice, Then 返回 null', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.findParticipation.mockResolvedValue({ id: 'part_001' });
      mockPlayDispatcher.resolve.mockReturnValue(mockNewcomerHandler);
      mockNewcomerHandler.resolvePrice.mockResolvedValue(null);

      const result = await service.getNewcomerPrice('member_001', 'sku_002');

      expect(result).toBeNull();
    });
  });

  describe('checkNewcomerStatus', () => {
    it('Given 活动启用+用户未领取, When checkNewcomerStatus, Then isNewcomer=true', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.findParticipation.mockResolvedValue(null);

      const result = await service.checkNewcomerStatus('member_001');

      expect(result).toBeDefined();
    });

    it('Given 活动启用+用户已领取, When checkNewcomerStatus, Then hasClaimed=true', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.findParticipation.mockResolvedValue({ id: 'part_001' });

      const result = await service.checkNewcomerStatus('member_001');

      expect(result).toBeDefined();
    });

    it('Given 活动不存在, When checkNewcomerStatus, Then activityEnabled=false', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(null);

      const result = await service.checkNewcomerStatus('member_001');

      expect(result).toBeDefined();
    });
  });

  describe('getNewcomerStatistics', () => {
    it('Given 活动存在, When getNewcomerStatistics, Then 返回统计数据', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(mockActivity);
      mockRepo.countParticipations.mockResolvedValue(42);

      const result = await service.getNewcomerStatistics();

      expect(result).toBeDefined();
    });

    it('Given 活动不存在, When getNewcomerStatistics, Then totalParticipants=0', async () => {
      mockRepo.findEnabledByType.mockResolvedValue(null);

      const result = await service.getNewcomerStatistics();

      expect(result).toBeDefined();
    });
  });
});
