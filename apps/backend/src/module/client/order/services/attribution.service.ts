import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

interface AttributionCachePayload {
  shareUserId: string;
  activityVersionId?: string;
  attributionWindowMinutes?: number;
  sourceChannel?: string;
}

interface FinalAttributionResult {
  shareUserId: string | null;
  activityVersionId?: string;
  attributionWindowMinutes?: number;
  sourceChannel?: string;
}

export interface AttributionLookupOptions {
  /** 当传入 tenantId 时，启用 cart 行 last-touch 兜底（设计稿 §3.6）。 */
  tenantId?: string;
  /**
   * 限定 cart 行 last-touch 兜底只在这些 sku 范围内查找。
   * 传空数组（如 direct-buy）等价于跳过 cart 行兜底，避免读到该会员/租户的历史 cart sid。
   */
  cartSkuIds?: string[];
}

@Injectable()
export class AttributionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 获取最终归因人 (优先级: 参数 > cart 行 sid > Redis > 永久绑定)
   *
   * cart 行 sid 仅在 caller 传 tenantId 时启用；调用方在 preview 阶段已自行解析 last-touch
   * 时可继续显式传入 inputShareId 跳过这段查询。设计依据见 docs/design/marketing-revamp/P0-04 §3.6。
   */
  async getFinalShareUserId(
    memberId: string,
    inputShareId?: string,
    options: AttributionLookupOptions = {},
  ): Promise<string | null> {
    const attribution = await this.getFinalAttribution(memberId, inputShareId, options);
    return attribution.shareUserId;
  }

  async getFinalAttribution(
    memberId: string,
    inputShareId?: string,
    options: AttributionLookupOptions = {},
  ): Promise<FinalAttributionResult> {
    // 0. 如果 memberId 为空，直接返回 inputShareId 或 null
    if (!memberId) {
      return { shareUserId: inputShareId || null };
    }

    // 1. 优先使用本次参数（preview 阶段已解析的 last-touch）
    if (inputShareId) {
      return { shareUserId: inputShareId };
    }

    // 2. cart 行 last-touch（设计稿 §3.6 三段优先级首段）
    // 仅在 caller 提供了本次 preview 的 cartSkuIds 时启用：
    // - cartSkuIds 为空数组：direct-buy 等无 cart 路径，跳过避免读到历史 cart sid
    // - cartSkuIds 为 undefined：兼容旧 caller，保留全范围查询（标记为遗留路径，新代码应显式传值）
    if (options.tenantId && (options.cartSkuIds === undefined || options.cartSkuIds.length > 0)) {
      const cartShareUserId = await this.findCartLastTouchShareUserId(memberId, options.tenantId, options.cartSkuIds);
      if (cartShareUserId) {
        return { shareUserId: cartShareUserId, sourceChannel: 'CART_SID' };
      }
    }

    // 3. 其次查询 Redis 归因缓存
    const redisKey = `attr:member:${memberId}`;
    const cached = this.parseCachePayload(await this.redis.get(redisKey));
    if (cached) {
      return {
        shareUserId: cached.shareUserId,
        activityVersionId: cached.activityVersionId,
        attributionWindowMinutes: cached.attributionWindowMinutes,
        sourceChannel: cached.sourceChannel,
      };
    }

    // 4. 最后使用永久绑定 (parentId)
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
      select: { parentId: true },
    });
    return { shareUserId: member?.parentId || null };
  }

  /**
   * 查询当前 member 名下最近更新的 cart 行 shareUserId（即 last-touch sid 对应的分享人）。
   *
   * cart 行写入时已经过 ShareTokenService + DistributorEligibilityService 校验
   * （见 cart.service.ts#resolveCartSid），此处直接读取 shareUserId 列即可；
   * checkout preview 路径会对 sid 状态做实时复核，避免 token 写入后 EXPIRED/DISABLED 仍归因的边界。
   *
   * cartSkuIds 限制查询范围：传入时仅在本次提交的 sku 对应的 cart 行内查找，
   * 避免读到该会员/租户的历史 cart sid。传 undefined 是遗留兼容路径。
   */
  private async findCartLastTouchShareUserId(
    memberId: string,
    tenantId: string,
    cartSkuIds?: string[],
  ): Promise<string | null> {
    const where = this.tenantHelper.readWhereForDelegate('omsCartItem', {
      memberId,
      tenantId,
      shareUserId: { not: null },
      ...(cartSkuIds && cartSkuIds.length > 0 ? { skuId: { in: cartSkuIds } } : {}),
    }) as Prisma.OmsCartItemWhereInput;
    const row = await this.prisma.omsCartItem.findFirst({
      where,
      orderBy: { updateTime: 'desc' },
      select: { shareUserId: true },
    });
    const value = row?.shareUserId?.trim();
    return value && value !== memberId ? value : null;
  }

  private parseCachePayload(raw: string | null): AttributionCachePayload | null {
    if (!raw) return null;

    if (!raw.startsWith('{')) {
      return { shareUserId: raw };
    }

    try {
      const parsed = JSON.parse(raw) as AttributionCachePayload;
      if (!parsed?.shareUserId) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
