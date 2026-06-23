import { Injectable } from '@nestjs/common';
import { MktCampaign } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions';

export interface CampaignPolicyContext {
  memberId?: string;
  skuId?: string;
  now?: Date;
}

export interface CampaignPolicyEvaluation {
  eligible: boolean;
  reason?: string;
}

@Injectable()
export class CampaignPolicyEvaluatorService {
  evaluate(campaign: MktCampaign, _context: CampaignPolicyContext = {}): CampaignPolicyEvaluation {
    const policy = this.toRecord(campaign.policyJson);
    if (Object.keys(policy).length === 0) {
      return { eligible: false, reason: 'POLICY_EMPTY' };
    }
    return { eligible: true };
  }

  validatePolicyConfig(input: { triggerCondition: unknown; rules: unknown; rewards: unknown }): void {
    const triggerCondition = this.toRecord(input.triggerCondition);
    const rules = this.toRecord(input.rules);
    const rewards = this.toRecord(input.rewards);

    BusinessException.throwIf(Object.keys(triggerCondition).length === 0, '配置型活动缺少 triggerCondition');
    BusinessException.throwIf(Object.keys(rules).length === 0, '配置型活动缺少 rules');
    BusinessException.throwIf(Object.keys(rewards).length === 0, '配置型活动缺少 rewards');
    this.assertMoneyFieldsAreString(rules);
    this.assertMoneyFieldsAreString(rewards);
  }

  private assertMoneyFieldsAreString(value: unknown): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.assertMoneyFieldsAreString(item));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      BusinessException.throwIf(
        key === 'discountValue' && typeof child === 'number',
        '金额字段 discountValue 必须使用字符串',
      );
      this.assertMoneyFieldsAreString(child);
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  }
}
