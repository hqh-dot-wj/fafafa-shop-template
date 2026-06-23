import { Injectable } from '@nestjs/common';
import { MktCampaignStatus, Prisma } from '@prisma/client';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { SharePolicyService } from 'src/module/store/distribution/services/share-policy.service';

const ACTIVITY_WINDOW_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedWindow {
  value: number | null;
  expiresAt: number;
}

@Injectable()
export class AttributionConfigService {
  private readonly activityWindowCache = new Map<string, CachedWindow>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly sharePolicyService: SharePolicyService,
  ) {}

  async getAttributionWindowMinutes(input: { tenantId: string; activityVersionId?: string | null }): Promise<number> {
    const activityVersionId = this.normalizeString(input.activityVersionId);
    if (activityVersionId) {
      const activityWindow = await this.readActivityAttributionWindow(input.tenantId, activityVersionId);
      if (this.isPositiveMinutes(activityWindow)) {
        return Math.floor(activityWindow);
      }
    }

    const policy = (await this.sharePolicyService.getPolicy(input.tenantId)).data;
    if (this.isPositiveMinutes(policy?.attributionWindowMinutes)) {
      return Math.floor(policy.attributionWindowMinutes);
    }

    return BusinessConstants.DISTRIBUTION.DEFAULT_ATTRIBUTION_WINDOW_MINUTES;
  }

  async getLinkExpireMinutes(input: { tenantId: string; override?: number | null }): Promise<number> {
    if (this.isPositiveMinutes(input.override)) {
      return Math.floor(input.override);
    }

    const policy = (await this.sharePolicyService.getPolicy(input.tenantId)).data;
    if (this.isPositiveMinutes(policy?.linkExpireMinutes)) {
      return Math.floor(policy.linkExpireMinutes);
    }

    return BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_LINK_EXPIRE_MINUTES;
  }

  private async readActivityAttributionWindow(tenantId: string, activityVersionId: string): Promise<number | null> {
    const cacheKey = `${tenantId}:${activityVersionId}`;
    const cached = this.activityWindowCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const activity = await this.prisma.mktCampaign.findFirst({
      where: this.tenantHelper.readWhereForDelegate('mktCampaign', {
        tenantId,
        status: MktCampaignStatus.PUBLISHED,
        stagesJson: {
          path: ['distributionGrowth', 'activityVersionId'],
          equals: activityVersionId,
        },
      }) as Prisma.MktCampaignWhereInput,
      select: {
        stagesJson: true,
      },
    });

    const value = this.readAttributionWindowFromRules(activity?.stagesJson);
    this.activityWindowCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ACTIVITY_WINDOW_CACHE_TTL_MS,
    });
    return value;
  }

  private readAttributionWindowFromRules(rules: unknown): number | null {
    const root = this.asRecord(rules);
    const distributionGrowth = this.asRecord(root?.distributionGrowth);
    const attributionWindowMinutes = distributionGrowth?.attributionWindowMinutes;

    if (!this.isPositiveMinutes(attributionWindowMinutes)) {
      return null;
    }

    return Math.floor(attributionWindowMinutes);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private isPositiveMinutes(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }
}
