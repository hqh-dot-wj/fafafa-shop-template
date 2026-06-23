import { DistDistributorProfileStatus, DistServicePolicyTargetType } from '@prisma/client';
import { DistributionQualificationRepository } from './qualification.repository';
import { DistributionQualificationService } from './qualification.service';

describe('DistributionQualificationService', () => {
  let service: DistributionQualificationService;

  const qualificationRepo = {
    findProfile: jest.fn(),
    sumPendingReward: jest.fn(),
    findServiceOrderForEvidence: jest.fn(),
    findProductCategoryMap: jest.fn(),
    findEligibleServicePolicies: jest.fn(),
    upsertQualificationEvidence: jest.fn(),
    upsertManyQualificationEvidence: jest.fn(),
    markEvidenceRefunded: jest.fn(),
    voidPendingRewards: jest.fn(),
    findProfileById: jest.fn(),
    updateProfileStatus: jest.fn(),
    updateRelationStatusByDistributor: jest.fn(),
    disableActiveShareTokensForDistributor: jest.fn(),
    updateMemberLevelProjection: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DistributionQualificationService(qualificationRepo as unknown as DistributionQualificationRepository);
  });

  describe('getCapability', () => {
    it('returns disabled earning capability when no active profile exists', async () => {
      qualificationRepo.findProfile.mockResolvedValue(null);
      qualificationRepo.sumPendingReward.mockResolvedValue(12.5);

      const result = await service.getCapability('tenant1', 'member1');

      expect(result).toMatchObject({
        memberId: 'member1',
        tenantId: 'tenant1',
        levelId: 0,
        profileStatus: 'NONE',
        canShare: true,
        canEarnCommission: false,
        canWithdraw: false,
        pendingRewardAmount: 12.5,
      });
    });

    it('returns active profile capability', async () => {
      qualificationRepo.findProfile.mockResolvedValue({
        status: DistDistributorProfileStatus.ACTIVE,
        levelId: 2,
        canWithdraw: true,
        canBindRelation: true,
        canEarnL2: true,
      });
      qualificationRepo.sumPendingReward.mockResolvedValue(0);

      const result = await service.getCapability('tenant1', 'member1');

      expect(result).toMatchObject({
        levelId: 2,
        profileStatus: DistDistributorProfileStatus.ACTIVE,
        canEarnCommission: true,
        canWithdraw: true,
        canBindRelation: true,
        canEarnL2: true,
      });
    });
  });

  describe('markServiceOrderVerified', () => {
    it('creates evidence for eligible service order items', async () => {
      qualificationRepo.findServiceOrderForEvidence.mockResolvedValue({
        id: 'order1',
        tenantId: 'tenant1',
        memberId: 'member1',
        shareUserId: 'share1',
        items: [{ id: 101, productId: 'prod1', skuId: 'sku1' }],
      });
      qualificationRepo.findProductCategoryMap.mockResolvedValue(new Map([['prod1', 10]]));
      qualificationRepo.findEligibleServicePolicies.mockResolvedValue([
        {
          id: 7,
          targetType: DistServicePolicyTargetType.PRODUCT,
          targetId: 'prod1',
        },
      ]);
      qualificationRepo.upsertManyQualificationEvidence.mockResolvedValue(undefined);

      const result = await service.markServiceOrderVerified('tenant1', 'order1');

      expect(result.evidenceCount).toBe(1);
      expect(qualificationRepo.upsertManyQualificationEvidence).toHaveBeenCalledWith([
        expect.objectContaining({
          tenantId: 'tenant1',
          memberId: 'member1',
          orderId: 'order1',
          orderItemId: 101,
          productId: 'prod1',
          skuId: 'sku1',
          servicePolicyId: 7,
          sourceShareUserId: 'share1',
        }),
      ]);
    });

    it('prefers sku policy over product and category policy', async () => {
      qualificationRepo.findServiceOrderForEvidence.mockResolvedValue({
        id: 'order1',
        tenantId: 'tenant1',
        memberId: 'member1',
        shareUserId: null,
        items: [{ id: 101, productId: 'prod1', skuId: 'sku1' }],
      });
      qualificationRepo.findProductCategoryMap.mockResolvedValue(new Map([['prod1', 10]]));
      qualificationRepo.findEligibleServicePolicies.mockResolvedValue([
        { id: 3, targetType: DistServicePolicyTargetType.CATEGORY, targetId: '10' },
        { id: 5, targetType: DistServicePolicyTargetType.PRODUCT, targetId: 'prod1' },
        { id: 9, targetType: DistServicePolicyTargetType.SKU, targetId: 'sku1' },
      ]);
      qualificationRepo.upsertManyQualificationEvidence.mockResolvedValue(undefined);

      await service.markServiceOrderVerified('tenant1', 'order1');

      expect(qualificationRepo.upsertManyQualificationEvidence).toHaveBeenCalledWith([
        expect.objectContaining({ servicePolicyId: 9 }),
      ]);
    });

    it('skips evidence when no eligible service policy matches', async () => {
      qualificationRepo.findServiceOrderForEvidence.mockResolvedValue({
        id: 'order1',
        tenantId: 'tenant1',
        memberId: 'member1',
        shareUserId: null,
        items: [{ id: 101, productId: 'prod1', skuId: 'sku1' }],
      });
      qualificationRepo.findProductCategoryMap.mockResolvedValue(new Map([['prod1', 10]]));
      qualificationRepo.findEligibleServicePolicies.mockResolvedValue([]);

      const result = await service.markServiceOrderVerified('tenant1', 'order1');

      expect(result.evidenceCount).toBe(0);
      expect(qualificationRepo.upsertManyQualificationEvidence).not.toHaveBeenCalled();
    });
  });

  describe('markServiceOrderRefunded', () => {
    it('refunds evidence and voids pending rewards', async () => {
      qualificationRepo.markEvidenceRefunded.mockResolvedValue({ count: 2 });
      qualificationRepo.voidPendingRewards.mockResolvedValue({ count: 1 });

      const result = await service.markServiceOrderRefunded('tenant1', 'order1', [101, 101, 102]);

      expect(result).toEqual({ evidenceCount: 2, pendingRewardCount: 1 });
      expect(qualificationRepo.markEvidenceRefunded).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant1',
          orderId: 'order1',
          orderItemIds: [101, 102],
        }),
      );
      expect(qualificationRepo.voidPendingRewards).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant1',
          orderId: 'order1',
          orderItemIds: [101, 102],
        }),
      );
    });
  });

  describe('freezeProfile/revokeProfile', () => {
    it('freezeProfile disables active share tokens for frozen distributor', async () => {
      qualificationRepo.findProfileById.mockResolvedValue({
        id: 'profile-1',
        tenantId: 'tenant1',
        memberId: 'share1',
      });
      qualificationRepo.updateProfileStatus.mockResolvedValue({
        id: 'profile-1',
        memberId: 'share1',
        status: DistDistributorProfileStatus.FROZEN,
        levelId: 1,
        qualifiedAt: new Date(),
        canWithdraw: false,
        canBindRelation: false,
        canEarnL2: false,
        frozenReason: '违规',
        revokedReason: null,
        sourceApplicationId: null,
        createTime: new Date(),
      });
      qualificationRepo.updateRelationStatusByDistributor.mockResolvedValue({ count: 1 });
      qualificationRepo.disableActiveShareTokensForDistributor.mockResolvedValue({ count: 2 });

      await service.freezeProfile('tenant1', 'profile-1', { reason: '违规' }, 'admin');

      expect(qualificationRepo.disableActiveShareTokensForDistributor).toHaveBeenCalledWith({
        tenantId: 'tenant1',
        shareUserId: 'share1',
        operator: 'admin',
        reason: '违规',
      });
    });

    it('revokeProfile disables tokens and resets member level projection', async () => {
      qualificationRepo.findProfileById.mockResolvedValue({
        id: 'profile-1',
        tenantId: 'tenant1',
        memberId: 'share1',
      });
      qualificationRepo.updateProfileStatus.mockResolvedValue({
        id: 'profile-1',
        memberId: 'share1',
        status: DistDistributorProfileStatus.REVOKED,
        levelId: 1,
        qualifiedAt: new Date(),
        canWithdraw: false,
        canBindRelation: false,
        canEarnL2: false,
        frozenReason: null,
        revokedReason: '撤销',
        sourceApplicationId: null,
        createTime: new Date(),
      });
      qualificationRepo.updateRelationStatusByDistributor.mockResolvedValue({ count: 1 });
      qualificationRepo.disableActiveShareTokensForDistributor.mockResolvedValue({ count: 1 });
      qualificationRepo.updateMemberLevelProjection.mockResolvedValue({ count: 1 });

      await service.revokeProfile('tenant1', 'profile-1', { reason: '撤销' }, 'admin');

      expect(qualificationRepo.disableActiveShareTokensForDistributor).toHaveBeenCalledWith({
        tenantId: 'tenant1',
        shareUserId: 'share1',
        operator: 'admin',
        reason: '撤销',
      });
      expect(qualificationRepo.updateMemberLevelProjection).toHaveBeenCalledWith('tenant1', 'share1', 0);
    });
  });
});
