import { BusinessException } from 'src/common/exceptions';
import { DistributionGrowthHandler } from '../distribution-growth.handler';

describe('DistributionGrowthHandler', () => {
  const handler = new DistributionGrowthHandler();

  const buildDistributionGrowth = () => ({
    activityVersionId: 'version_001',
    shareChannel: 'MINIAPP',
    shareLandingPage: '/pages/marketing/distribution/index',
    referralCodeEnabled: true,
    attributionWindowMinutes: 4320,
    commissionBudgetTotal: 100000,
    commissionBudgetAlertThreshold: 70,
    commissionBudgetFuseThreshold: 90,
    upgradeRule: { trigger: 'FIRST_ORDER_PAID', level: 'L1' },
    teamThresholdRule: { minTeamSize: 10, minActiveMembers: 5 },
  });

  it('rejects when activityVersionId is missing', async () => {
    const distributionGrowth = buildDistributionGrowth();
    delete (distributionGrowth as { activityVersionId?: string }).activityVersionId;

    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth,
        },
        {},
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('rejects when commission budget is missing', async () => {
    const distributionGrowth = buildDistributionGrowth();
    delete (distributionGrowth as { commissionBudgetTotal?: number }).commissionBudgetTotal;

    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth,
        },
        {},
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('rejects when attributionWindowMinutes is empty', async () => {
    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth: {
            ...buildDistributionGrowth(),
            attributionWindowMinutes: 0,
          },
        },
        {},
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('rejects when teamThresholdRule is empty', async () => {
    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth: {
            ...buildDistributionGrowth(),
            teamThresholdRule: {},
          },
        },
        {},
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('rejects when referralCodeEnabled=true but shareLandingPage is empty', async () => {
    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth: {
            ...buildDistributionGrowth(),
            shareLandingPage: '',
          },
        },
        {},
      ),
    ).rejects.toThrow(BusinessException);
  });

  it('passes when distribution growth config is valid', async () => {
    await expect(
      handler.validateConfig(
        {},
        {
          distributionGrowth: buildDistributionGrowth(),
        },
        {},
      ),
    ).resolves.toBeUndefined();
  });
});
