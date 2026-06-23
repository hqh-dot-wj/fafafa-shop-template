import { Injectable } from '@nestjs/common';
import { DelFlag, Status } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  MARKETING_CLIENT_SCENE_ENABLED_KEY,
  MARKETING_CLIENT_SCENE_ROLLOUT_PERCENT_KEY,
} from 'src/module/marketing/marketing-client-runtime.constants';
import { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import { UserMarketingContext } from 'src/module/marketing/resolution/dto/user-marketing-context.dto';
import { SceneModulesResult } from 'src/module/marketing/resolution/resolution.service';

export type { SceneModulesResult };

export interface ClientSceneQueryOptions {
  moduleLimit?: number;
  productLimit?: number;
}

@Injectable()
export class ClientSceneService {
  constructor(
    private readonly resolutionService: ResolutionService,
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * uiConfig.featuredCount 与 product.cardLayout 均由场景发布快照透传（ProductCardViewBuilder），
   * 本层不做额外赋值；前端缺省时按 featuredCount 自行兜底。
   */
  async getSceneModules(
    sceneCode: string,
    ctx: UserMarketingContext,
    options: ClientSceneQueryOptions = {},
  ): Promise<SceneModulesResult> {
    await this.assertSceneTrafficAllowed(ctx);
    return this.resolutionService.resolveSceneView({
      sceneCode,
      userContext: ctx,
      moduleLimit: options.moduleLimit,
      productLimit: options.productLimit,
    });
  }

  private async assertSceneTrafficAllowed(ctx: UserMarketingContext): Promise<void> {
    if (ctx.channel === 'ADMIN_PREVIEW') {
      return;
    }

    const enabledRaw = await this.readSysConfigValue(ctx.tenantId, MARKETING_CLIENT_SCENE_ENABLED_KEY);
    const enabled = this.parseEnabled(enabledRaw);
    BusinessException.throwIf(!enabled, '场景营销接口已关闭，请稍后再试');

    const rolloutRaw = await this.readSysConfigValue(ctx.tenantId, MARKETING_CLIENT_SCENE_ROLLOUT_PERCENT_KEY);
    const rolloutPercent = this.parseRolloutPercent(rolloutRaw);
    if (rolloutPercent >= 100) {
      return;
    }
    if (rolloutPercent <= 0) {
      BusinessException.throwIf(true, '场景营销接口已关闭，请稍后再试');
    }

    const bucket = this.stablePercentBucket(`${ctx.tenantId}:${ctx.memberId}`);
    BusinessException.throwIf(bucket >= rolloutPercent, '场景营销接口当前处于放量阶段，请稍后再试');
  }

  private parseEnabled(raw: string | null): boolean {
    if (raw == null || raw.trim() === '') {
      return true;
    }
    const v = raw.trim().toUpperCase();
    if (v === 'N' || v === '0' || v === 'FALSE' || v === 'OFF') {
      return false;
    }
    return true;
  }

  private parseRolloutPercent(raw: string | null): number {
    if (raw == null || raw.trim() === '') {
      return 100;
    }
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) {
      return 100;
    }
    return Math.min(100, Math.max(0, Math.trunc(n)));
  }

  private stablePercentBucket(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash % 100;
  }

  private async readSysConfigValue(tenantId: string, configKey: string): Promise<string | null> {
    const baseWhere: Prisma.SysConfigWhereInput = {
      configKey,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    };

    const tenantRow = await this.prisma.sysConfig.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysConfig', {
        ...baseWhere,
        tenantId,
      }) as Prisma.SysConfigWhereInput,
    });
    if (tenantRow?.configValue != null && tenantRow.configValue.trim() !== '') {
      return tenantRow.configValue.trim();
    }

    if (tenantId === TenantHelper.SUPER_TENANT_ID) {
      return null;
    }

    const platformRow = await this.prisma.sysConfig.findFirst({
      where: {
        ...baseWhere,
        tenantId: TenantHelper.SUPER_TENANT_ID,
      },
    });
    return platformRow?.configValue?.trim() ?? null;
  }
}
