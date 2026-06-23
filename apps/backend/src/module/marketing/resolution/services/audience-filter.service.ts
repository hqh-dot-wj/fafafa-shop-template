import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';
import { ProductCandidate } from './scene-candidate-loader.service';

export interface AudienceFilterResult {
  visible: ProductCandidate[];
  filtered: Array<ProductCandidate & { reason: string }>;
}

@Injectable()
export class AudienceFilterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 按受众策略过滤候选商品。
   * 支持规则：
   * - mode: ALL / NEWCOMER_ONLY
   * - newcomerOnly
   * - memberLevels
   * - channels
   * - crowdTagsAny / crowdTagsAll
   * - regionCodes
   * - includeMemberIds / excludeMemberIds
   */
  async filter(
    candidates: ProductCandidate[],
    audiencePolicyCode: string | null | undefined,
    ctx: UserMarketingContext,
  ): Promise<AudienceFilterResult> {
    const rules = await this.loadAudienceRules(ctx.tenantId, audiencePolicyCode);
    if (!rules) {
      return { visible: candidates, filtered: [] };
    }
    const visible: ProductCandidate[] = [];
    const filtered: Array<ProductCandidate & { reason: string }> = [];
    for (const candidate of candidates) {
      const reason = this.resolveBlockReason(rules, ctx);
      if (reason) {
        filtered.push({ ...candidate, reason });
      } else {
        visible.push(candidate);
      }
    }
    return { visible, filtered };
  }

  private async loadAudienceRules(
    tenantId: string,
    audiencePolicyCode: string | null | undefined,
  ): Promise<Record<string, unknown> | null> {
    const code = audiencePolicyCode?.trim();
    if (!code) return null;

    const policy = await this.prisma.mktPolicy.findUnique({
      where: {
        tenantId_policyCode: {
          tenantId,
          policyCode: code,
        },
      },
      select: {
        policyType: true,
        status: true,
        config: true,
      },
    });
    if (!policy || policy.policyType !== 'AUDIENCE' || policy.status !== 'ACTIVE') {
      return null;
    }

    const config = this.toRecord(policy.config);
    const rules = this.toRecord(config.rules);
    return rules;
  }

  private resolveBlockReason(rules: Record<string, unknown>, ctx: UserMarketingContext): string | null {
    const mode = String(rules.mode ?? 'ALL').toUpperCase();
    const newcomerOnly = this.toBoolean(rules.newcomerOnly) ?? mode === 'NEWCOMER_ONLY';
    if (newcomerOnly && !ctx.isNewcomer) {
      return 'not_newcomer';
    }

    const memberLevels = this.toStringList(rules.memberLevels);
    if (memberLevels.length > 0) {
      const level = String(ctx.memberLevel ?? '').trim();
      if (!level || !memberLevels.includes(level)) {
        return 'member_level_mismatch';
      }
    }

    const channels = this.toStringList(rules.channels).map((item) => item.toUpperCase());
    if (channels.length > 0 && !channels.includes(ctx.channel.toUpperCase())) {
      return 'channel_mismatch';
    }

    const includeMemberIds = this.toStringList(rules.includeMemberIds);
    if (includeMemberIds.length > 0 && !includeMemberIds.includes(String(ctx.memberId ?? ''))) {
      return 'member_not_in_whitelist';
    }

    const excludeMemberIds = this.toStringList(rules.excludeMemberIds);
    if (excludeMemberIds.length > 0 && excludeMemberIds.includes(String(ctx.memberId ?? ''))) {
      return 'member_in_blacklist';
    }

    const regionCodes = this.toStringList(rules.regionCodes);
    if (regionCodes.length > 0) {
      const regionCode = String(ctx.regionCode ?? '').trim();
      if (!regionCode || !regionCodes.includes(regionCode)) {
        return 'region_mismatch';
      }
    }

    const anyTags = this.toStringList(rules.crowdTagsAny);
    if (anyTags.length > 0) {
      const crowdTags = new Set((ctx.crowdTags ?? []).map((item) => item.trim()).filter(Boolean));
      const hit = anyTags.some((tag) => crowdTags.has(tag));
      if (!hit) {
        return 'crowd_tags_any_mismatch';
      }
    }

    const allTags = this.toStringList(rules.crowdTagsAll);
    if (allTags.length > 0) {
      const crowdTags = new Set((ctx.crowdTags ?? []).map((item) => item.trim()).filter(Boolean));
      const hit = allTags.every((tag) => crowdTags.has(tag));
      if (!hit) {
        return 'crowd_tags_all_mismatch';
      }
    }

    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private toStringList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return [];
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
      if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    return null;
  }
}
