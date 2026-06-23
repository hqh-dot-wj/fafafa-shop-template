import {
  OBSOLETE_DISTRIBUTION_PRODUCT_MENU_IDS,
  RETIRED_SYSTEM_MESSAGE_MENU_IDS,
  stripRetiredMenuIdsFromPackageCsv,
} from '../../prisma/seeds/utils/retired-menu-ids';
import {
  BOOTSTRAP_FULL_PACKAGE_MENU_IDS,
  DEMO_TENANT_FULL_MENU_IDS,
} from '../../prisma/seeds/utils/platform-full-package-menu-ids';

function parseCsvIds(menuIds: string): number[] {
  return menuIds.split(',').map((part) => Number(part.trim()));
}

describe('retired-menu-ids package CSV', () => {
  const retired = [...RETIRED_SYSTEM_MESSAGE_MENU_IDS, ...OBSOLETE_DISTRIBUTION_PRODUCT_MENU_IDS];

  it('stripRetiredMenuIdsFromPackageCsv removes obsolete distribution and message menu ids', () => {
    const csv = stripRetiredMenuIdsFromPackageCsv('1,122,228,1194,230');
    expect(parseCsvIds(csv)).toEqual([1, 230]);
  });

  it('demo tenant and bootstrap package strings do not reference retired menu ids', () => {
    for (const csv of [DEMO_TENANT_FULL_MENU_IDS, BOOTSTRAP_FULL_PACKAGE_MENU_IDS]) {
      const ids = parseCsvIds(csv);
      for (const menuId of retired) {
        expect(ids).not.toContain(menuId);
      }
    }
  });
});
