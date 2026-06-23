/**
 * 开通租户：不同套餐、直营/加盟
 *
 * 每个演示租户在创建管理员后，会按套餐从平台 000000 复制菜单并写入 sys_role_menu，
 * 与 TenantService.syncPackage 一致，避免仅有页面路由却无 marketing:activity:list 等 API 权限。
 */
import { DelFlag, PrismaClient, Status, type SysRole, type SysUser } from '@prisma/client';

import { bindTenantPackageMenusForRole } from '../../../src/module/admin/system/tenant/tenant-package-sync';
import { DEMO_TENANT_FULL_MENU_IDS } from '../utils/platform-full-package-menu-ids';

import { DEMO_TENANT_IDS } from './sync-demo-tenant-permissions';

const PASSWORD_HASH = '$2b$10$UrJrjy0kxyrTO1UvhRVsvex35mB1s1jzAraIA9xtzPmlLmRtZXEXS'; // 123456
const DEMO_TENANT_ADMIN_ROLE_KEY = 'admin';

const FULL_MENU_IDS = DEMO_TENANT_FULL_MENU_IDS;

type DemoTenantSeed = {
  id: string;
  name: string;
  pkgId: number;
  contact: string;
  phone: string;
  region: string;
  isDirect: boolean;
};

async function ensureDemoTenantAdmin(
  prisma: PrismaClient,
  tenant: DemoTenantSeed,
): Promise<{ user: SysUser; role: SysRole }> {
  const adminUserName = `admin_${tenant.id}`;

  let role = await prisma.sysRole.findFirst({
    where: {
      tenantId: tenant.id,
      roleKey: DEMO_TENANT_ADMIN_ROLE_KEY,
      delFlag: DelFlag.NORMAL,
    },
    orderBy: { roleId: 'asc' },
  });

  let user = await prisma.sysUser.findFirst({
    where: {
      tenantId: tenant.id,
      userName: adminUserName,
      delFlag: DelFlag.NORMAL,
    },
  });

  if (!role) {
    role = await prisma.sysRole.create({
      data: {
        tenantId: tenant.id,
        roleName: '超级管理员',
        roleKey: DEMO_TENANT_ADMIN_ROLE_KEY,
        roleSort: 1,
        dataScope: '1',
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        createBy: 'seed',
      },
    });
  }

  if (!user) {
    let dept = await prisma.sysDept.findFirst({
      where: { tenantId: tenant.id, parentId: 0, delFlag: DelFlag.NORMAL },
      orderBy: { deptId: 'asc' },
    });

    if (!dept) {
      dept = await prisma.sysDept.create({
        data: {
          tenantId: tenant.id,
          parentId: 0,
          ancestors: '0',
          deptName: tenant.name,
          orderNum: 0,
          leader: tenant.contact,
          phone: tenant.phone,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          createBy: 'seed',
        },
      });
    }

    user = await prisma.sysUser.create({
      data: {
        tenantId: tenant.id,
        deptId: dept.deptId,
        userName: adminUserName,
        nickName: tenant.contact,
        userType: '00',
        email: `admin${tenant.id}@example.com`,
        phonenumber: tenant.phone,
        sex: '1',
        password: PASSWORD_HASH,
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        createBy: 'seed',
        remark: '租户管理员',
      },
    });

    console.log(`  ✓ ${tenant.name} (${tenant.id}) admin: ${adminUserName} / 123456`);
  }

  await prisma.sysUserRole.createMany({
    data: [{ userId: user.userId, roleId: role.roleId }],
    skipDuplicates: true,
  });

  return { user, role };
}

async function syncDemoTenantPackageMenus(prisma: PrismaClient, tenant: DemoTenantSeed, roleId: number): Promise<void> {
  const tenantPackage = await prisma.sysTenantPackage.findFirst({
    where: {
      packageId: tenant.pkgId,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
  });

  if (!tenantPackage?.menuIds) {
    console.warn(`  ⚠ ${tenant.id} 套餐 ${tenant.pkgId} 无 menuIds，跳过角色菜单同步`);
    return;
  }

  const menuCount = await bindTenantPackageMenusForRole(
    prisma,
    {
      tenantId: tenant.id,
      packageMenuIds: tenantPackage.menuIds,
      roleId,
    },
    {
      operator: 'seed',
      onWarn: (message) => console.warn(`  ⚠ ${message}`),
    },
  );

  console.log(`  ✓ ${tenant.id} 套餐菜单已同步（角色绑定 ${menuCount} 项，含 marketing:activity:list 等按钮权限）`);
}

export async function seedTenants(prisma: PrismaClient) {
  console.log('[03-Tenants] 租户开通...');

  for (const pkgId of [2, 3]) {
    await prisma.sysTenantPackage.upsert({
      where: { packageId: pkgId },
      update: { menuIds: FULL_MENU_IDS },
      create: {
        packageId: pkgId,
        packageName: pkgId === 2 ? '专业版套餐' : '企业版套餐',
        menuIds: FULL_MENU_IDS,
        menuCheckStrictly: true,
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        createBy: 'admin',
        remark: pkgId === 2 ? '适合中型门店' : '适合大型门店',
      },
    });
  }

  const tenants: DemoTenantSeed[] = DEMO_TENANT_IDS.map((id) => {
    const preset: Record<string, Omit<DemoTenantSeed, 'id'>> = {
      '100001': {
        name: '长沙天心区服务中心',
        pkgId: 2,
        contact: '张经理',
        phone: '13800430103',
        region: '430103',
        isDirect: true,
      },
      '100002': {
        name: '长沙岳麓生活馆',
        pkgId: 3,
        contact: '李经理',
        phone: '13800430104',
        region: '430104',
        isDirect: true,
      },
      '100003': {
        name: '长沙开福区便民服务站',
        pkgId: 2,
        contact: '王店长',
        phone: '13800430105',
        region: '430105',
        isDirect: false,
      },
      '100004': {
        name: '北京朝阳区旗舰店',
        pkgId: 3,
        contact: '赵经理',
        phone: '13800110105',
        region: '110105',
        isDirect: true,
      },
      '100005': {
        name: '广州天河区体验中心',
        pkgId: 3,
        contact: '孙店长',
        phone: '13800440106',
        region: '440106',
        isDirect: true,
      },
      '100006': {
        name: '演示租户（小程序联调）',
        pkgId: 2,
        contact: '周店长',
        phone: '13800440107',
        region: '440106',
        isDirect: true,
      },
    };
    return { id, ...preset[id]! };
  });

  for (const t of tenants) {
    await prisma.sysTenant.upsert({
      where: { tenantId: t.id },
      update: { packageId: t.pkgId, companyName: t.name },
      create: {
        tenantId: t.id,
        companyName: t.name,
        contactUserName: t.contact,
        contactPhone: t.phone,
        packageId: t.pkgId,
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        createBy: 'admin',
        accountCount: 10,
        expireTime: new Date('2030-12-31'),
        regionCode: t.region,
        isDirect: t.isDirect,
        remark: 'Demo 租户',
      },
    });

    const { role } = await ensureDemoTenantAdmin(prisma, t);
    await syncDemoTenantPackageMenus(prisma, t, role.roleId);
  }
}
