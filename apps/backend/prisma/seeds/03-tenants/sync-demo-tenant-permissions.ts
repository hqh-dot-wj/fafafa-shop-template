import { DelFlag, PrismaClient, Status } from '@prisma/client';

import { bindTenantPackageMenusForRole } from '../../../src/module/admin/system/tenant/tenant-package-sync';

export const DEMO_TENANT_IDS = ['100001', '100002', '100003', '100004', '100005', '100006'] as const;
const DEMO_TENANT_ADMIN_ROLE_KEY = 'admin';

/**
 * 为已存在的演示租户管理员角色同步套餐菜单（幂等）。
 * 默认种子管道也会调用，避免仅跑 hunan-full 时 10000x 租户长期无 API 权限。
 */
export async function seedDemoTenantAdminPermissions(prisma: PrismaClient): Promise<void> {
  console.log('[03-Tenants] 演示租户管理员套餐权限同步...');

  let synced = 0;
  for (const tenantId of DEMO_TENANT_IDS) {
    const tenant = await prisma.sysTenant.findFirst({
      where: { tenantId, delFlag: DelFlag.NORMAL, status: Status.NORMAL },
      select: { tenantId: true, packageId: true, companyName: true },
    });
    if (!tenant?.packageId) {
      continue;
    }

    const role = await prisma.sysRole.findFirst({
      where: {
        tenantId,
        roleKey: DEMO_TENANT_ADMIN_ROLE_KEY,
        delFlag: DelFlag.NORMAL,
      },
      orderBy: { roleId: 'asc' },
    });
    if (!role) {
      continue;
    }

    const tenantPackage = await prisma.sysTenantPackage.findFirst({
      where: {
        packageId: tenant.packageId,
        delFlag: DelFlag.NORMAL,
        status: Status.NORMAL,
      },
    });
    if (!tenantPackage?.menuIds) {
      console.warn(`  ⚠ ${tenantId} 套餐 ${tenant.packageId} 无 menuIds，跳过`);
      continue;
    }

    const menuCount = await bindTenantPackageMenusForRole(
      prisma,
      {
        tenantId,
        packageMenuIds: tenantPackage.menuIds,
        roleId: role.roleId,
      },
      { operator: 'seed', onWarn: (message) => console.warn(`  ⚠ ${message}`) },
    );

    console.log(`  ✓ ${tenant.companyName ?? tenantId} 角色菜单 ${menuCount} 项`);
    synced += 1;
  }

  if (synced === 0) {
    console.log('  ℹ 未发现演示租户或管理员角色，跳过（可带 --with-legacy-phases 创建演示租户）');
  }
}
