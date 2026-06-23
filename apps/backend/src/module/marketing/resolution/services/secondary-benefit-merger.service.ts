import { Injectable } from '@nestjs/common';
import { UserMarketingContext } from '../dto/user-marketing-context.dto';
import { ResolvedProduct } from './primary-offer-resolver.service';

@Injectable()
export class SecondaryBenefitMergerService {
  /**
   * 合并次级权益（优惠券、积分等）到已裁决商品。
   * 当前约定 secondaryOffers 由主裁决服务产出，这里统一写入 primaryOffer.secondaryBenefits。
   */
  merge(products: ResolvedProduct[], _ctx: UserMarketingContext): ResolvedProduct[] {
    return products.map((product) => {
      if (!product.primaryOffer) {
        return product;
      }
      const secondaryOffers = Array.isArray(product.secondaryOffers) ? product.secondaryOffers : [];
      if (secondaryOffers.length === 0) {
        return product;
      }
      return {
        ...product,
        primaryOffer: {
          ...product.primaryOffer,
          secondaryBenefits: secondaryOffers,
        },
      };
    });
  }
}
