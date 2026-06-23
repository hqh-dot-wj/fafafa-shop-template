import { TenantContext } from './tenant.context';
import { TenantHelper, getTenantScopedPrismaDelegateKeys } from './tenant.helper';
import { AppConfigService } from 'src/config/app-config.service';

describe('TenantHelper.readWhereForDelegate', () => {
  const config = {
    tenant: { enabled: true },
  } as unknown as AppConfigService;

  it('getTenantScopedPrismaDelegateKeys includes sysUser and excludes genTable', () => {
    const keys = getTenantScopedPrismaDelegateKeys();
    expect(keys.has('sysUser')).toBe(true);
    expect(keys.has('omsOrder')).toBe(true);
    expect(keys.has('genTable')).toBe(false);
    expect(keys.has('pmsProduct')).toBe(false);
  });

  it('merges tenantId for tenant-scoped delegate when filter applies', () => {
    const helper = new TenantHelper(config);
    TenantContext.run({ tenantId: '100001' }, () => {
      const w = helper.readWhereForDelegate('sysUser', { status: '0' });
      expect(w).toMatchObject({ status: '0', tenantId: '100001' });
    });
  });

  it('does not merge for non-tenant-scoped delegate', () => {
    const helper = new TenantHelper(config);
    TenantContext.run({ tenantId: '100001' }, () => {
      const w = helper.readWhereForDelegate('pmsProduct', { publishStatus: 'ON_SHELF' });
      expect(w).toEqual({ publishStatus: 'ON_SHELF' });
    });
  });
});
