/**
 * 若库中缺少「订单活动审计」「佣金计算审计」菜单（常见于未重跑含新菜单的种子），
 * 为超级租户 000000 补全 sys_menu，并为角色 2 补 sys_role_menu。
 *
 * 在 apps/backend 下执行: pnpm prisma:ensure-audit-menus
 *
 * 默认 visible=1（侧栏隐藏），仅保留路由与权限；从订单列表/详情等入口跳转访问。
 */
import { DelFlag, PrismaClient, Status } from '@prisma/client';

const TENANT = '000000';
const ROLE_ID = 2;

const AUDIT_MENUS = [
  {
    menuId: 1084,
    menuName: '订单活动审计',
    parentId: 210,
    orderNum: 4,
    path: 'activity-audit',
    component: 'store/order/activity-audit/index',
    perms: 'store:order:query',
    remark: '按订单查询行级活动与裁决快照',
  },
  {
    menuId: 1085,
    menuName: '佣金计算审计',
    parentId: 200,
    orderNum: 5,
    path: 'commission-audit',
    component: 'store/finance/commission-audit/index',
    perms: 'finance:commission:list',
    remark: '按订单行查询佣金计算明细',
  },
] as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    for (const m of AUDIT_MENUS) {
      await prisma.sysMenu.upsert({
        where: { menuId: m.menuId },
        create: {
          menuId: m.menuId,
          tenantId: TENANT,
          menuName: m.menuName,
          parentId: m.parentId,
          orderNum: m.orderNum,
          path: m.path,
          component: m.component,
          query: '',
          isFrame: '1',
          isCache: '0',
          menuType: 'C',
          visible: '1',
          status: Status.NORMAL,
          perms: m.perms,
          icon: 'documentation',
          createBy: 'admin',
          updateBy: '',
          remark: m.remark,
          delFlag: DelFlag.NORMAL,
        },
        update: {
          tenantId: TENANT,
          menuName: m.menuName,
          parentId: m.parentId,
          orderNum: m.orderNum,
          path: m.path,
          component: m.component,
          menuType: 'C',
          isFrame: '1',
          isCache: '0',
          icon: 'documentation',
          perms: m.perms,
          remark: m.remark,
          status: Status.NORMAL,
          delFlag: DelFlag.NORMAL,
          visible: '1',
        },
      });
      console.log(`已同步菜单 menu_id=${m.menuId} ${m.menuName}`);
    }

    for (const m of AUDIT_MENUS) {
      await prisma.sysRoleMenu.upsert({
        where: { roleId_menuId: { roleId: ROLE_ID, menuId: m.menuId } },
        create: { roleId: ROLE_ID, menuId: m.menuId },
        update: {},
      });
    }
    console.log(`已为角色 role_id=${ROLE_ID} 关联审计菜单 1084、1085`);

    const auditRows = await prisma.sysMenu.findMany({
      where: { menuId: { in: [1084, 1085] } },
      select: { menuId: true, menuName: true, parentId: true, path: true, menuType: true, component: true },
    });
    console.log('审计菜单结构核对:', auditRows);

    const financeDupes = await prisma.sysMenu.findMany({
      where: {
        tenantId: TENANT,
        delFlag: DelFlag.NORMAL,
        menuName: '财务',
      },
      select: { menuId: true, parentId: true, path: true, menuType: true },
    });
    if (financeDupes.length > 1) {
      console.warn('警告: 存在多条名为「财务」的菜单，侧栏可能出现重复目录，请在「菜单管理」中合并或删除多余项:', financeDupes);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
