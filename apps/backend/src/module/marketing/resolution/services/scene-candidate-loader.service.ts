import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProductType, PublishStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';

export interface ProductCandidate {
  productId: string;
  productName?: string;
  productImg?: string;
  productImages?: string[];
  productType?: string;
  isFreeShip?: boolean;
  needBooking?: boolean;
  serviceDuration?: number | null;
  serviceRadius?: number | null;
  productCreateTime?: Date;
  tenantProductCreateTime?: Date;
  tenantProductIsHot?: boolean;
  activityCandidates?: Array<{
    configId: string;
    templateCode: string;
    displayPriority: number;
    status: string;
    rules: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

@Injectable()
export class SceneCandidateLoaderService {
  private readonly logger = new Logger(SceneCandidateLoaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 根据 SOURCE 策略加载商品候选。
   * 支持策略字段：
   * - 顶层 productIds/serviceIds/categoryIds/productTypes
   * - clauses: field + operator + value（EQ/IN/NEQ/NIN/CONTAINS）
   */
  async load(
    module: { sourcePolicyCode: string; limitSize?: number },
    ctx: UserMarketingContext,
  ): Promise<ProductCandidate[]> {
    const policy = await this.prisma.mktPolicy.findUnique({
      where: {
        tenantId_policyCode: {
          tenantId: ctx.tenantId,
          policyCode: module.sourcePolicyCode,
        },
      },
      select: {
        policyCode: true,
        policyType: true,
        status: true,
        config: true,
      },
    });
    if (!policy || policy.policyType !== 'SOURCE') {
      this.logger.warn(`未找到 SOURCE 策略或类型不匹配: ${module.sourcePolicyCode}`);
      return [];
    }
    if (policy.status !== 'ACTIVE') {
      this.logger.warn(`SOURCE 策略未启用: ${module.sourcePolicyCode}`);
      return [];
    }

    const limitSize = this.clampPositiveInt(module.limitSize, 20, 200);
    const productWhere = this.buildProductWhere(policy.config);
    const products = await this.prisma.pmsProduct.findMany({
      where: productWhere,
      orderBy: [{ createTime: 'desc' }, { productId: 'asc' }],
      take: limitSize,
      select: {
        productId: true,
        name: true,
        mainImages: true,
        type: true,
        isFreeShip: true,
        needBooking: true,
        serviceDuration: true,
        serviceRadius: true,
        createTime: true,
      },
    });
    if (products.length === 0) {
      return [];
    }

    const sourceIds = products.map((item) => item.productId);
    const tenantProducts = await this.prisma.pmsTenantProduct.findMany({
      where: {
        tenantId: ctx.tenantId,
        productId: { in: sourceIds },
        status: PublishStatus.ON_SHELF,
      },
      select: {
        productId: true,
        isHot: true,
        createTime: true,
      },
    });
    const configs = await this.prisma.storePlayConfig.findMany({
      where: {
        tenantId: ctx.tenantId,
        serviceId: { in: sourceIds },
        status: 'ON_SHELF',
        delFlag: 'NORMAL',
      },
      select: {
        id: true,
        serviceId: true,
        templateCode: true,
        displayPriority: true,
        status: true,
        rules: true,
      },
      orderBy: [{ displayPriority: 'desc' }, { createTime: 'desc' }],
    });

    const tenantProductMap = new Map(tenantProducts.map((item) => [item.productId, item]));
    const configMap = new Map<string, ProductCandidate['activityCandidates']>();
    for (const config of configs) {
      const existing = configMap.get(config.serviceId) ?? [];
      existing.push({
        configId: config.id,
        templateCode: config.templateCode,
        displayPriority: config.displayPriority ?? 0,
        status: String(config.status),
        rules: this.toRecord(config.rules),
      });
      configMap.set(config.serviceId, existing);
    }

    return products
      .map((product) => ({
        productImages: Array.isArray(product.mainImages)
          ? product.mainImages.filter((item) => typeof item === 'string')
          : [],
        productId: product.productId,
        productName: product.name,
        productImg: product.mainImages[0] ?? '',
        productType: product.type,
        isFreeShip: product.isFreeShip,
        needBooking: product.needBooking,
        serviceDuration: product.serviceDuration,
        serviceRadius: product.serviceRadius,
        productCreateTime: product.createTime,
        tenantProductCreateTime: tenantProductMap.get(product.productId)?.createTime,
        tenantProductIsHot: tenantProductMap.get(product.productId)?.isHot,
        activityCandidates: configMap.get(product.productId) ?? [],
      }))
      .filter((item) => item.activityCandidates.length > 0);
  }

  private buildProductWhere(config: unknown): Prisma.PmsProductWhereInput {
    const configRecord = this.toRecord(config);
    const andConditions: Prisma.PmsProductWhereInput[] = [{ publishStatus: 'ON_SHELF' }, { delFlag: 'NORMAL' }];

    const topLevelProductIds = this.toStringList(configRecord.productIds ?? configRecord.serviceIds);
    if (topLevelProductIds.length > 0) {
      andConditions.push({ productId: { in: topLevelProductIds } });
    }
    const topLevelCategoryIds = this.toNumberList(configRecord.categoryIds ?? configRecord.catIds);
    if (topLevelCategoryIds.length > 0) {
      andConditions.push({ categoryId: { in: topLevelCategoryIds } });
    }
    const topLevelTypes = this.toProductTypes(configRecord.productTypes ?? configRecord.types);
    if (topLevelTypes.length > 0) {
      andConditions.push({ type: { in: topLevelTypes } });
    }

    const clauses = Array.isArray(configRecord.clauses) ? configRecord.clauses : [];
    for (const clause of clauses) {
      const clauseRecord = this.toRecord(clause);
      const field = String(clauseRecord.field ?? '')
        .trim()
        .toLowerCase();
      const operator = String(clauseRecord.operator ?? '')
        .trim()
        .toUpperCase();
      const value = clauseRecord.value;

      if (field === 'productid' || field === 'serviceid') {
        const productIds = this.toStringList(value);
        const condition = this.buildStringFilter('productId', productIds, operator);
        if (condition) andConditions.push(condition);
      } else if (field === 'categoryid' || field === 'catid') {
        const categoryIds = this.toNumberList(value);
        const condition = this.buildNumberFilter('categoryId', categoryIds, operator);
        if (condition) andConditions.push(condition);
      } else if (field === 'type' || field === 'producttype') {
        const types = this.toProductTypes(value);
        const condition = this.buildProductTypeFilter(types, operator);
        if (condition) andConditions.push(condition);
      } else if (field === 'publishstatus') {
        const statuses = this.toStringList(value).map((item) => item.toUpperCase());
        const condition = this.buildStringFilter('publishStatus', statuses, operator);
        if (condition) andConditions.push(condition);
      } else if (field === 'name') {
        const keyword = this.toStringList(value)[0];
        if (keyword && operator === 'CONTAINS') {
          andConditions.push({ name: { contains: keyword } });
        } else {
          const condition = this.buildStringFilter('name', keyword ? [keyword] : [], operator);
          if (condition) andConditions.push(condition);
        }
      }
    }

    return andConditions.length > 1 ? { AND: andConditions } : andConditions[0];
  }

  private buildStringFilter(
    key: 'productId' | 'type' | 'publishStatus' | 'name',
    values: string[],
    operator: string,
  ): Prisma.PmsProductWhereInput | null {
    if (values.length === 0) return null;
    if (operator === 'EQ') return { [key]: values[0] } as Prisma.PmsProductWhereInput;
    if (operator === 'IN') return { [key]: { in: values } } as Prisma.PmsProductWhereInput;
    if (operator === 'NEQ') return { [key]: { not: values[0] } } as Prisma.PmsProductWhereInput;
    if (operator === 'NIN') return { [key]: { notIn: values } } as Prisma.PmsProductWhereInput;
    return null;
  }

  private buildProductTypeFilter(values: ProductType[], operator: string): Prisma.PmsProductWhereInput | null {
    if (values.length === 0) return null;
    if (operator === 'EQ') return { type: values[0] };
    if (operator === 'IN') return { type: { in: values } };
    if (operator === 'NEQ') return { type: { not: values[0] } };
    if (operator === 'NIN') return { type: { notIn: values } };
    return null;
  }

  private buildNumberFilter(key: 'categoryId', values: number[], operator: string): Prisma.PmsProductWhereInput | null {
    if (values.length === 0) return null;
    if (operator === 'EQ') return { [key]: values[0] } as Prisma.PmsProductWhereInput;
    if (operator === 'IN') return { [key]: { in: values } } as Prisma.PmsProductWhereInput;
    if (operator === 'NEQ') return { [key]: { not: values[0] } } as Prisma.PmsProductWhereInput;
    if (operator === 'NIN') return { [key]: { notIn: values } } as Prisma.PmsProductWhereInput;
    return null;
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

  private toProductTypes(value: unknown): ProductType[] {
    const values = this.toStringList(value).map((item) => item.toUpperCase());
    const validSet = new Set<string>(Object.values(ProductType));
    return values.filter((item): item is ProductType => validSet.has(item));
  }

  private toNumberList(value: unknown): number[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === 'number' && Number.isFinite(item)) return item;
          if (typeof item === 'string') {
            const parsed = Number(item);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        })
        .filter((item): item is number => item !== null);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return [value];
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? [parsed] : [];
    }
    return [];
  }

  private clampPositiveInt(value: number | undefined, fallback: number, max: number): number {
    const safe = Number.isFinite(value) ? Number(value) : fallback;
    return Math.min(max, Math.max(1, Math.trunc(safe)));
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
