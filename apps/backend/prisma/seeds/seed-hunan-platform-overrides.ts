/**
 * 湖南总平台默认覆写（在 `runPlatformBootstrap` / 菜单种子之后执行）
 *
 * - 租户 000000：公司名「湖南科技有限公司」、根部门名称对齐
 * - 套餐 packageId=1：`menuIds` 与当前库内该租户全部菜单 ID 对齐（全量，随菜单增删自动一致）
 * - 角色 roleId=3：演示只读——绑定全部目录/页面菜单 + 仅 `:list` / `:query` 类按钮，不写库类按钮不绑定
 * - 岗位 postId 10/11：平台超级管理员、演示只读观察员；并绑定 userId 1 / 3
 *
 * 超级管理员仍为 roleId=1（与 `RoleService.getPermissionsByRoleIds` 硬编码一致），账号 admin。
 */

import { DelFlag, PrismaClient, Status } from '@prisma/client';

import { isReadonlyButtonPerm } from '../../src/common/utils/hunan-platform-demo-menu-filter';

const PLATFORM_TENANT_ID = '000000';
const DEMO_ROLE_ID = 3;
const SUPER_ADMIN_USER_ID = 1;
const DEMO_USER_ID = 3;
const FULL_PACKAGE_ID = 1;

export async function runHunanPlatformOverrides(prisma: PrismaClient): Promise<void> {
  console.log('湖南总平台默认覆写（租户/全量套餐/演示只读角色菜单/岗位）…');

  await prisma.$transaction(async (tx) => {
    await tx.sysTenant.updateMany({
      where: { tenantId: PLATFORM_TENANT_ID },
      data: {
        companyName: '湖南科技有限公司',
        intro: '系统默认总平台租户（湖南科技有限公司）',
        remark: '超级管理员租户',
        contactUserName: '管理员',
      },
    });

    await tx.sysDept.updateMany({
      where: { deptId: 100, tenantId: PLATFORM_TENANT_ID },
      data: {
        deptName: '湖南科技有限公司',
        leader: '管理员',
        remark: '总平台根组织',
      },
    });

    const allMenus = await tx.sysMenu.findMany({
      where: {
        tenantId: PLATFORM_TENANT_ID,
        delFlag: DelFlag.NORMAL,
        status: Status.NORMAL,
      },
      select: { menuId: true },
      orderBy: { menuId: 'asc' },
    });
    const allMenuIdsCsv = allMenus.map((m) => m.menuId).join(',');

    await tx.sysTenantPackage.updateMany({
      where: { packageId: FULL_PACKAGE_ID },
      data: {
        packageName: '全量套餐',
        menuIds: allMenuIdsCsv,
        remark: '总平台默认：包含当前库内该租户全部菜单 ID（由种子按 sys_menu 动态生成）',
      },
    });

    const menusForDemo = await tx.sysMenu.findMany({
      where: {
        tenantId: PLATFORM_TENANT_ID,
        delFlag: DelFlag.NORMAL,
        status: Status.NORMAL,
      },
      select: { menuId: true, menuType: true, perms: true },
    });

    const demoMenuIds = new Set<number>();
    for (const m of menusForDemo) {
      if (m.menuType === 'M' || m.menuType === 'C') {
        demoMenuIds.add(m.menuId);
        continue;
      }
      if (m.menuType === 'F' && isReadonlyButtonPerm(m.perms)) {
        demoMenuIds.add(m.menuId);
      }
    }

    await tx.sysRoleMenu.deleteMany({ where: { roleId: DEMO_ROLE_ID } });
    await tx.sysRoleMenu.createMany({
      data: [...demoMenuIds].sort((a, b) => a - b).map((menuId) => ({ roleId: DEMO_ROLE_ID, menuId })),
    });

    await tx.sysRole.updateMany({
      where: { roleId: DEMO_ROLE_ID },
      data: {
        roleName: '演示只读（全菜单查询）',
        remark: '可进入全部菜单；接口权限仅含目录/页面及 list、query 类按钮',
      },
    });

    await tx.sysPost.createMany({
      data: [
        {
          postId: 10,
          tenantId: PLATFORM_TENANT_ID,
          postCode: 'platform_super_admin',
          postName: '平台超级管理员',
          postSort: 1,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          createBy: 'seed',
          remark: '总平台超级管理员岗位（绑定 admin）',
        },
        {
          postId: 11,
          tenantId: PLATFORM_TENANT_ID,
          postCode: 'platform_demo_readonly',
          postName: '演示只读观察员',
          postSort: 90,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          createBy: 'seed',
          remark: '仅查询类权限演示岗位（绑定 demo）',
        },
      ],
      skipDuplicates: true,
    });

    await tx.sysUserPost.deleteMany({
      where: { userId: { in: [SUPER_ADMIN_USER_ID, DEMO_USER_ID] } },
    });
    await tx.sysUserPost.createMany({
      data: [
        { userId: SUPER_ADMIN_USER_ID, postId: 10 },
        { userId: DEMO_USER_ID, postId: 11 },
      ],
    });

    await tx.sysUser.update({
      where: { userId: SUPER_ADMIN_USER_ID },
      data: {
        nickName: '超级管理员',
        remark: '总平台超级管理员，默认密码与平台种子一致',
      },
    });

    await tx.sysUser.update({
      where: { userId: DEMO_USER_ID },
      data: {
        nickName: '演示账号（只读）',
        remark: '演示只读账号，密码 demo123（与平台种子一致）',
      },
    });
  });

  console.log(
    `  ✓ 租户/部门已更新为「湖南科技有限公司」；套餐 menuIds 共 ${(await prisma.sysMenu.count({ where: { tenantId: PLATFORM_TENANT_ID, delFlag: DelFlag.NORMAL, status: Status.NORMAL } }))} 项；演示角色菜单已按只读规则重建；岗位 10/11 已绑定 admin/demo`,
  );
}
