import { Test, TestingModule } from '@nestjs/testing';
import { UpgradeService } from './upgrade.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WechatService } from '../common/service/wechat.service';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { Prisma } from '@prisma/client';

describe('UpgradeService', () => {
  let service: UpgradeService;
  const mockMemberFindFirst = jest.fn();
  const mockMemberUpdate = jest.fn().mockResolvedValue({});
  const mockMemberCount = jest.fn().mockResolvedValue(0);
  const mockMemberFindMany = jest.fn().mockResolvedValue([]);
  const mockReferralCodeFindFirst = jest.fn();
  const mockReferralCodeUpdate = jest.fn().mockResolvedValue({});
  const mockReferralCodeCreate = jest.fn();
  const mockUpgradeApplyCreate = jest.fn();
  const mockUpgradeApplyFindFirst = jest.fn();
  const mockSysDistLevelFindFirst = jest.fn();
  const mockOmsOrderAggregate = jest.fn().mockResolvedValue({ _sum: { payAmount: null } });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpgradeService,
        getTenantHelperTestProvider(),
        {
          provide: PrismaService,
          useValue: {
            umsMember: {
              findFirst: mockMemberFindFirst,
              update: mockMemberUpdate,
              count: mockMemberCount,
              findMany: mockMemberFindMany,
            },
            umsReferralCode: {
              findFirst: mockReferralCodeFindFirst,
              update: mockReferralCodeUpdate,
              create: mockReferralCodeCreate,
            },
            umsUpgradeApply: {
              create: mockUpgradeApplyCreate,
              findFirst: mockUpgradeApplyFindFirst,
            },
            omsOrder: {
              aggregate: mockOmsOrderAggregate,
            },
            sysDistLevel: {
              findFirst: mockSysDistLevelFindFirst,
            },
          },
        },
        {
          provide: WechatService,
          useValue: {
            getWxaCodeUnlimited: jest.fn(),
          },
        },
        {
          provide: UploadService,
          useValue: {
            singleFileUpload: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UpgradeService);
  });

  describe('applyUpgrade', () => {
    it('Given 推荐码与活动上下文, When applyUpgrade, Then 返回标准结果并落库快照', async () => {
      mockMemberFindFirst
        .mockResolvedValueOnce({
          memberId: 'mem-1',
          levelId: 0,
          tenantId: 'T001',
          parentId: null,
        })
        .mockResolvedValueOnce({
          memberId: 'mem-2',
          levelId: 2,
          tenantId: 'T001',
          parentId: null,
        });
      mockReferralCodeFindFirst.mockResolvedValue({
        id: 'code-1',
        code: 'T001-ABCD',
        memberId: 'mem-2',
        tenantId: 'T001',
        isActive: true,
      });
      mockUpgradeApplyCreate.mockResolvedValue({ id: 'apply-1' });

      const result = await service.applyUpgrade('mem-1', {
        targetLevel: 1,
        referralCode: 'T001-ABCD',
        activityVersionId: 'MKT_V20260419',
        attributionWindowMinutes: 2880,
        shareChannel: 'miniapp',
        sourceSceneCode: 'HOME',
        sourceModuleCode: 'UPGRADE_CARD',
        sourcePagePath: '/pages/upgrade/index',
        shareUserId: 'share-1',
        activityContextKey: 'MKT:upgrade:001',
      });

      expect(result.code).toBe(200);
      expect(result.data).toMatchObject({
        applyId: 'apply-1',
        applied: true,
        status: 'APPROVED',
        matchedActivityVersion: 'MKT_V20260419',
      });
      expect(result.data?.triggerSnapshot).toMatchObject({
        memberId: 'mem-1',
        tenantId: 'T001',
        applyType: 'REFERRAL_CODE',
        referralCode: 'T001-ABCD',
        referrerId: 'mem-2',
        activityVersionId: 'MKT_V20260419',
        attributionWindowMinutes: 2880,
        shareChannel: 'miniapp',
      });
      expect(mockUpgradeApplyCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reviewRemark: expect.stringContaining('"activityVersionId":"MKT_V20260419"'),
        }),
      });
    });
  });

  describe('upgradeByOrder', () => {
    it('Given 会员已满足目标等级, When upgradeByOrder, Then 返回 SKIPPED 标准结果', async () => {
      mockMemberFindFirst.mockResolvedValue({
        memberId: 'mem-1',
        levelId: 1,
        tenantId: 'T001',
        parentId: null,
      });

      const result = await service.upgradeByOrder('mem-1', 'order-1', 1, 'T001', {
        activityVersionId: 'MKT_V20260419',
        attributionWindowMinutes: 1440,
        shareChannel: 'h5',
      });

      expect(result.code).toBe(200);
      expect(result.data).toMatchObject({
        applied: false,
        applyId: null,
        status: 'SKIPPED',
        orderId: 'order-1',
        matchedActivityVersion: 'MKT_V20260419',
      });
      expect(result.data?.triggerSnapshot).toMatchObject({
        memberId: 'mem-1',
        tenantId: 'T001',
        applyType: 'PRODUCT_PURCHASE',
        orderId: 'order-1',
        activityVersionId: 'MKT_V20260419',
        shareChannel: 'h5',
      });
      expect(mockUpgradeApplyCreate).not.toHaveBeenCalled();
      expect(mockMemberUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getTeamStats', () => {
    it('Given 团队数据与下一等级费率, When getTeamStats, Then 返回标准团队结果与佣金预估', async () => {
      mockMemberFindFirst.mockResolvedValue({
        memberId: 'mem-1',
        levelId: 1,
        tenantId: 'T001',
      });
      mockMemberCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      mockMemberFindMany.mockResolvedValueOnce([{ memberId: 'm-2' }, { memberId: 'm-3' }]).mockResolvedValueOnce([
        { memberId: 'm-4' },
      ]);
      mockOmsOrderAggregate.mockResolvedValue({ _sum: { payAmount: new Prisma.Decimal(1000) } });
      mockSysDistLevelFindFirst.mockResolvedValue({
        levelId: 2,
        level1Rate: new Prisma.Decimal(0.12),
      });
      mockUpgradeApplyFindFirst.mockResolvedValue({
        reviewRemark: JSON.stringify({ activityVersionId: 'MKT_V20260419' }),
      });

      const result = await service.getTeamStats('mem-1');

      expect(result).toMatchObject({
        currentLevel: 1,
        nextLevel: 2,
        directCount: 2,
        indirectCount: 1,
        teamSize: 3,
        totalTeamSales: 1000,
        estimatedCommission: 120,
        matchedActivityVersion: 'MKT_V20260419',
      });
    });
  });
});
