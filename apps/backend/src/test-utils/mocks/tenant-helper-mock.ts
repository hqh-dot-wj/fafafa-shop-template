import { TenantHelper } from 'src/common/tenant/tenant.helper';

/**
 * 单测用 TenantHelper：readWhereForDelegate 原样返回 where，不合并租户（由用例自行构造 Prisma mock）。
 */
export function getTenantHelperTestProvider(): {
  provide: typeof TenantHelper;
  useValue: {
    readWhereForDelegate: (delegate: string, where?: object) => Record<string, unknown>;
    setTenantId: <T extends object>(data: T) => T & { tenantId: string };
    getTenantId: () => string;
  };
} {
  return {
    provide: TenantHelper,
    useValue: {
      readWhereForDelegate: (_delegate: string, where?: object) => ({ ...(where ?? {}) }),
      setTenantId: <T extends object>(data: T) => ({ ...data, tenantId: '000000' }) as T & { tenantId: string },
      getTenantId: () => '000000',
    },
  };
}
