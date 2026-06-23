import {
  HUNAN_FULL_PRODUCTS,
  HUNAN_FULL_PRODUCT_THEMES,
} from '../../prisma/seeds/hunan-full/catalog-products';
import {
  HUNAN_FULL_DIST_APPLICATIONS,
  HUNAN_FULL_MEMBERS,
  HUNAN_FULL_REFERRAL_CODES,
} from '../../prisma/seeds/hunan-full/catalog-members';
import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../../prisma/seeds/hunan-full/catalog-marketing';
import { HUNAN_FULL_ORDER_SCENARIOS } from '../../prisma/seeds/hunan-full/catalog-orders';
import { HUNAN_FULL_OPERATORS } from '../../prisma/seeds/hunan-full/catalog-operators';

describe('hunan full seed blueprint', () => {
  it('covers three business themes with complete sku pricing fields', () => {
    expect(HUNAN_FULL_PRODUCT_THEMES).toEqual(['retail', 'instant', 'service']);
    expect(HUNAN_FULL_PRODUCTS).toHaveLength(24);

    const productsByTheme = HUNAN_FULL_PRODUCTS.reduce<Record<string, number>>((acc, product) => {
      acc[product.theme] = (acc[product.theme] ?? 0) + 1;
      return acc;
    }, {});

    expect(productsByTheme).toEqual({
      retail: 8,
      instant: 8,
      service: 8,
    });

    const totalSkuCount = HUNAN_FULL_PRODUCTS.flatMap(product => product.skus).length;

    expect(totalSkuCount).toBeGreaterThanOrEqual(55);
    expect(totalSkuCount).toBeLessThanOrEqual(70);

    for (const product of HUNAN_FULL_PRODUCTS) {
      expect(product.categoryId).toBeTruthy();
      expect(product.attrValues.length).toBeGreaterThan(0);
      expect(product.skus.length).toBeGreaterThan(0);

      for (const sku of product.skus) {
        expect(sku.skuId).toContain(product.productId);
        expect(sku.guidePrice).toBeGreaterThan(0);
        expect(sku.costPrice).toBeGreaterThanOrEqual(0);
        expect(sku.tenantPrice).toBeGreaterThan(0);
      }
    }
  });

  it('covers operators, members, distributor workflows and referral codes', () => {
    expect(HUNAN_FULL_OPERATORS).toHaveLength(5);
    expect(HUNAN_FULL_MEMBERS).toHaveLength(43);
    expect(HUNAN_FULL_REFERRAL_CODES).toHaveLength(4);
    expect(HUNAN_FULL_DIST_APPLICATIONS.length).toBeGreaterThanOrEqual(9);

    const frozenOrDisabledMembers = HUNAN_FULL_MEMBERS.filter(member =>
      ['FROZEN', 'DISABLED'].includes(member.walletStatus),
    );
    expect(frozenOrDisabledMembers).toHaveLength(4);

    const distributorLevels = new Set(
      HUNAN_FULL_MEMBERS.filter(member => member.levelId > 0).map(member => member.levelId),
    );
    expect([...distributorLevels].sort()).toEqual([1, 2]);
  });

  it('covers marketing assets, activities and scene placement', () => {
    expect(HUNAN_FULL_MARKETING_BLUEPRINT.couponTemplates).toHaveLength(10);
    expect(HUNAN_FULL_MARKETING_BLUEPRINT.activities).toHaveLength(8);
    expect(HUNAN_FULL_MARKETING_BLUEPRINT.storePlayConfigs.length).toBeGreaterThanOrEqual(8);
    expect(HUNAN_FULL_MARKETING_BLUEPRINT.scenes).toHaveLength(4);
    expect(HUNAN_FULL_MARKETING_BLUEPRINT.sceneModules).toHaveLength(8);

    const activityTypes = new Set(HUNAN_FULL_MARKETING_BLUEPRINT.activities.map(activity => activity.type));
    expect(activityTypes).toEqual(
      new Set([
        'NEWCOMER_EXCLUSIVE',
        'FIRST_ORDER',
        'FULL_REDUCTION',
        'MEMBER_DAY',
        'GROUP_BUY',
        'FLASH_SALE',
        'COURSE_GROUP',
        'MEMBER_UPGRADE',
      ]),
    );
  });

  it('covers order simulation and commission scenarios', () => {
    expect(HUNAN_FULL_ORDER_SCENARIOS.length).toBeGreaterThanOrEqual(14);

    const scenarioKinds = new Set(HUNAN_FULL_ORDER_SCENARIOS.map(order => order.scenarioType));
    const requiredScenarioKinds = [
      'product-normal',
      'product-flash-sale',
      'product-full-reduction',
      'product-coupon',
      'product-points',
      'product-exchange',
      'service-normal',
      'service-course-group',
      'member-upgrade',
      'refund-full',
      'refund-partial',
    ];
    for (const kind of requiredScenarioKinds) {
      expect(scenarioKinds).toContain(kind);
    }

    const commissionModes = new Set(
      HUNAN_FULL_ORDER_SCENARIOS.flatMap(order => order.commissions.map(commission => commission.status)),
    );
    expect(commissionModes).toEqual(new Set(['FROZEN', 'SETTLED', 'CANCELLED']));

    const commissionKeys = HUNAN_FULL_ORDER_SCENARIOS.flatMap(order =>
      order.commissions.map(commission => `${order.orderId}:${commission.beneficiaryId}:${commission.level}`),
    );
    expect(new Set(commissionKeys).size).toBe(commissionKeys.length);
  });
});
