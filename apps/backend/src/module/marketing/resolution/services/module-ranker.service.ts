import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';
import { ResolvedProduct } from './primary-offer-resolver.service';

type SortRule = {
  field: string;
  order: 'asc' | 'desc';
  nulls: 'first' | 'last';
};

@Injectable()
export class ModuleRankerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 按 SORT 策略对商品排序。
   * 支持多字段排序，未命中策略时使用默认排序：
   * - displayPrice 升序
   * - productId 升序
   */
  async rank(
    products: ResolvedProduct[],
    sortPolicyCode: string | null | undefined,
    ctx: UserMarketingContext,
  ): Promise<ResolvedProduct[]> {
    const sortRules = await this.loadSortRules(ctx.tenantId, sortPolicyCode);
    if (sortRules.length === 0) {
      return [...products].sort((a, b) => {
        const aPrice = this.getNumericField(a, 'displayPrice');
        const bPrice = this.getNumericField(b, 'displayPrice');
        if (aPrice !== bPrice) return aPrice - bPrice;
        return String(a.productId).localeCompare(String(b.productId));
      });
    }

    return [...products].sort((a, b) => {
      for (const rule of sortRules) {
        const compared = this.compareByRule(a, b, rule);
        if (compared !== 0) return compared;
      }
      return String(a.productId).localeCompare(String(b.productId));
    });
  }

  private async loadSortRules(tenantId: string, sortPolicyCode: string | null | undefined): Promise<SortRule[]> {
    const code = sortPolicyCode?.trim();
    if (!code) return [];
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
    if (!policy || policy.policyType !== 'SORT' || policy.status !== 'ACTIVE') {
      return [];
    }

    const config = this.toRecord(policy.config);
    const rawRules = Array.isArray(config.sortRules) ? config.sortRules : [];
    const rules: SortRule[] = [];
    for (const rawRule of rawRules) {
      const record = this.toRecord(rawRule);
      const field = String(record.field ?? '').trim();
      if (!field) continue;
      const order = String(record.order ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
      const nulls = String(record.nulls ?? 'last').toLowerCase() === 'first' ? 'first' : 'last';
      rules.push({ field, order, nulls });
    }
    return rules;
  }

  private compareByRule(a: ResolvedProduct, b: ResolvedProduct, rule: SortRule): number {
    const aValue = this.readFieldValue(a, rule.field);
    const bValue = this.readFieldValue(b, rule.field);
    const aNull = aValue === null;
    const bNull = bValue === null;

    if (aNull && bNull) return 0;
    if (aNull || bNull) {
      if (aNull && !bNull) return rule.nulls === 'first' ? -1 : 1;
      if (!aNull && bNull) return rule.nulls === 'first' ? 1 : -1;
    }

    let compared = 0;
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      compared = aValue - bValue;
    } else {
      compared = String(aValue).localeCompare(String(bValue));
    }
    return rule.order === 'desc' ? -compared : compared;
  }

  private readFieldValue(product: ResolvedProduct, field: string): string | number | null {
    const normalizedField = field.trim().toLowerCase();
    if (['displayprice', 'price'].includes(normalizedField)) {
      return this.getNumericField(product, 'displayPrice');
    }
    if (['originalprice', 'marketprice'].includes(normalizedField)) {
      return this.getNumericField(product, 'originalPrice');
    }
    if (['remainingstock', 'remainingslots'].includes(normalizedField)) {
      return this.getNumericField(product, 'remainingSlots');
    }
    if (['activitytype'].includes(normalizedField)) {
      return this.getStringField(product, 'activityType');
    }
    if (['activityname', 'taglabel'].includes(normalizedField)) {
      return this.getStringField(product, 'activityName');
    }
    if (['productname', 'name'].includes(normalizedField)) {
      return typeof product.productName === 'string' ? product.productName : null;
    }
    if (normalizedField === 'productid') {
      return String(product.productId);
    }

    const fromPrimary = this.toRecord(product.primaryOffer)[field];
    if (typeof fromPrimary === 'number' || typeof fromPrimary === 'string') {
      return fromPrimary;
    }
    const fromProduct = product[field];
    if (typeof fromProduct === 'number' || typeof fromProduct === 'string') {
      return fromProduct;
    }
    return null;
  }

  private getNumericField(product: ResolvedProduct, key: string): number {
    const value = this.toRecord(product.primaryOffer)[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
    }
    return Number.MAX_SAFE_INTEGER;
  }

  private getStringField(product: ResolvedProduct, key: string): string | null {
    const value = this.toRecord(product.primaryOffer)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
