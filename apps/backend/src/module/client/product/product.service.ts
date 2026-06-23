import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, PmsCategory, ProductType } from '@prisma/client';
import { Result, ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { ClientListProductDto } from './dto';
import { TenantContext } from 'src/common/tenant/tenant.context';
import { ResolutionService } from 'src/module/marketing/resolution/resolution.service';
import { ResolvedActivityContextVo } from 'src/module/marketing/resolution/vo/resolved-activity-context.vo';
import { ClientProductRepository } from './product.repository';
import { CacheManagerService } from 'src/module/common/redis/cache-manager.service';
import { ClientProductDetailVo } from './vo';
import { ProductQueryFallbackService } from './product-query-fallback.service';
import {
  NormalizedProductListQuery,
  ProductListCachePayload,
  buildProductListCacheKey,
  buildProductListTenantSnapshotCacheKey,
  normalizeProductListQuery,
} from './product-query-cache.util';
import { recordRateLimitEvent } from 'src/common/guards/rate-limit.metrics';
import { buildProductDisplayProjection } from 'src/module/pms/product-display-projection.util';
import * as crypto from 'crypto';

/**
 * 分类树节点
 */
interface CategoryTreeNode {
  catId: number;
  name: string;
  icon: string | null;
  parentId: number | null;
  sort: number;
  children?: CategoryTreeNode[];
}

/**
 * 租户商品SKU信息
 */
interface TenantProductWithSkus {
  createTime?: Date;
  isHot?: boolean;
  skus: Array<{ id: string; globalSkuId: string; price: Prisma.Decimal; stock: number }>;
}

/**
 * 活动 rules.skuPrices 的 key 在配置里多为全局 skuId；C 端 selectedSku 可能是门店 skuId。
 * 同时保留 globalId 与 tenantSkuId，避免映射失败时所有规格都被判为「未参与活动」。
 */
function remapSkuPricesForClient(
  skuPrices: Record<string, unknown>,
  tenantSkuMap: Map<string, { id: string; price: Prisma.Decimal; stock: number }>,
): Record<string, unknown> {
  const remapped: Record<string, unknown> = {};
  for (const [globalId, val] of Object.entries(skuPrices)) {
    remapped[globalId] = val;
    const tenantSku = tenantSkuMap.get(globalId);
    if (tenantSku?.id) {
      remapped[tenantSku.id] = val;
    }
  }
  return remapped;
}

/**
 * 商品详情缓存载荷
 */
interface ProductDetailCachePayload {
  state: 'OK' | 'NOT_FOUND' | 'OFF_SHELF';
  data?: ClientProductDetailVo;
}

const PRODUCT_LIST_CACHE_TTL_SECONDS = 5 * 60;
const PRODUCT_DETAIL_CACHE_TTL_SECONDS = 2 * 60;
const PRODUCT_CATEGORY_CACHE_TTL_SECONDS = 10 * 60;
const PRODUCT_STALE_CACHE_TTL_SECONDS = 30 * 60;
const PRODUCT_LIST_L1_CACHE_TTL_MS = 10 * 1000;
const PRODUCT_DETAIL_L1_CACHE_TTL_MS = 15 * 1000;
const PRODUCT_CATEGORY_L1_CACHE_TTL_MS = 30 * 1000;
const PRODUCT_L1_CACHE_MAX_ENTRIES = 2000;

const parseIntWithBounds = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  if (!raw || raw.trim().length === 0) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const parseBooleanValue = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw || raw.trim().length === 0) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

// 单实例商品查询并发舱壁：防止高并发 miss 把数据库打满。
const PRODUCT_LIST_INFLIGHT_LIMIT = parseIntWithBounds(process.env.CLIENT_PRODUCT_LIST_INFLIGHT_LIMIT, 400, 10, 10000);
const PRODUCT_LIST_OVERLOAD_FALLBACK_ENABLED = parseBooleanValue(
  process.env.CLIENT_PRODUCT_LIST_OVERLOAD_FALLBACK_ENABLED,
  true,
);

/**
 * C端商品服务层
 * 提供商品列表、详情以及分类接口
 * 支持租户上下文：如果有租户ID，返回门店价格；否则返回总部指导价
 */

@Injectable()
export class ClientProductService {
  private readonly logger = new Logger(ClientProductService.name);
  private readonly l1Cache = new Map<string, { value: unknown; expiresAt: number }>();
  private static productListInflight = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolutionService: ResolutionService,
    private readonly productRepo: ClientProductRepository,
    private readonly cacheManager: CacheManagerService,
    private readonly productQueryFallbackService: ProductQueryFallbackService,
  ) {}

  /**
   * 获取商品列表
   * 【重要】C端接口：只返回当前租户已上架的商品
   * - 如果有租户ID：从PmsTenantProduct查起，只返回该租户已上架的商品
   * - 如果是超级租户：返回所有总部已上架的商品（用于Selection Center）
   */
  async findAll(query: ClientListProductDto) {
    const tenantId = this.resolveTenantId();
    const normalizedQuery = this.normalizeListQuery(query);
    const acquired = this.tryAcquireProductListSlot();
    if (!acquired) {
      const fallbackResult = await this.tryBuildOverloadFallbackResult(tenantId, query);
      if (fallbackResult) {
        recordRateLimitEvent('overload_guard', 'client-product-list', 'fallback');
        return fallbackResult;
      }

      recordRateLimitEvent('overload_guard', 'client-product-list', 'reject');
      throw new HttpException(
        Result.fail(ResponseCode.TOO_MANY_REQUESTS, '当前查询流量过高，请稍后再试'),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const cacheKey = this.buildListCacheKey(tenantId, normalizedQuery);
      const cachedPage = await this.getOrLoadWithCache<ProductListCachePayload>(
        cacheKey,
        PRODUCT_LIST_CACHE_TTL_SECONDS,
        async () => {
          this.logger.debug(`获取商品列表，租户ID: ${tenantId}`);
          const result = await this.findTenantProducts(normalizedQuery, tenantId);
          const page = result.data as ProductListCachePayload | undefined;
          return {
            rows: page?.rows ?? [],
            total: page?.total ?? 0,
          };
        },
        PRODUCT_LIST_L1_CACHE_TTL_MS,
      );
      void this.writeTenantListSnapshotCache(tenantId, cachedPage);

      return Result.page(cachedPage.rows, cachedPage.total, normalizedQuery.pageNum, normalizedQuery.pageSize);
    } finally {
      this.releaseProductListSlot();
    }
  }

  /**
   * 查询租户商品列表（普通租户使用）
   */
  private async findTenantProducts(query: NormalizedProductListQuery, tenantId: string) {
    const { name, categoryId, type } = query;

    // 如果传了分类ID，获取该分类及其所有子分类的ID
    let categoryIds: number[] = [];
    if (categoryId) {
      categoryIds = await this.getAllCategoryIds(categoryId);
    }

    // 构建商品筛选条件
    const productConditions: Prisma.PmsProductWhereInput[] = [{ publishStatus: 'ON_SHELF' }];

    if (name) {
      productConditions.push({ name: this.buildProductNameFilter(name) });
    }
    if (categoryIds.length > 0) {
      productConditions.push({ categoryId: { in: categoryIds } });
    }
    if (type) {
      productConditions.push({ type: type as ProductType });
    }

    const tenantProductWhere: Prisma.PmsTenantProductWhereInput = {
      tenantId,
      status: 'ON_SHELF',
      product: {
        AND: productConditions,
      },
    };

    // [MODIFIED] Use ClientProductRepository
    const [tenantProducts, total] = await Promise.all([
      this.productRepo.findTenantProducts(tenantId, tenantProductWhere, query.skip, query.take),
      this.productRepo.countTenantProducts(tenantId, tenantProductWhere),
    ]);

    const productIds = tenantProducts.map((tp) => tp.product.productId);
    const activityMap = await this.resolutionService
      .resolveMainActivitiesBatch({ tenantId, memberId: '', productIds })
      .catch(
        (): Map<string, ResolvedActivityContextVo | null> =>
          new Map(productIds.map((pid): [string, ResolvedActivityContextVo | null] => [pid, null])),
      );

    const records = tenantProducts.map((tenantProd) => {
      const product = tenantProd.product;
      const tenantSku = tenantProd.skus?.[0];
      const price = tenantSku?.price || product.globalSkus?.[0]?.guidePrice || 0;
      const totalStock = tenantProd.skus?.reduce((sum, sku) => sum + (sku.stock || 0), 0) || 0;
      const activity = activityMap.get(product.productId) ?? null;
      const displayProjection = this.buildProductDisplayProjection(product, tenantProd);

      return {
        productId: product.productId,
        name: tenantProd.customTitle || product.name,
        subTitle: product.subTitle,
        mainImages: product.mainImages || [],
        coverImage: product.mainImages?.[0] || null,
        type: product.type,
        categoryId: product.categoryId,
        categoryName: product.category?.name,
        price,
        stock: totalStock,
        isHot: tenantProd.isHot,
        ...displayProjection,
        mainActivitySummary: activity
          ? {
              activityContextKey: activity.activityContextKey,
              activityType: activity.activityType,
              tagLabel: activity.activityName,
              displayPrice: Number(activity.activityPrice),
            }
          : null,
      };
    });

    return Result.page(records, total, query.pageNum, query.pageSize);
  }

  /**
   * 查询全局商品列表（超级租户使用）
   * 用于 Selection Center 等场景
   */
  private async findGlobalProducts(query: NormalizedProductListQuery) {
    const { name, categoryId, type } = query;

    // 如果传了分类ID，获取该分类及其所有子分类的ID
    let categoryIds: number[] = [];
    if (categoryId) {
      categoryIds = await this.getAllCategoryIds(categoryId);
    }

    // 构建查询条件 - 只查询已上架商品
    const where: Prisma.PmsProductWhereInput = {
      publishStatus: 'ON_SHELF',
    };

    if (name) {
      where.name = this.buildProductNameFilter(name);
    }
    if (categoryIds.length > 0) {
      where.categoryId = { in: categoryIds };
    }
    if (type) {
      where.type = type as ProductType;
    }

    // [MODIFIED] Use ClientProductRepository
    const [list, total] = await Promise.all([
      this.productRepo.findGlobalProducts(where, query.skip, query.take),
      this.productRepo.countGlobalProducts(where),
    ]);

    // 数据映射：转换为前端期望的 VO 格式
    const records = list.map((item) => {
      const price = item.globalSkus?.[0]?.guidePrice || 0;
      // 全局商品(总部标准库)不存储库存，库存由各门店(PmsTenantSku)维护
      const totalStock = 999;
      const displayProjection = this.buildProductDisplayProjection(item);

      return {
        productId: item.productId,
        name: item.name,
        subTitle: item.subTitle,
        mainImages: item.mainImages || [],
        coverImage: item.mainImages?.[0] || null,
        type: item.type,
        categoryId: item.categoryId,
        categoryName: item.category?.name,
        price,
        stock: totalStock,
        ...displayProjection,
      };
    });

    return Result.page(records, total, query.pageNum, query.pageSize);
  }

  /**
   * 获取商品详情
   * 如果有租户上下文，返回该租户的门店价格，并裁决主活动
   *
   * @param id - 商品ID
   * @param activityContextKey - 活动上下文键（成交侧锁定指定活动）
   * @returns 商品详情（含主活动上下文）
   */
  async findOne(id: string, activityContextKey?: string | null) {
    const tenantId = this.resolveTenantId();
    const normalizedActivityContextKey = activityContextKey?.trim() || null;
    const cacheKey = this.buildDetailCacheKey(id, tenantId, normalizedActivityContextKey);
    const detailPayload = await this.getOrLoadWithCache<ProductDetailCachePayload>(
      cacheKey,
      PRODUCT_DETAIL_CACHE_TTL_SECONDS,
      async () => this.loadProductDetailPayload(id, tenantId, normalizedActivityContextKey),
      PRODUCT_DETAIL_L1_CACHE_TTL_MS,
    );

    if (detailPayload.state === 'NOT_FOUND') {
      BusinessException.throwIf(true, '商品不存在');
    }
    if (detailPayload.state === 'OFF_SHELF') {
      BusinessException.throwIf(true, '商品已下架');
    }
    BusinessException.throwIf(!detailPayload.data, '商品详情加载失败');
    return Result.ok(detailPayload.data);
  }

  /**
   * 获取商品分类树
   */
  async findCategoryTree() {
    const tree = await this.getOrLoadWithCache<CategoryTreeNode[]>(
      'client:product:category:tree',
      PRODUCT_CATEGORY_CACHE_TTL_SECONDS,
      async () => {
        const categories = await this.prisma.pmsCategory.findMany({
          orderBy: { sort: 'asc' },
        });
        return this.buildTree(categories);
      },
      PRODUCT_CATEGORY_L1_CACHE_TTL_MS,
    );

    return Result.ok(tree);
  }

  private buildProductDisplayProjection(
    product: {
      type?: unknown;
      isFreeShip?: unknown;
      needBooking?: unknown;
      serviceDuration?: unknown;
      serviceRadius?: unknown;
    },
    tenantProduct?: { createTime?: unknown; isHot?: unknown } | null,
  ) {
    return buildProductDisplayProjection({
      productType: product.type,
      isFreeShip: product.isFreeShip,
      needBooking: product.needBooking,
      serviceDuration: product.serviceDuration,
      serviceRadius: product.serviceRadius,
      tenantProductCreateTime: tenantProduct?.createTime,
      tenantProductIsHot: tenantProduct?.isHot,
    });
  }

  /**
   * 获取商品分类列表(平铺)
   */
  async findCategoryList(parentId?: number) {
    const categories = await this.getOrLoadWithCache<
      Array<Pick<PmsCategory, 'catId' | 'name' | 'icon' | 'parentId' | 'sort'>>
    >(
      this.buildCategoryListCacheKey(parentId),
      PRODUCT_CATEGORY_CACHE_TTL_SECONDS,
      async () => {
        const where: Prisma.PmsCategoryWhereInput = {};
        if (parentId !== undefined) {
          where.parentId = parentId === 0 ? null : parentId;
        }

        return await this.prisma.pmsCategory.findMany({
          where,
          orderBy: { sort: 'asc' },
          select: {
            catId: true,
            name: true,
            icon: true,
            parentId: true,
            sort: true,
          },
        });
      },
      PRODUCT_CATEGORY_L1_CACHE_TTL_MS,
    );
    return Result.ok(categories);
  }

  /**
   * 构建分类树结构
   */
  private buildTree(items: PmsCategory[], parentId: number | null = null): CategoryTreeNode[] {
    const tree: CategoryTreeNode[] = [];
    for (const item of items) {
      if (item.parentId === parentId) {
        const children = this.buildTree(items, item.catId);
        tree.push({
          catId: item.catId,
          name: item.name,
          icon: item.icon,
          parentId: item.parentId,
          sort: item.sort,
          children: children.length > 0 ? children : undefined,
        });
      }
    }
    return tree;
  }

  /**
   * 递归获取分类及其所有子分类ID
   */
  private async getAllCategoryIds(categoryId: number): Promise<number[]> {
    const categories = await this.prisma.pmsCategory.findMany({
      select: {
        catId: true,
        parentId: true,
      },
    });

    const childrenByParent = new Map<number, number[]>();
    for (const row of categories) {
      if (row.parentId == null) continue;
      const list = childrenByParent.get(row.parentId) ?? [];
      list.push(row.catId);
      childrenByParent.set(row.parentId, list);
    }

    const result: number[] = [];
    const visited = new Set<number>();
    const queue: number[] = [categoryId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);

      const children = childrenByParent.get(current) ?? [];
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }

    return result;
  }

  /**
   * 统一读取租户ID，避免 undefined 进入缓存键
   */
  private resolveTenantId(): string {
    return TenantContext.getTenantId() || TenantContext.SUPER_TENANT_ID;
  }

  private tryAcquireProductListSlot(): boolean {
    if (ClientProductService.productListInflight >= PRODUCT_LIST_INFLIGHT_LIMIT) {
      return false;
    }
    ClientProductService.productListInflight += 1;
    return true;
  }

  private releaseProductListSlot(): void {
    if (ClientProductService.productListInflight <= 0) {
      ClientProductService.productListInflight = 0;
      return;
    }
    ClientProductService.productListInflight -= 1;
  }

  private async tryBuildOverloadFallbackResult(tenantId: string, query: ClientListProductDto): Promise<Result | null> {
    if (!PRODUCT_LIST_OVERLOAD_FALLBACK_ENABLED) {
      return null;
    }

    try {
      return await this.productQueryFallbackService.buildListFallbackResult({
        query: {
          ...(query as unknown as Record<string, unknown>),
          tenantId,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`过载兜底失败: tenantId=${tenantId}, error=${message}`);
      return null;
    }
  }

  /**
   * 归一化分页参数，避免异常 pageSize 直接冲击数据库
   */
  private normalizeListQuery(query: ClientListProductDto): NormalizedProductListQuery {
    const normalized = normalizeProductListQuery(query as unknown as Record<string, unknown>);
    if (query.name && !normalized.name) {
      this.logger.debug(`商品查询关键词过短，已忽略 name 条件: keyword=${query.name.trim()}`);
    }
    return normalized;
  }

  /**
   * 名称检索策略：
   * - 短词（2-3 字符）走前缀匹配，减小全表扫描成本
   * - 长词维持 contains，保证召回率
   */
  private buildProductNameFilter(name: string): Prisma.StringFilter {
    if (name.length <= 3) {
      return { startsWith: name };
    }
    return { contains: name };
  }

  /**
   * 列表缓存键：按关键筛选项做稳定哈希，避免高基数 key 失控
   */
  private buildListCacheKey(tenantId: string, query: NormalizedProductListQuery): string {
    return buildProductListCacheKey(tenantId, query);
  }

  /**
   * 详情缓存键：按商品 + 租户 + 活动上下文隔离，避免跨租户脏读
   */
  private buildDetailCacheKey(productId: string, tenantId: string, activityContextKey: string | null): string {
    const activityDigest = activityContextKey
      ? crypto.createHash('md5').update(activityContextKey).digest('hex')
      : 'none';
    return `client:product:detail:${productId}:${tenantId}:${activityDigest}`;
  }

  private buildCategoryListCacheKey(parentId?: number): string {
    return `client:product:category:list:${parentId ?? 'root'}`;
  }

  private async writeTenantListSnapshotCache(tenantId: string, payload: ProductListCachePayload): Promise<void> {
    const snapshotKey = buildProductListTenantSnapshotCacheKey(tenantId);
    try {
      await this.cacheManager.set(snapshotKey, payload, PRODUCT_STALE_CACHE_TTL_SECONDS * 1000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入租户商品列表快照失败: key=${snapshotKey}, error=${message}`);
    }
  }

  /**
   * 统一缓存读取入口：带互斥锁，Redis 异常时降级为直查数据库
   */
  private async getOrLoadWithCache<T>(
    cacheKey: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    l1TtlMs: number = 0,
  ): Promise<T> {
    const now = Date.now();
    const l1Cached = this.readL1Cache<T>(cacheKey, now);
    if (l1Cached !== null) {
      return l1Cached;
    }

    const staleCacheKey = `${cacheKey}:stale`;
    const staleTtlMs = PRODUCT_STALE_CACHE_TTL_SECONDS * 1000;

    try {
      const cached = await this.cacheManager.getOrSetWithLock<T>(cacheKey, {
        fetcher: loader,
        ttl: ttlSeconds,
        cacheNull: false,
      });
      if (cached !== null) {
        await this.writeStaleCache(staleCacheKey, cached, staleTtlMs);
        this.writeL1Cache(cacheKey, cached, l1TtlMs, now);
        return cached;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`缓存读写失败，降级直查: key=${cacheKey}, error=${message}`);
    }

    try {
      const data = await loader();
      await this.writeStaleCache(staleCacheKey, data, staleTtlMs);
      this.writeL1Cache(cacheKey, data, l1TtlMs, now);
      return data;
    } catch (error) {
      const stale = await this.readStaleCache<T>(staleCacheKey);
      if (stale !== null) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`商品查询主链路失败，返回陈旧缓存: key=${cacheKey}, error=${message}`);
        this.writeL1Cache(cacheKey, stale, l1TtlMs, now);
        return stale;
      }
      throw error;
    }
  }

  private readL1Cache<T>(cacheKey: string, now: number): T | null {
    const record = this.l1Cache.get(cacheKey);
    if (!record) {
      return null;
    }
    if (record.expiresAt <= now) {
      this.l1Cache.delete(cacheKey);
      return null;
    }
    return record.value as T;
  }

  private writeL1Cache<T>(cacheKey: string, value: T, ttlMs: number, now: number): void {
    if (ttlMs <= 0) return;

    // Map 保留插入顺序，超上限时淘汰最早写入项，避免高基数查询撑爆进程内存。
    if (this.l1Cache.size >= PRODUCT_L1_CACHE_MAX_ENTRIES) {
      const earliestKey = this.l1Cache.keys().next().value;
      if (typeof earliestKey === 'string') {
        this.l1Cache.delete(earliestKey);
      }
    }

    this.l1Cache.set(cacheKey, {
      value,
      expiresAt: now + ttlMs,
    });
  }

  private async writeStaleCache<T>(staleCacheKey: string, data: T, ttlMs: number): Promise<void> {
    try {
      await this.cacheManager.set(staleCacheKey, data, ttlMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入陈旧缓存失败: key=${staleCacheKey}, error=${message}`);
    }
  }

  private async readStaleCache<T>(staleCacheKey: string): Promise<T | null> {
    try {
      return await this.cacheManager.get<T>(staleCacheKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`读取陈旧缓存失败: key=${staleCacheKey}, error=${message}`);
      return null;
    }
  }

  /**
   * 构建商品详情缓存载荷（含不存在/下架的状态）
   */
  private async loadProductDetailPayload(
    productId: string,
    tenantId: string,
    activityContextKey: string | null,
  ): Promise<ProductDetailCachePayload> {
    const isSuper = tenantId === TenantContext.SUPER_TENANT_ID;
    const product = await this.productRepo.findOneWithDetails(productId, tenantId, isSuper);

    if (!product) {
      return { state: 'NOT_FOUND' };
    }
    if (product.publishStatus !== 'ON_SHELF') {
      return { state: 'OFF_SHELF' };
    }

    // 获取门店商品信息 (如果有)
    const tenantProducts = (product as unknown as { tenantProducts?: TenantProductWithSkus[] }).tenantProducts;
    const tenantProduct = tenantProducts?.[0];
    const tenantSkuMap = new Map<string, { id: string; price: Prisma.Decimal; stock: number }>();
    if (tenantProduct?.skus) {
      for (const sku of tenantProduct.skus) {
        tenantSkuMap.set(sku.globalSkuId, sku);
      }
    }

    let mainActivity: ResolvedActivityContextVo | null = null;
    if (activityContextKey) {
      try {
        mainActivity = await this.resolutionService.validateAndLock({
          tenantId,
          memberId: '',
          productId,
          skuId: product.globalSkus?.[0]?.skuId || '',
          activityContextKey,
          scene: 'PRODUCT_DETAIL',
        });
      } catch {
        this.logger.warn('活动上下文校验失败，已降级为默认商品详情');
      }
    } else {
      mainActivity = await this.resolutionService.resolveMainActivity({
        tenantId,
        productId,
        memberId: '',
      });
    }

    return {
      state: 'OK',
      data: {
        productId: product.productId,
        name: product.name,
        subTitle: product.subTitle,
        mainImages: product.mainImages || [],
        coverImage: product.mainImages?.[0] || null,
        detailHtml: product.detailHtml,
        type: product.type,
        categoryId: product.categoryId,
        categoryName: product.category?.name,
        isFreeShip: product.isFreeShip,
        serviceDuration: product.serviceDuration,
        serviceRadius: product.serviceRadius,
        needBooking: product.needBooking,
        ...this.buildProductDisplayProjection(product, tenantProduct),
        // 优先使用门店价格
        price: Number(
          tenantSkuMap.get(product.globalSkus?.[0]?.skuId)?.price ?? product.globalSkus?.[0]?.guidePrice ?? 0,
        ),
        skus: product.globalSkus.map((sku) => {
          const tenantSku = tenantSkuMap.get(sku.skuId);
          const rawSpec = sku.specValues;
          const specValues: Record<string, string> =
            rawSpec && typeof rawSpec === 'object' && !Array.isArray(rawSpec)
              ? Object.fromEntries(Object.entries(rawSpec).map(([k, v]) => [k, v != null ? String(v) : '']))
              : {};
          return {
            skuId: tenantSku?.id || sku.skuId,
            specValues,
            skuImage: sku.skuImage,
            // 优先使用门店价格
            price: Number(tenantSku?.price ?? sku.guidePrice ?? 0),
            stock: tenantSku?.stock ?? 0,
          };
        }),
        mainActivity: mainActivity
          ? (() => {
              const rawRules = { ...(mainActivity.rules ?? {}) } as Record<string, unknown>;
              if (rawRules.skuPrices && typeof rawRules.skuPrices === 'object') {
                rawRules.skuPrices = remapSkuPricesForClient(
                  rawRules.skuPrices as Record<string, unknown>,
                  tenantSkuMap,
                );
              }
              return {
                activityContextKey: mainActivity.activityContextKey,
                activityType: mainActivity.activityType,
                configId: mainActivity.configId,
                activityName: mainActivity.activityName,
                activityPrice: Number(mainActivity.activityPrice),
                originalPrice:
                  Number(mainActivity.originalPrice) ||
                  Number(
                    tenantSkuMap.get(product.globalSkus?.[0]?.skuId)?.price ?? product.globalSkus?.[0]?.guidePrice ?? 0,
                  ),
                commissionMode: mainActivity.commissionMode,
                status: mainActivity.status,
                startTime: mainActivity.startTime,
                endTime: mainActivity.endTime,
                remainingStock: mainActivity.remainingStock,
                rules: rawRules,
                displayData: mainActivity.displayData ?? null,
              };
            })()
          : null,
      },
    };
  }
}
