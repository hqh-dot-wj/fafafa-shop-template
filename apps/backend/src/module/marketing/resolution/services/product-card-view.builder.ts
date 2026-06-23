import { Injectable } from '@nestjs/common';
import {
  buildProductDisplayProjection,
  type ProductDisplayTagProjection,
  type ProductPurchaseStatusProjection,
  type ProductServiceSummaryProjection,
} from 'src/module/pms/product-display-projection.util';
import { ResolvedProduct } from './primary-offer-resolver.service';

export interface ProductCardView {
  productId: string;
  productName?: string;
  productImg?: string;
  productImages?: string[];
  primaryOffer?: Record<string, unknown>;
  explain?: Record<string, unknown>[];
  courseGroupJoinExplain?: Record<string, unknown>;
  displayTags?: ProductDisplayTagProjection[];
  purchaseStatus?: ProductPurchaseStatusProjection;
  serviceSummary?: ProductServiceSummaryProjection;
  [key: string]: unknown;
}

export interface ModuleView {
  moduleCode: string;
  moduleName: string;
  moduleType: string;
  title?: string;
  subTitle?: string;
  uiConfig?: Record<string, unknown>;
  products: ProductCardView[];
}

@Injectable()
export class ProductCardViewBuilder {
  buildModuleView(
    module: {
      moduleCode: string;
      moduleName: string;
      moduleType: string;
      title?: string | null;
      subTitle?: string | null;
      uiConfig?: unknown;
    },
    products: ResolvedProduct[],
  ): ModuleView {
    const uiConfig =
      module.uiConfig && typeof module.uiConfig === 'object' && !Array.isArray(module.uiConfig)
        ? (module.uiConfig as Record<string, unknown>)
        : undefined;

    return {
      moduleCode: module.moduleCode,
      moduleName: module.moduleName,
      moduleType: module.moduleType,
      title: typeof module.title === 'string' && module.title.trim() ? module.title.trim() : undefined,
      subTitle: typeof module.subTitle === 'string' && module.subTitle.trim() ? module.subTitle.trim() : undefined,
      uiConfig,
      products: products.map((p) => {
        const displayProjection = buildProductDisplayProjection({
          productType: p.productType,
          isFreeShip: p.isFreeShip,
          needBooking: p.needBooking,
          serviceDuration: p.serviceDuration,
          serviceRadius: p.serviceRadius,
          tenantProductCreateTime: p.tenantProductCreateTime,
          tenantProductIsHot: p.tenantProductIsHot,
        });

        return {
          productId: p.productId,
          productName: typeof p.productName === 'string' ? p.productName : undefined,
          productImg: typeof p.productImg === 'string' ? p.productImg : undefined,
          productImages: Array.isArray(p.productImages)
            ? p.productImages.filter(item => typeof item === 'string')
            : undefined,
          primaryOffer: p.primaryOffer,
          explain: this.readRecordList(p.explain),
          courseGroupJoinExplain: this.readRecord(p.courseGroupJoinExplain),
          ...displayProjection,
        };
      }),
    };
  }

  private readRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  }

  private readRecordList(value: unknown): Record<string, unknown>[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const records = value.filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    );
    return records.length > 0 ? records : undefined;
  }
}
