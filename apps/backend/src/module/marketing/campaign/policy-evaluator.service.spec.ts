import { BusinessException } from 'src/common/exceptions';
import { CampaignPolicyEvaluatorService } from './policy-evaluator.service';

describe('CampaignPolicyEvaluatorService', () => {
  let service: CampaignPolicyEvaluatorService;

  beforeEach(() => {
    service = new CampaignPolicyEvaluatorService();
  });

  describe('invariants', () => {
    it('marks campaigns with empty policy as ineligible', () => {
      const result = service.evaluate({ policyJson: {} } as any);

      expect(result).toEqual({ eligible: false, reason: 'POLICY_EMPTY' });
    });

    it('accepts non-empty policy payloads', () => {
      const result = service.evaluate({ policyJson: { source: 'campaign-admin' } } as any);

      expect(result).toEqual({ eligible: true });
    });
  });

  describe('boundary conditions', () => {
    it('rejects missing policy sections', () => {
      expect(() => service.validatePolicyConfig({ triggerCondition: {}, rules: { a: 1 }, rewards: { b: 1 } })).toThrow(
        BusinessException,
      );
    });

    it('rejects numeric discountValue recursively', () => {
      try {
        service.validatePolicyConfig({
          triggerCondition: { scene: 'order' },
          rules: { nested: { discountValue: 10 } },
          rewards: { points: '1' },
        });
        expect.fail('Expected BusinessException');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).getResponse()).toMatchObject({
          msg: '金额字段 discountValue 必须使用字符串',
        });
      }
    });

    it('accepts string discountValue recursively', () => {
      expect(() =>
        service.validatePolicyConfig({
          triggerCondition: { scene: 'order' },
          rules: { nested: { discountValue: '10.00' } },
          rewards: { coupon: { discountValue: '5.00' } },
        }),
      ).not.toThrow();
    });
  });
});
