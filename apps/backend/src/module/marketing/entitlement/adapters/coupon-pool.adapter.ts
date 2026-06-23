import { EntitlementPoolCompileResultVo } from '../vo/entitlement-compile.vo';
import { CouponTemplateService } from '../../coupon/template/template.service';
import type { CompileEntitlementPoolDto } from '../dto/compile-entitlement.dto';

export class CouponPoolAdapter {
  constructor(private readonly templateService: CouponTemplateService) {}

  async compile(input: Pick<CompileEntitlementPoolDto, 'templateId' | 'poolType'>): Promise<EntitlementPoolCompileResultVo> {
    const templateId = input.templateId ?? '';
    const templateResult = await this.templateService.findOne(input.templateId ?? '');
    const templateData = (templateResult.data as Record<string, unknown> | null) ?? {};
    const status = typeof templateData.status === 'string' ? templateData.status : '';
    const totalStock = typeof templateData.totalStock === 'number' ? templateData.totalStock : 0;
    const remainingStock = typeof templateData.remainingStock === 'number' ? templateData.remainingStock : 0;

    return {
      poolType: 'COUPON',
      poolId: templateId || 'unknown-template',
      compileTarget: {
        owner: 'marketing coupon',
        runtimeArtifacts: ['coupon-template', 'distribution-rule', 'claim-link'],
        forbiddenFacts: ['coupon-stock-ledger', 'coupon-state-machine'],
      },
      preview: {
        templateId,
        template: templateData,
        claimRiskHints: this.getClaimRisk(templateData, status, totalStock, remainingStock),
      },
      riskSummary: this.getRiskSummary(status, totalStock, remainingStock),
    };
  }

  private getClaimRisk(template: Record<string, unknown>, status: string, totalStock: number, remainingStock: number) {
    const risks = this.getRiskSummary(status, totalStock, remainingStock);
    risks.unshift(...this.getClaimHints(template));
    return risks;
  }

  private getClaimHints(template: Record<string, unknown>) {
    const risks: string[] = [];
    const validFrom = typeof template.startTime === 'string' ? template.startTime : '';
    const validTo = typeof template.endTime === 'string' ? template.endTime : '';

    if (validFrom && validTo && new Date(validFrom) > new Date(validTo)) {
      risks.push('券模板有效期非法：起始时间晚于结束时间');
    }
    return risks;
  }

  private getRiskSummary(status: string, totalStock: number, remainingStock: number) {
    const risks: string[] = ['券池仅输出模板与发券链路映射，不新增独立券库存账'];
    if (status && status !== 'ACTIVE') {
      risks.push('券模板未处于 ACTIVE 状态，需注意发布时序');
    }
    if (totalStock > 0 && remainingStock < totalStock) {
      risks.push('券模板库存发生变化，需复核剩余库存');
    }
    if (risks.length === 0) {
      risks.push('券池发放将由营销 coupon owner 统一处理');
    }
    return risks;
  }
}
