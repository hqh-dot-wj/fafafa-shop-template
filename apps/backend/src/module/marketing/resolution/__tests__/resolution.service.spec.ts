import { Test } from '@nestjs/testing';
import { ResolutionService } from '../resolution.service';
import { CandidateLoaderService } from '../services/candidate-loader.service';
import { EligibilityFilterService } from '../services/eligibility-filter.service';
import { AggregateSelectorService } from '../services/aggregate-selector.service';
import { ActivityContextTokenService } from '../services/activity-context-token.service';
import { ResolutionRepository } from '../resolution.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { SceneReleaseRepository } from '../scene-release.repository';
import { SceneCandidateLoaderService } from '../services/scene-candidate-loader.service';
import { AudienceFilterService } from '../services/audience-filter.service';
import { PrimaryOfferResolverService } from '../services/primary-offer-resolver.service';
import { ModuleRankerService } from '../services/module-ranker.service';
import { ProductCardViewBuilder } from '../services/product-card-view.builder';
import { ResolutionObservabilityService } from '../resolution-observability.service';
import { ResolutionExplainService } from '../services/resolution-explain.service';

describe('ResolutionService', () => {
  let service: ResolutionService;
  let candidateLoader: { loadCandidates: jest.Mock; loadCandidatesForProducts: jest.Mock };
  let eligibilityFilter: { filterCandidates: jest.Mock };
  let aggregateSelector: { selectMainActivity: jest.Mock; selectMainActivitiesForProducts: jest.Mock };
  let tokenService: { issue: jest.Mock; verify: jest.Mock };
  let repository: { createAudit: jest.Mock };
  let sceneReleaseRepo: { findPublishedRelease: jest.Mock };
  let sceneCandidateLoader: { load: jest.Mock };
  let audienceFilter: { filter: jest.Mock };
  let primaryOfferResolver: { resolveProducts: jest.Mock };
  let moduleRanker: { rank: jest.Mock };
  let cardViewBuilder: { buildModuleView: jest.Mock };
  let observability: { recordSceneResolve: jest.Mock };
  let prisma: {
    umsMember: { findUnique: jest.Mock };
    mktCampaign: { findFirst: jest.Mock };
    mktCampaignParticipation: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    candidateLoader = {
      loadCandidates: jest.fn(),
      loadCandidatesForProducts: jest.fn().mockResolvedValue(new Map()),
    };
    eligibilityFilter = { filterCandidates: jest.fn() };
    aggregateSelector = {
      selectMainActivity: jest.fn(),
      selectMainActivitiesForProducts: jest.fn().mockResolvedValue(new Map()),
    };
    repository = { createAudit: jest.fn() };
    sceneReleaseRepo = { findPublishedRelease: jest.fn() };
    sceneCandidateLoader = { load: jest.fn().mockResolvedValue([]) };
    audienceFilter = { filter: jest.fn().mockResolvedValue({ visible: [], filtered: [] }) };
    primaryOfferResolver = { resolveProducts: jest.fn().mockResolvedValue([]) };
    moduleRanker = { rank: jest.fn().mockResolvedValue([]) };
    cardViewBuilder = {
      buildModuleView: jest.fn().mockReturnValue({ moduleCode: '', moduleName: '', moduleType: '', products: [] }),
    };
    observability = { recordSceneResolve: jest.fn().mockResolvedValue(undefined) };
    tokenService = {
      issue: jest.fn((input) => `token:${input.activityType}:${input.activityConfigId}`),
      verify: jest.fn((token: string) => {
        const [, activityType, activityConfigId] = token.split(':');
        return {
          tenantId: 't1',
          memberId: 'm1',
          activityType,
          activityConfigId,
          entrySceneCode: 'HOME',
          entryModuleCode: 'M1',
          cardTemplateCode: 'CARD',
          resolverPolicyCode: 'RES',
          resolverReleaseNo: 3,
          activityVersionId: 'activity-v1',
          attributionWindowMinutes: 4320,
          shareChannel: 'POSTER',
          signedWith: '1',
          issuedAt: 1,
          expiresAt: 2,
        };
      }),
    };
    prisma = {
      umsMember: { findUnique: jest.fn().mockResolvedValue(null) },
      mktCampaign: { findFirst: jest.fn().mockResolvedValue(null) },
      mktCampaignParticipation: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const module = await Test.createTestingModule({
      providers: [
        ResolutionService,
        { provide: PrismaService, useValue: prisma },
        { provide: CandidateLoaderService, useValue: candidateLoader },
        { provide: EligibilityFilterService, useValue: eligibilityFilter },
        { provide: AggregateSelectorService, useValue: aggregateSelector },
        { provide: ActivityContextTokenService, useValue: tokenService },
        { provide: ResolutionRepository, useValue: repository },
        { provide: SceneReleaseRepository, useValue: sceneReleaseRepo },
        { provide: SceneCandidateLoaderService, useValue: sceneCandidateLoader },
        { provide: AudienceFilterService, useValue: audienceFilter },
        { provide: PrimaryOfferResolverService, useValue: primaryOfferResolver },
        { provide: ModuleRankerService, useValue: moduleRanker },
        { provide: ProductCardViewBuilder, useValue: cardViewBuilder },
        { provide: ResolutionObservabilityService, useValue: observability },
        { provide: ResolutionExplainService, useValue: { record: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = module.get(ResolutionService);
  });

  describe('resolveMainActivity', () => {
    it('should return null when no eligible candidates', async () => {
      candidateLoader.loadCandidates.mockResolvedValue([]);
      eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [], filtered: [] });
      aggregateSelector.selectMainActivity.mockResolvedValue(null);
      const result = await service.resolveMainActivity({ tenantId: 't1', productId: 'p1', memberId: 'm1' });
      expect(result).toBeNull();
    });

    it('should return resolved context for valid activity', async () => {
      const mockConfig: Record<string, unknown> = {
        id: 'c1',
        templateCode: 'FLASH_SALE',
        rules: { name: '午间秒杀', flashPrice: 39, originalPrice: 120 },
        commissionMode: 'NONE',
        commissionRate: null,
        displayPriority: 0,
        status: 'ON_SHELF',
      };
      candidateLoader.loadCandidates.mockResolvedValue([mockConfig]);
      eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [mockConfig], filtered: [] });
      aggregateSelector.selectMainActivity.mockResolvedValue(mockConfig);
      const result = await service.resolveMainActivity({ tenantId: 't1', productId: 'p1', memberId: 'm1' });
      expect(result).not.toBeNull();
      expect(result!.activityContextKey).toBe('token:FLASH_SALE:c1');
      expect(result!.activityType).toBe('FLASH_SALE');
      expect(result!.activityName).toBe('午间秒杀');
      expect(result!.activityPrice.toNumber()).toBe(39);
      expect(result!.originalPrice.toNumber()).toBe(120);
    });

    it('should use registered Chinese play name when rules have no name', async () => {
      const mockConfig: Record<string, unknown> = {
        id: 'c3',
        templateCode: 'FLASH_SALE',
        rules: { flashPrice: 1, originalPrice: 99 },
        commissionMode: 'NONE',
        commissionRate: null,
        displayPriority: 0,
        status: 'ON_SHELF',
      };
      candidateLoader.loadCandidates.mockResolvedValue([mockConfig]);
      eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [mockConfig], filtered: [] });
      aggregateSelector.selectMainActivity.mockResolvedValue(mockConfig);

      const result = await service.resolveMainActivity({ tenantId: 't1', productId: 'p1', memberId: 'm1' });

      expect(result).not.toBeNull();
      expect(result!.activityName).toBe('限时秒杀');
    });

    it('should map course-group-buy price from rules.price', async () => {
      const mockConfig: Record<string, unknown> = {
        id: 'c2',
        templateCode: 'COURSE_GROUP_BUY',
        rules: { name: '春季拼班', price: 199, originalPrice: 299 },
        commissionMode: 'INHERIT',
        commissionRate: null,
        displayPriority: 0,
        status: 'ON_SHELF',
      };
      candidateLoader.loadCandidates.mockResolvedValue([mockConfig]);
      eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [mockConfig], filtered: [] });
      aggregateSelector.selectMainActivity.mockResolvedValue(mockConfig);

      const result = await service.resolveMainActivity({ tenantId: 't1', productId: 'p1', memberId: 'm1' });

      expect(result).not.toBeNull();
      expect(result!.activityContextKey).toBe('token:COURSE_GROUP_BUY:c2');
      expect(result!.activityPrice.toNumber()).toBe(199);
      expect(result!.originalPrice.toNumber()).toBe(299);
    });
  });

  describe('resolveMainActivitiesBatch', () => {
    it('should batch resolve multiple products with single priority load', async () => {
      const mockConfig: Record<string, unknown> = {
        id: 'c1',
        templateCode: 'FLASH_SALE',
        rules: { name: '午间秒杀', flashPrice: 39, originalPrice: 120 },
        commissionMode: 'NONE',
        commissionRate: null,
        displayPriority: 0,
        status: 'ON_SHELF',
      };
      const map = new Map<string, Record<string, unknown>[]>([
        ['p1', [mockConfig]],
        ['p2', [mockConfig]],
      ]);
      candidateLoader.loadCandidatesForProducts.mockResolvedValue(map);
      eligibilityFilter.filterCandidates.mockImplementation((candidates: Record<string, unknown>[]) => ({
        eligible: candidates,
        filtered: [],
      }));
      const selected = new Map<string, Record<string, unknown> | null>([
        ['p1', mockConfig],
        ['p2', null],
      ]);
      aggregateSelector.selectMainActivitiesForProducts.mockResolvedValue(selected);

      const result = await service.resolveMainActivitiesBatch({
        tenantId: 't1',
        memberId: 'm1',
        productIds: ['p1', 'p2'],
      });

      expect(candidateLoader.loadCandidatesForProducts).toHaveBeenCalledWith('t1', ['p1', 'p2']);
      expect(aggregateSelector.selectMainActivitiesForProducts).toHaveBeenCalledTimes(1);
      expect(result.get('p1')).not.toBeNull();
      expect(result.get('p2')).toBeNull();
    });
  });

  describe('validateAndLock', () => {
    it('should persist traceId into audit snapshot', async () => {
      const mockConfig: Record<string, unknown> = {
        id: 'c1',
        templateCode: 'GROUP_BUY',
        rules: { activityName: '鎷煎洟', discountPrice: 9, originalPrice: 19 },
        commissionMode: 'NONE',
        commissionRate: null,
        displayPriority: 0,
        status: 'ON_SHELF',
      };
      candidateLoader.loadCandidates.mockResolvedValue([mockConfig]);
      eligibilityFilter.filterCandidates.mockReturnValue({ eligible: [mockConfig], filtered: [] });

      await service.validateAndLock({
        tenantId: 't1',
        memberId: 'm1',
        productId: 'p1',
        skuId: 's1',
        activityContextKey: 'token:GROUP_BUY:c1',
        traceId: 'trace-audit-1',
      });

      expect(repository.createAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateSnapshot: expect.arrayContaining([expect.objectContaining({ id: 'c1', traceId: 'trace-audit-1' })]),
        }),
      );
    });

    it('should throw when activity config not found', async () => {
      candidateLoader.loadCandidates.mockResolvedValue([]);
      await expect(
        service.validateAndLock({
          tenantId: 't1',
          memberId: 'm1',
          productId: 'p1',
          skuId: 's1',
          activityContextKey: 'token:GROUP_BUY:c1',
        }),
      ).rejects.toThrow();
    });
  });

  describe('resolveSceneView', () => {
    it('should pass traceId into observability metrics', async () => {
      sceneReleaseRepo.findPublishedRelease.mockResolvedValue({
        sceneCode: 'HOME_FEATURED',
        releaseNo: 2,
        modules: [],
      });

      const result = await service.resolveSceneView({
        sceneCode: 'HOME_FEATURED',
        userContext: {
          tenantId: 't1',
          memberId: 'm1',
          channel: 'MINIAPP',
          now: new Date('2026-04-15T00:00:00.000Z'),
          isNewcomer: false,
          traceId: 'trace-scene-1',
        },
      });

      expect(result).toMatchObject({
        sceneCode: 'HOME_FEATURED',
        releaseNo: 2,
        traceId: 'trace-scene-1',
        source: 'scene',
      });
      expect(observability.recordSceneResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          sceneCode: 'HOME_FEATURED',
          traceId: 'trace-scene-1',
          status: 'SUCCESS',
        }),
      );
    });

    it('should persist module candidate, filter and selected snapshots into trace explain', async () => {
      sceneReleaseRepo.findPublishedRelease.mockResolvedValue({
        sceneCode: 'HOME_FEATURED',
        releaseNo: 3,
        modules: [
          {
            moduleCode: 'M1',
            moduleName: '首屏主推',
            moduleType: 'PRODUCT',
            limitSize: 4,
            sourcePolicyCode: 'SRC_HOME',
            resolverPolicyCode: 'RES_HOME',
            audiencePolicyCode: 'AUD_NEW',
            sortPolicyCode: 'SORT_PRIORITY',
            cardTemplateCode: 'DEFAULT',
          },
        ],
      });
      const visibleCandidate = {
        productId: 'p1',
        productName: '体验课',
        activityCandidates: [
          {
            configId: 'cfg-1',
            templateCode: 'COURSE_GROUP_BUY',
            displayPriority: 9,
            status: 'ON_SHELF',
            rules: {},
          },
        ],
      };
      const filteredCandidate = {
        productId: 'p2',
        productName: '老客课',
        activityCandidates: [],
        reason: 'not_newcomer',
      };
      const resolvedProduct = {
        ...visibleCandidate,
        primaryOffer: {
          activityContextKey: 'COURSE_GROUP_BUY:cfg-1',
          activityType: 'COURSE_GROUP_BUY',
          configId: 'cfg-1',
          activityName: '体验课拼课',
          displayPrice: 99,
          originalPrice: 199,
          statusSummary: 'ON_SHELF',
        },
        secondaryOffers: [],
      };
      sceneCandidateLoader.load.mockResolvedValue([visibleCandidate, filteredCandidate]);
      audienceFilter.filter.mockResolvedValue({
        visible: [visibleCandidate],
        filtered: [filteredCandidate],
      });
      primaryOfferResolver.resolveProducts.mockResolvedValue([resolvedProduct]);
      moduleRanker.rank.mockResolvedValue([resolvedProduct]);
      cardViewBuilder.buildModuleView.mockReturnValue({
        moduleCode: 'M1',
        moduleName: '首屏主推',
        moduleType: 'PRODUCT',
        products: [{ productId: 'p1' }],
      });

      await service.resolveSceneView({
        sceneCode: 'HOME_FEATURED',
        productLimit: 4,
        userContext: {
          tenantId: 't1',
          memberId: 'm1',
          channel: 'MINIAPP',
          now: new Date('2026-04-15T00:00:00.000Z'),
          isNewcomer: false,
          traceId: 'trace-explain-1',
        },
      });

      expect(observability.recordSceneResolve).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace-explain-1',
          explainSnapshot: expect.objectContaining({
            sceneCode: 'HOME_FEATURED',
            releaseNo: 3,
            modules: expect.arrayContaining([
              expect.objectContaining({
                moduleCode: 'M1',
                candidateSnapshot: expect.arrayContaining([expect.objectContaining({ productId: 'p1' })]),
                filterReasonSnapshot: expect.arrayContaining([
                  expect.objectContaining({ productId: 'p2', reason: 'not_newcomer' }),
                ]),
                selectedSnapshot: expect.arrayContaining([
                  expect.objectContaining({
                    productId: 'p1',
                    primaryOffer: expect.objectContaining({ activityContextKey: 'COURSE_GROUP_BUY:cfg-1' }),
                  }),
                ]),
              }),
            ]),
          }),
        }),
      );
    });
  });
});
