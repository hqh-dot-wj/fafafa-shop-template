import { ActivityContextTokenService } from '../services/activity-context-token.service';
import { PrimaryOfferResolverService } from '../services/primary-offer-resolver.service';
import type { UserMarketingContext } from '../dto/user-marketing-context.dto';

describe('PrimaryOfferResolverService', () => {
  const prisma = {
    mktPolicy: {
      findUnique: jest.fn(),
    },
    mktActivityPriorityRule: {
      findMany: jest.fn(),
    },
  };
  const offerEligibility = {
    check: jest.fn(),
  };
  const secondaryBenefitMerger = {
    merge: jest.fn(),
  };
  const courseGroupSceneExplain = {
    attach: jest.fn(),
  };
  const tokenService = {
    issue: jest.fn((input) => `token:${input.activityType}:${input.activityConfigId}`),
  };

  const ctx: UserMarketingContext = {
    tenantId: '000000',
    memberId: 'member-1',
    channel: 'MINIAPP',
    now: new Date('2026-04-28T00:00:00.000Z'),
    isNewcomer: false,
  };

  let service: PrimaryOfferResolverService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.mktPolicy.findUnique.mockResolvedValue(null);
    prisma.mktActivityPriorityRule.findMany.mockResolvedValue([]);
    offerEligibility.check.mockReturnValue(true);
    courseGroupSceneExplain.attach.mockImplementation(async (products) =>
      products.map((product: Record<string, unknown>) => ({
        ...product,
        courseGroupJoinExplain: { reasonCode: 'JOINABLE' },
      })),
    );
    secondaryBenefitMerger.merge.mockImplementation((products) => products);
    service = new PrimaryOfferResolverService(
      prisma as any,
      tokenService as unknown as ActivityContextTokenService,
      offerEligibility as any,
      secondaryBenefitMerger as any,
      courseGroupSceneExplain as any,
    );
  });

  it('attaches course-group scene explain before secondary benefit merge', async () => {
    const result = await service.resolveProducts(
      [
        {
          productId: 'prod-1',
          activityCandidates: [
            {
              configId: 'cfg-1',
              templateCode: 'COURSE_GROUP_BUY',
              displayPriority: 10,
              status: 'ON_SHELF',
              rules: { name: '拼课活动', price: 99 },
            },
          ],
        },
      ],
      '',
      ctx,
    );

    expect(courseGroupSceneExplain.attach).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          productId: 'prod-1',
          primaryOffer: expect.objectContaining({
            activityType: 'COURSE_GROUP_BUY',
            configId: 'cfg-1',
          }),
        }),
      ],
      ctx,
    );
    expect(secondaryBenefitMerger.merge).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          courseGroupJoinExplain: { reasonCode: 'JOINABLE' },
        }),
      ],
      ctx,
    );
    expect(result[0]).toMatchObject({
      courseGroupJoinExplain: { reasonCode: 'JOINABLE' },
    });
  });
});
