import { Injectable } from '@nestjs/common';
import { StorePlayConfig } from '@prisma/client';

export interface EligibilityContext {
  memberId: string;
  now: Date;
  isNewcomer?: boolean;
  memberLevel?: string | number;
}

export interface FilterResult {
  eligible: StorePlayConfig[];
  filtered: Array<{ config: StorePlayConfig; reason: string }>;
}

@Injectable()
export class EligibilityFilterService {
  /**
   * 过滤候选活动，返回有资格参与的配置和被过滤的配置及原因
   *
   * @param candidates - 候选活动配置列表
   * @param ctx - 资格判定上下文（会员信息、当前时间等）
   * @returns 有资格和被过滤的分组结果
   */
  filterCandidates(candidates: StorePlayConfig[], ctx: EligibilityContext): FilterResult {
    const eligible: StorePlayConfig[] = [];
    const filtered: Array<{ config: StorePlayConfig; reason: string }> = [];
    for (const config of candidates) {
      const reason = this.checkEligibility(config, ctx);
      if (reason) {
        filtered.push({ config, reason });
      } else {
        eligible.push(config);
      }
    }
    return { eligible, filtered };
  }

  private checkEligibility(config: StorePlayConfig, ctx: EligibilityContext): string | null {
    const rules = config.rules as Record<string, unknown>;
    if (rules.endTime && new Date(rules.endTime as string) < ctx.now) return 'expired';
    if (rules.startTime && new Date(rules.startTime as string) > ctx.now) return 'not_started';
    if (config.templateCode === 'NEWCOMER' && !ctx.isNewcomer) return 'not_newcomer';
    if (config.templateCode === 'MEMBER_PRICE') {
      const memberLevels = Array.isArray(rules.memberLevels)
        ? (rules.memberLevels as Array<string | number>).map((level) => String(level))
        : [];
      if (memberLevels.length > 0 && !memberLevels.includes(String(ctx.memberLevel ?? ''))) {
        return 'not_member_level';
      }
    }
    return null;
  }
}
