import { CampaignPolicyEvaluatorService } from '../../campaign/policy-evaluator.service';
import { PolicyEvaluatorAdapter } from './policy-evaluator.adapter';

describe('PolicyEvaluatorAdapter', () => {
  const evaluator = {
    evaluate: jest.fn(),
    validatePolicyConfig: jest.fn(),
  };
  let service: PolicyEvaluatorAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PolicyEvaluatorAdapter(evaluator as unknown as CampaignPolicyEvaluatorService);
  });

  describe('invariants', () => {
    it('returns evaluator eligibility for MktCampaign context', async () => {
      const campaign = { id: 'c1', policyJson: { source: 'campaign-admin' } } as any;
      evaluator.evaluate.mockReturnValue({ eligible: true });

      const eligible = await service.checkEligibility({ campaign, memberId: 'm1' } as any);

      expect(eligible).toBe(true);
      expect(evaluator.evaluate).toHaveBeenCalledWith(campaign, { memberId: 'm1' });
    });

    it('forwards campaign json sections to policy validation', async () => {
      const campaign = { audienceJson: { a: 1 }, stagesJson: { b: 1 }, rightsJson: { c: 1 } } as any;

      await service.validateConfig(campaign);

      expect(evaluator.validatePolicyConfig).toHaveBeenCalledWith({
        triggerCondition: { a: 1 },
        rules: { b: 1 },
        rewards: { c: 1 },
      });
    });
  });

  describe('boundary conditions', () => {
    it('rejects non-campaign play subjects during eligibility checks', async () => {
      await expect(service.checkEligibility({ campaign: { rules: {} }, memberId: 'm1' } as any)).rejects.toThrow(
        'POLICY_EVAL handler requires MktCampaign context',
      );
    });

    it('does not add price for policy evaluation handlers', async () => {
      await expect(service.resolvePrice({} as any)).resolves.toBeNull();
    });
  });
});
