import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { Result } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { AddCartDto, UpdateCartQuantityDto } from './dto/cart.dto';
import { CartItemVo } from './vo/cart.vo';
import { Decimal } from '@prisma/client/runtime/library';
import { DelFlag, DistShareTokenStatus, Prisma, PublishStatus } from '@prisma/client';
import { CartRepository } from './cart.repository';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import {
  ActivityContextTokenService,
  VerifiedActivityContextToken,
} from 'src/module/marketing/resolution/services/activity-context-token.service';
import { DistributorEligibilityService } from 'src/module/store/distribution/services/distributor-eligibility.service';
import { ShareTokenService } from 'src/module/store/distribution/services/share-token.service';

type ResolvedCartSid = {
  sid: string | null;
  shareUserId: string | null;
};

/** Redis 中缓存购物车的过期窗口（秒）。与"7 天未活跃即视为放弃购物车"业务约定一致。 */
const CART_REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * C端购物车服务
 * 提供购物车的增删改查功能
 * 数据存储在 PostgreSQL，同时同步到 Redis 缓存
 */
@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly cartRepo: CartRepository,
    private readonly tenantHelper: TenantHelper,
    private readonly tokenService: ActivityContextTokenService,
    private readonly shareTokenService: ShareTokenService,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  /**
   * 添加商品到购物车
   * @param memberId 会员ID
   * @param dto 加购参数
   */
  async addToCart(memberId: string, dto: AddCartDto) {
    BusinessException.throwIf(!memberId, '请先登录');
    const activityContext = this.normalizeAndVerifyCartActivityContext(dto.activityContextKey, dto.tenantId, memberId, {
      bindAnonymous: true,
    });
    const activityContextKey = activityContext?.activityContextKey ?? null;

    // 1. 查询 TenantSku 及关联的商品信息
    const tenantSku = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', { id: dto.skuId, isActive: true }),
      include: {
        tenantProd: {
          include: {
            product: true,
          },
        },
        globalSku: true,
      },
    });
    BusinessException.throwIfNull(tenantSku, '商品不存在或已下架');

    // 1.1 校验总部商品状态 (新增)
    const product = tenantSku.tenantProd.product;
    BusinessException.throwIf(
      product.delFlag === DelFlag.DELETE || product.publishStatus !== PublishStatus.ON_SHELF,
      '商品已下架或暂停销售',
    );

    // 2. 校验租户归属
    BusinessException.throwIf(tenantSku.tenantProd.tenantId !== dto.tenantId, '商品不属于该门店');
    const resolvedSid = await this.resolveCartSid(memberId, dto.tenantId, dto.sid);

    // 3. 按 [memberId, tenantId, skuId, activityContextKey] 查找已有记录
    const existing = await this.prisma.omsCartItem.findFirst({
      where: {
        memberId,
        tenantId: dto.tenantId,
        skuId: dto.skuId,
        activityContextKey,
      },
    });

    // 校验库存 (stock = -1 表示不限库存)
    if (tenantSku.stock >= 0) {
      const totalQuantity = (existing?.quantity || 0) + dto.quantity;
      BusinessException.throwIf(tenantSku.stock < totalQuantity, '库存不足');
    }

    // 4. findFirst + create/update（nullable activityContextKey 不支持复合唯一 upsert）
    let cartItem;
    if (existing) {
      const attributionPatch =
        resolvedSid.sid != null
          ? {
              sid: resolvedSid.sid,
              shareUserId: resolvedSid.shareUserId,
            }
          : {};
      cartItem = await this.prisma.omsCartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: dto.quantity }, updateTime: new Date(), ...attributionPatch },
      });
    } else {
      cartItem = await this.prisma.omsCartItem.create({
        data: {
          memberId,
          tenantId: dto.tenantId,
          productId: tenantSku.tenantProd.productId,
          skuId: dto.skuId,
          quantity: dto.quantity,
          productName: product.name,
          productImg: product.mainImages?.[0] || '',
          price: tenantSku.price,
          specData: tenantSku.globalSku?.specValues || null,
          sid: resolvedSid.sid,
          shareUserId: resolvedSid.shareUserId,
          activityContextKey,
          entrySource: dto.entrySource || null,
          activityType: activityContext?.verified.activityType || null,
          activityConfigId: activityContext?.verified.activityConfigId || null,
        },
      });
    }

    // 5. 同步 Redis 缓存
    await this.syncCartToRedis(memberId, dto.tenantId);

    this.logger.log(`会员 ${memberId} 添加商品 ${dto.skuId} 到购物车`);
    return Result.ok(cartItem, '添加成功');
  }

  /**
   * 获取购物车列表
   * @param memberId 会员ID
   * @param tenantId 租户ID
   */
  async getCartList(memberId: string, tenantId: string) {
    // 1. 查询购物车记录
    // [MODIFIED] Use CartRepository
    const cartItems = await this.cartRepo.findList(memberId, tenantId);

    if (cartItems.length === 0) {
      return Result.ok({ items: [], invalidItems: [] });
    }

    // 2. 批量查询当前 SKU 状态
    const skuIds = cartItems.map((item) => item.skuId);
    const currentSkus = await this.prisma.pmsTenantSku.findMany({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', { id: { in: skuIds } }),
      include: {
        tenantProd: {
          include: { product: true },
        },
      },
    });

    // 3. 构建返回数据
    const items: CartItemVo[] = [];
    const invalidItems: CartItemVo[] = [];

    for (const cartItem of cartItems) {
      const currentSku = currentSkus.find((s) => s.id === cartItem.skuId);
      const verifiedContext = this.tryVerifyStoredCartActivityContext(cartItem.activityContextKey, tenantId, memberId);

      const vo: CartItemVo = {
        id: cartItem.id,
        skuId: cartItem.skuId,
        productId: cartItem.productId,
        productName: cartItem.productName,
        productImg: cartItem.productImg,
        specData: cartItem.specData as Record<string, string> | null,
        addPrice: cartItem.price,
        currentPrice: currentSku?.price || cartItem.price,
        priceChanged: currentSku ? !currentSku.price.equals(cartItem.price) : false,
        quantity: cartItem.quantity,
        stockStatus: this.getStockStatus(currentSku, cartItem.quantity),
        sid: cartItem.sid || undefined,
        shareUserId: cartItem.shareUserId || undefined,
        activityContextKey: verifiedContext ? cartItem.activityContextKey : null,
        activityType: verifiedContext?.activityType ?? null,
        activityNameSnapshot: verifiedContext ? cartItem.activityNameSnapshot : null,
        displayPriceSnapshot: verifiedContext ? (cartItem.displayPriceSnapshot?.toNumber() ?? null) : null,
      };

      // 区分有效和无效商品
      const product = currentSku?.tenantProd?.product;
      const isInvalid =
        !currentSku ||
        !currentSku.isActive ||
        currentSku.tenantProd.status !== PublishStatus.ON_SHELF ||
        !product ||
        product.delFlag === DelFlag.DELETE ||
        product.publishStatus !== PublishStatus.ON_SHELF;

      if (isInvalid) {
        invalidItems.push(vo);
      } else {
        items.push(vo);
      }
    }

    return Result.ok({ items, invalidItems });
  }

  /**
   * 更新购物车商品数量
   */
  async updateQuantity(memberId: string, tenantId: string, dto: UpdateCartQuantityDto) {
    const activityContext = this.normalizeAndVerifyCartActivityContext(dto.activityContextKey, tenantId, memberId);
    const activityContextKey = activityContext?.activityContextKey ?? null;

    // 1. 查询购物车记录（含 activityContextKey 精确匹配，避免多活动行随机命中）
    const cartItem = await this.prisma.omsCartItem.findFirst({
      where: this.tenantHelper.readWhereForDelegate('omsCartItem', {
        memberId,
        tenantId,
        skuId: dto.skuId,
        activityContextKey,
      }) as Prisma.OmsCartItemWhereInput,
    });
    BusinessException.throwIfNull(cartItem, '购物车商品不存在');

    // 2. 校验库存
    const sku = await this.prisma.pmsTenantSku.findFirst({
      where: this.tenantHelper.readWhereForDelegate('pmsTenantSku', { id: dto.skuId }),
    });
    if (sku && sku.stock >= 0 && sku.stock < dto.quantity) {
      BusinessException.throwIf(true, `库存不足，当前库存: ${sku.stock}`);
    }

    // 3. 更新数量
    const updated = await this.prisma.omsCartItem.update({
      where: { id: cartItem.id },
      data: { quantity: dto.quantity },
    });

    // 4. 同步 Redis
    await this.syncCartToRedis(memberId, tenantId);

    return Result.ok(updated, '更新成功');
  }

  /**
   * 按购物车项 ID 删除商品
   *
   * @param memberId - 会员ID
   * @param cartItemId - 购物车项ID
   * @returns 删除结果
   * @throws BusinessException 购物车商品不存在时抛出
   */
  async removeItemById(memberId: string, cartItemId: string) {
    const item = await this.prisma.omsCartItem.findFirst({
      where: { id: cartItemId, memberId },
    });
    BusinessException.throwIfNull(item, '购物车商品不存在');

    await this.prisma.omsCartItem.delete({ where: { id: cartItemId } });
    await this.syncCartToRedis(memberId, item!.tenantId);
    return Result.ok(null, '删除成功');
  }

  /**
   * @deprecated 使用 removeItemById 替代，本方法不支持活动上下文拆行
   */
  async removeItem(memberId: string, tenantId: string, skuId: string) {
    const deleted = await this.prisma.omsCartItem.deleteMany({
      where: { memberId, tenantId, skuId },
    });

    BusinessException.throwIf(deleted.count === 0, '商品不存在');

    await this.syncCartToRedis(memberId, tenantId);

    return Result.ok(null, '删除成功');
  }

  /**
   * 清空购物车
   */
  async clearCart(memberId: string, tenantId: string) {
    await this.prisma.omsCartItem.deleteMany({
      where: { memberId, tenantId },
    });

    // 清除 Redis 缓存
    await this.redis.del(`cart:${memberId}:${tenantId}`);

    return Result.ok(null, '清空成功');
  }

  /**
   * 获取购物车商品数量 (用于 Tabbar 角标)
   */
  async getCartCount(memberId: string, tenantId: string): Promise<number> {
    const result = await this.prisma.omsCartItem.aggregate({
      where: this.tenantHelper.readWhereForDelegate('omsCartItem', { memberId, tenantId }),
      _sum: { quantity: true },
    });
    return result._sum.quantity || 0;
  }

  // ============ 私有方法 ============

  /**
   * 同步购物车到 Redis
   */
  async syncCartToRedis(memberId: string, tenantId: string) {
    try {
      // [MODIFIED] Use CartRepository
      const cartItems = await this.cartRepo.findList(memberId, tenantId);
      // findList returns all fields, map to {skuId, quantity} is done below or validation not needed for redis sync as we just need skuId and quantity which are present.

      const key = `cart:${memberId}:${tenantId}`;
      if (cartItems.length === 0) {
        await this.redis.del(key);
      } else {
        const data: Record<string, string> = {};
        cartItems.forEach((item) => {
          const verifiedContext = this.tryVerifyStoredCartActivityContext(item.activityContextKey, tenantId, memberId);
          const field = `${item.skuId}:${verifiedContext ? item.activityContextKey : ''}`;
          data[field] = JSON.stringify({ quantity: item.quantity, sid: item.sid || null });
        });
        await this.redis.hmset(key, data, CART_REDIS_TTL_SECONDS);
      }
    } catch (error) {
      this.logger.warn('同步购物车到Redis失败', error);
    }
  }

  /**
   * 判断库存状态
   */
  private getStockStatus(
    sku: { stock: number; isActive: boolean } | null,
    quantity: number,
  ): 'normal' | 'insufficient' | 'soldOut' {
    if (!sku || !sku.isActive) return 'soldOut';
    if (sku.stock === -1) return 'normal'; // 不限库存
    if (sku.stock === 0) return 'soldOut';
    if (sku.stock < quantity) return 'insufficient';
    return 'normal';
  }

  private normalizeAndVerifyCartActivityContext(
    value: string | null | undefined,
    tenantId: string,
    memberId: string,
    options: { bindAnonymous?: boolean } = {},
  ): { activityContextKey: string; verified: VerifiedActivityContextToken } | null {
    const token = value?.trim();
    if (!token) {
      return null;
    }

    const verified = this.tokenService.verify(
      token,
      { tenantId, memberId },
      { allowAnonymousMember: options.bindAnonymous === true },
    );
    if (options.bindAnonymous && verified.memberId === null) {
      return {
        activityContextKey: this.tokenService.issueForMember(verified, memberId),
        verified: {
          ...verified,
          memberId,
        },
      };
    }

    return { activityContextKey: token, verified };
  }

  private tryVerifyStoredCartActivityContext(
    value: string | null | undefined,
    tenantId: string,
    memberId: string,
  ): VerifiedActivityContextToken | null {
    const token = value?.trim();
    if (!token) {
      return null;
    }
    try {
      return this.tokenService.verify(token, { tenantId, memberId });
    } catch {
      return null;
    }
  }

  private async resolveCartSid(
    memberId: string,
    tenantId: string,
    value: string | null | undefined,
  ): Promise<ResolvedCartSid> {
    const sid = value?.trim();
    if (!sid) {
      return { sid: null, shareUserId: null };
    }

    const token = await this.shareTokenService.findBySid(sid, tenantId);
    if (!token || token.status !== DistShareTokenStatus.ACTIVE || token.shareUserId === memberId) {
      return { sid: null, shareUserId: null };
    }
    if (!(await this.distributorEligibilityService.isActive(tenantId, token.shareUserId))) {
      return { sid: null, shareUserId: null };
    }

    return { sid: token.sid, shareUserId: token.shareUserId };
  }
}
