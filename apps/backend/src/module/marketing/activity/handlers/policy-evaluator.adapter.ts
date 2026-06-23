import { Injectable } from '@nestjs/common';
import { MktCampaign } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CampaignPolicyEvaluatorService } from '../../campaign/policy-evaluator.service';
import { IPlayHandler, PlayContext, PlaySubject } from '../../play/play-handler.interface';

@Injectable()
export class PolicyEvaluatorAdapter implements IPlayHandler {
  readonly code = 'POLICY_EVAL';

  constructor(private readonly evaluator: CampaignPolicyEvaluatorService) {}

  async checkEligibility(ctx: PlayContext): Promise<boolean> {
    return this.evaluator.evaluate(this.assertMktCampaign(ctx.campaign), { memberId: ctx.memberId }).eligible;
  }

  async applyRewards(_ctx: PlayContext): Promise<void> {
    return;
  }

  async resolvePrice(_ctx: PlayContext): Promise<Decimal | null> {
    return null;
  }

  async validateConfig(campaign: PlaySubject): Promise<void> {
    this.evaluator.validatePolicyConfig({
      triggerCondition: 'audienceJson' in campaign ? campaign.audienceJson : undefined,
      rules: 'stagesJson' in campaign ? campaign.stagesJson : undefined,
      rewards: 'rightsJson' in campaign ? campaign.rightsJson : undefined,
    });
  }

  private assertMktCampaign(campaign: PlaySubject): MktCampaign {
    if (!('policyJson' in campaign)) {
      throw new Error('POLICY_EVAL handler requires MktCampaign context');
    }
    return campaign as MktCampaign;
  }
}
