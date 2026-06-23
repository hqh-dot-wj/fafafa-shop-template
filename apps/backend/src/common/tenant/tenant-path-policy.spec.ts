import { matchesConfiguredExemptPrefix, normalizeStrippedPath, resolveTenantPathPolicy } from './tenant-path-policy';

describe('normalizeStrippedPath', () => {
  it('strips global prefix', () => {
    expect(normalizeStrippedPath('/api/client/foo', undefined, '/api')).toBe('/client/foo');
    expect(normalizeStrippedPath('/api/health', undefined, '/api')).toBe('/health');
  });

  it('handles query string', () => {
    expect(normalizeStrippedPath('/api/client/x?a=1', undefined, '/api')).toBe('/client/x');
  });
});

describe('resolveTenantPathPolicy', () => {
  const emptyWhitelist: undefined = undefined;

  it('classifies client prefix as client_default_super', () => {
    expect(resolveTenantPathPolicy('/client/product/list', 'GET', emptyWhitelist)).toBe('client_default_super');
  });

  it('classifies lbs region as client_default_super', () => {
    expect(resolveTenantPathPolicy('/lbs/region/list', 'GET', emptyWhitelist)).toBe('client_default_super');
    expect(resolveTenantPathPolicy('/lbs/region/name/110000', 'GET', emptyWhitelist)).toBe('client_default_super');
  });

  it('classifies commission preview POST only as client_default_super', () => {
    expect(resolveTenantPathPolicy('/store/distribution/commission/preview', 'POST', emptyWhitelist)).toBe(
      'client_default_super',
    );
    expect(resolveTenantPathPolicy('/store/distribution/commission/preview', 'GET', emptyWhitelist)).toBe(
      'strict_admin',
    );
  });

  it('classifies admin store paths as strict', () => {
    expect(resolveTenantPathPolicy('/store/distribution/config', 'GET', emptyWhitelist)).toBe('strict_admin');
  });

  it('classifies health and auth as exempt', () => {
    expect(resolveTenantPathPolicy('/health', 'GET', emptyWhitelist)).toBe('exempt');
    expect(resolveTenantPathPolicy('/health/readiness', 'GET', emptyWhitelist)).toBe('exempt');
    expect(resolveTenantPathPolicy('/auth/login', 'POST', emptyWhitelist)).toBe('exempt');
    expect(resolveTenantPathPolicy('/auth/publicKey', 'GET', emptyWhitelist)).toBe('exempt');
  });

  it('classifies legacy main public paths as exempt', () => {
    expect(resolveTenantPathPolicy('/login', 'POST', emptyWhitelist)).toBe('exempt');
    expect(resolveTenantPathPolicy('/captchaImage', 'GET', emptyWhitelist)).toBe('exempt');
  });

  it('respects perm whitelist', () => {
    const whitelist = [{ path: '/getInfo', method: 'GET' }];
    expect(resolveTenantPathPolicy('/getInfo', 'GET', whitelist)).toBe('exempt');
    expect(resolveTenantPathPolicy('/getInfo', 'POST', whitelist)).toBe('strict_admin');
  });

  it('respects TENANT_EXEMPT_PATH_PREFIXES (config) before strict', () => {
    const prefixes = ['/integrations/wechat'];
    expect(resolveTenantPathPolicy('/integrations/wechat/notify', 'POST', emptyWhitelist, prefixes)).toBe('exempt');
    expect(resolveTenantPathPolicy('/system/user/list', 'GET', emptyWhitelist, prefixes)).toBe('strict_admin');
  });
});

describe('matchesConfiguredExemptPrefix', () => {
  it('matches exact and children', () => {
    expect(matchesConfiguredExemptPrefix('/foo/bar', ['/foo'])).toBe(true);
    expect(matchesConfiguredExemptPrefix('/foo', ['/foo'])).toBe(true);
    expect(matchesConfiguredExemptPrefix('/foobar', ['/foo'])).toBe(false);
    expect(matchesConfiguredExemptPrefix('/foo/bar', ['foo'])).toBe(true);
  });
});
