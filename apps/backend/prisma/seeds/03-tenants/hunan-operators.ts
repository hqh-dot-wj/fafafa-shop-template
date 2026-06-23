import { DelFlag, PrismaClient, Status } from '@prisma/client';

import { bindPlatformMenuSubtreeForRole } from '../../../src/module/admin/system/tenant/tenant-package-sync';
import { HUNAN_FULL_OPERATORS } from '../hunan-full/catalog-operators';
import { HUNAN_OPERATOR_MENU_ROOTS } from '../hunan-full/catalog-operator-menus';
import {
  assertHunanFullSeedScope,
  HUNAN_FULL_COMPANY_NAME,
  HUNAN_FULL_MEMBER_PASSWORD_HASH,
  HUNAN_FULL_TENANT_ID,
} from '../hunan-full/shared';

export async function seedHunanOperators(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanOperators');
  console.log('[03-Tenants] 湖南完整演示后台操作账号...');

  let opsDept = await prisma.sysDept.findFirst({
    where: { tenantId: HUNAN_FULL_TENANT_ID, deptName: `${HUNAN_FULL_COMPANY_NAME}运营中心` },
  });

  if (!opsDept) {
    opsDept = await prisma.sysDept.create({
      data: {
        tenantId: HUNAN_FULL_TENANT_ID,
        parentId: 0,
        ancestors: '0',
        deptName: `${HUNAN_FULL_COMPANY_NAME}运营中心`,
        orderNum: 10,
        leader: '系统种子',
        phone: '18673128000',
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
        createBy: 'seed',
      },
    });
  }

  for (const operator of HUNAN_FULL_OPERATORS) {
    let role = await prisma.sysRole.findFirst({
      where: { tenantId: HUNAN_FULL_TENANT_ID, roleKey: operator.roleKey },
    });

    if (!role) {
      role = await prisma.sysRole.create({
        data: {
          tenantId: HUNAN_FULL_TENANT_ID,
          roleName: operator.roleName,
          roleKey: operator.roleKey,
          roleSort: 10,
          dataScope: '1',
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          createBy: 'seed',
          remark: operator.remark,
        },
      });
    } else {
      role = await prisma.sysRole.update({
        where: { roleId: role.roleId },
        data: {
          roleName: operator.roleName,
          remark: operator.remark,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          updateBy: 'seed',
        },
      });
    }

    const menuRoots = HUNAN_OPERATOR_MENU_ROOTS[operator.roleKey];
    if (menuRoots?.length) {
      const menuCount = await bindPlatformMenuSubtreeForRole(
        prisma,
        { roleId: role.roleId, rootMenuIds: menuRoots },
        { operator: 'seed', onWarn: (message) => console.warn(`  ⚠ ${message}`) },
      );
      console.log(`  ✓ ${operator.userName} 角色菜单 ${menuCount} 项（根: ${menuRoots.join(',')}）`);
    } else {
      console.warn(`  ⚠ ${operator.userName} 未配置菜单子树，接口权限仍为空`);
    }

    let user = await prisma.sysUser.findFirst({
      where: { tenantId: HUNAN_FULL_TENANT_ID, userName: operator.userName },
    });

    if (!user) {
      user = await prisma.sysUser.create({
        data: {
          tenantId: HUNAN_FULL_TENANT_ID,
          deptId: opsDept.deptId,
          userName: operator.userName,
          userType: '00',
          nickName: operator.nickName,
          email: operator.email,
          phonenumber: operator.phone,
          sex: '1',
          password: HUNAN_FULL_MEMBER_PASSWORD_HASH,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          createBy: 'seed',
          remark: operator.remark,
        },
      });
    } else {
      user = await prisma.sysUser.update({
        where: { userId: user.userId },
        data: {
          deptId: opsDept.deptId,
          nickName: operator.nickName,
          email: operator.email,
          phonenumber: operator.phone,
          password: HUNAN_FULL_MEMBER_PASSWORD_HASH,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          remark: operator.remark,
          updateBy: 'seed',
        },
      });
    }

    const userRole = await prisma.sysUserRole.findFirst({
      where: { userId: user.userId, roleId: role.roleId },
    });
    if (!userRole) {
      await prisma.sysUserRole.create({
        data: {
          userId: user.userId,
          roleId: role.roleId,
        },
      });
    }
  }

  console.log(`  ✓ ${HUNAN_FULL_OPERATORS.length} 个后台操作账号（含分角色菜单权限）`);
}
