import { Test, TestingModule } from '@nestjs/testing';
import { NewcomerHandler, NEWCOMER_EXCLUSIVE_TYPE } from '../newcomer.handler';
import { PrismaService } from 'src/prisma/prisma.service';
import { CouponDistributionService } from '../../../coupon/distribution/distribution.service';
import { BusinessException } from 'src/common/exceptions';
import { MktCampaign, MktCampaignKind, MktCampaignStatus } from '@prisma/client';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { Decimal } from '@prisma/client/runtime/library';

describe('NewcomerHandler', () => {
  let handler: NewcomerHandler;

  const mockPrisma = {
    mktCampaignParticipation: {
      findFirst: jest.fn(),
    },
    umsMember: {
      findFirst: jest.fn(),
    },
    pmsTenantSku: {
      findFirst: jest.fn(),
    },
  };

  const mockCouponDistribution = {
    claimCoupon: jest.fn(),
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
        NewcomerHandler,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CouponDistributionService, useValue: mockCouponDistribution },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    handler = module.get<NewcomerHandler>(NewcomerHandler);
    jest.clearAllMocks();
  });

  it('should have type NEWCOMER_EXCLUSIVE', () => {
    expect(handler.type).toBe(NEWCOMER_EXCLUSIVE_TYPE);
  });

  // ========== checkEligibility ==========

  describe('checkEligibility', () => {
    // R-FLOW-NWCM-02: 新用户+已绑手机+未领取 → eligible = true
    it('Given 新用户+已绑手机+未领取, When checkEligibility, Then 返回 true', async () => {
      mockPrisma.mktCampaignParticipation.findFirst.mockResolvedValue(null);
      mockPrisma.umsMember.findFirst.mockResolvedValue({ mobile: '138****1234' });

      const result = await handler.checkEligibility(mockActivity, 'member_001');

      expect(result).toBe(true);
    });

    // R-PRE-NWCM-03 / R-BRANCH-NWCM-02: 已领取过 → 幂等跳过
    it('Given 用户已领取过, When checkEligibility, Then 返回 false（幂等）', async () => {
      mockPrisma.mktCampaignParticipation.findFirst.mockResolvedValue({
        id: 'part_001',
        campaignId: 'act_001',
        memberId: 'member_001',
      });

      const result = await handler.checkEligibility(mockActivity, 'member_001');

      expect(result).toBe(false);
      // 不应查询手机号（提前返回）
      expect(mockPrisma.umsMember.findFirst).not.toHaveBeenCalled();
    });

    // R-PRE-NWCM-04 / R-BRANCH-NWCM-03: 未绑手机号 → 不满足资格
    it('Given 用户未绑手机号, When checkEligibility, Then 返回 false', async () => {
      mockPrisma.mktCampaignParticipation.findFirst.mockResolvedValue(null);
      mockPrisma.umsMember.findFirst.mockResolvedValue({ mobile: null });

      const result = await handler.checkEligibility(mockActivity, 'member_001');

      expect(result).toBe(false);
    });

    // R-PRE-NWCM-04: 用户不存在 → 不满足资格
    it('Given 用户不存在, When checkEligibility, Then 返回 false', async () => {
      mockPrisma.mktCampaignParticipation.findFirst.mockResolvedValue(null);
      mockPrisma.umsMember.findFirst.mockResolvedValue(null);

      const result = await handler.checkEligibility(mockActivity, 'member_999');

      expect(result).toBe(false);
    });

    // requirePhone = false 时不检查手机号
    it('Given requirePhone=false+未绑手机, When checkEligibility, Then 返回 true', async () => {
      const activityNoPhone = {
        ...mockActivity,
        audienceJson: { userType: 'NEW', requirePhone: false },
      };
      mockPrisma.mktCampaignParticipation.findFirst.mockResolvedValue(null);

      const result = await handler.checkEligibility(activityNoPhone, 'member_001');

      expect(result).toBe(true);
      expect(mockPrisma.umsMember.findFirst).not.toHaveBeenCalled();
    });
  });

  // ========== grantRewards ==========

  describe('grantRewards', () => {
    // R-FLOW-NWCM-04: 3张券全部发放
    it('Given 3张券模板, When grantRewards, Then 3张券全部发放', async () => {
      mockCouponDistribution.claimCoupon.mockResolvedValue(undefined);

      await handler.grantRewards(mockActivity, 'member_001');

      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledTimes(3);
      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledWith('member_001', 'tpl_1');
      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledWith('member_001', 'tpl_2');
      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledWith('member_001', 'tpl_3');
    });

    // R-BRANCH-NWCM-06 / R-TXN-NWCM-01: 单张券发放失败 → 继续发放其余
    it('Given 第2张券发放失败, When grantRewards, Then 继续发放第3张', async () => {
      mockCouponDistribution.claimCoupon
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('券库存不足'))
        .mockResolvedValueOnce(undefined);

      await handler.grantRewards(mockActivity, 'member_001');

      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledTimes(3);
    });

    // R-BRANCH-NWCM-06: 全部失败也不抛异常
    it('Given 全部券发放失败, When grantRewards, Then 不抛异常', async () => {
      mockCouponDistribution.claimCoupon.mockRejectedValue(new Error('发放失败'));

      await expect(handler.grantRewards(mockActivity, 'member_001')).resolves.not.toThrow();
      expect(mockCouponDistribution.claimCoupon).toHaveBeenCalledTimes(3);
    });
  });

  // ========== getPrice ==========

  describe('getPrice', () => {
    // R-FLOW-NWCM-06: SKU 有 newcomerPrice → 返回新人价
    it('Given SKU 有 newcomerPrice, When getPrice, Then 返回新人价', async () => {
      mockPrisma.pmsTenantSku.findFirst.mockResolvedValue({
        newcomerPrice: new Decimal('22.00'),
      });

      const result = await handler.getPrice(mockActivity, 'sku_001', 'member_001');

      expect(result).toEqual(new Decimal('22.00'));
    });

    // R-BRANCH-NWCM-04: SKU 无新人价 → 返回 null
    it('Given SKU 无 newcomerPrice, When getPrice, Then 返回 null', async () => {
      mockPrisma.pmsTenantSku.findFirst.mockResolvedValue(null);

      const result = await handler.getPrice(mockActivity, 'sku_002', 'member_001');

      expect(result).toBeNull();
    });

    // SKU newcomerPrice 为 null
    it('Given SKU newcomerPrice=null, When getPrice, Then 返回 null', async () => {
      mockPrisma.pmsTenantSku.findFirst.mockResolvedValue({ newcomerPrice: null });

      const result = await handler.getPrice(mockActivity, 'sku_003', 'member_001');

      expect(result).toBeNull();
    });
  });

  // ========== validateConfig ==========

  describe('validateConfig', () => {
    // R-IN-NWCM-07: userType 不为 NEW → 抛异常
    it('Given userType 不为 NEW, When validateConfig, Then 抛出 BusinessException', async () => {
      await expect(
        handler.validateConfig({ userType: 'OLD' }, { newcomerPrices: [] }, { couponTemplateIds: ['tpl_1'] }),
      ).rejects.toThrow(BusinessException);
    });

    // R-IN-NWCM-06: couponTemplateIds 为空 → 抛异常
    it('Given couponTemplateIds 为空数组, When validateConfig, Then 抛出 BusinessException', async () => {
      await expect(
        handler.validateConfig({ userType: 'NEW' }, { newcomerPrices: [] }, { couponTemplateIds: [] }),
      ).rejects.toThrow(BusinessException);
    });

    // R-IN-NWCM-06: couponTemplateIds 未定义 → 抛异常
    it('Given couponTemplateIds 未定义, When validateConfig, Then 抛出 BusinessException', async () => {
      await expect(handler.validateConfig({ userType: 'NEW' }, { newcomerPrices: [] }, {})).rejects.toThrow(
        BusinessException,
      );
    });

    // 合法配置 → 不抛异常
    it('Given 合法配置, When validateConfig, Then 不抛异常', async () => {
      await expect(
        handler.validateConfig(
          { userType: 'NEW', requirePhone: true },
          { newcomerPrices: [] },
          { couponTemplateIds: ['tpl_1', 'tpl_2'] },
        ),
      ).resolves.not.toThrow();
    });
  });
});
