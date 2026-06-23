import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Result } from 'src/common/response';
import { DelFlagEnum, StatusEnum, CacheEnum } from 'src/common/enum/index';
import { Cacheable } from 'src/common/decorators/redis.decorator';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CreateMenuDto, UpdateMenuDto, ListMenuDto, SortMenuDto } from './dto/index';
import { ListToTree, Uniq } from 'src/common/utils/index';
import { UserRoleQueryService } from '../user/services/user-role-query.service';
import { buildMenus } from './utils';
import { PrismaService } from 'src/prisma/prisma.service';
import { MenuRepository } from './menu.repository';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { TenantContext } from 'src/common/tenant/tenant.context';

type MenuVisibilityItem = {
  menuId: number;
  menuName?: string | null;
  path?: string | null;
  component?: string | null;
  perms?: string | null;
};

const RETIRED_MESSAGE_MENU_IDS = new Set([122, 1207]);
const RETIRED_MESSAGE_MENU_PERMS = new Set(['system:message:list', 'system:notification:list']);
const RETIRED_MESSAGE_MENU_COMPONENTS = new Set(['system/message/index']);

@Injectable()
export class MenuService {
  private logger = new Logger(MenuService.name);
  constructor(
    private readonly userRoleQueryService: UserRoleQueryService,
    private readonly prisma: PrismaService,
    private readonly menuRepo: MenuRepository,
    private readonly redis: RedisService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  async create(createMenuDto: CreateMenuDto) {
    const { queryParam, status, ...data } = createMenuDto;
    const res = await this.menuRepo.create({
      ...data,
      status: status === '0' ? StatusEnum.NORMAL : StatusEnum.STOP,
      query: queryParam ?? '',
      path: createMenuDto.path ?? '',
      icon: createMenuDto.icon ?? '',
      delFlag: DelFlagEnum.NORMAL,
    });

    await this.clearCache();
    return Result.ok(res);
  }

  async findAll(query: ListMenuDto) {
    const res = await this.menuRepo.findAllMenus(query);
    const list = this.filterRetiredMessageMenus(res).map((item) => ({
      ...item,
      status: item.status === StatusEnum.NORMAL ? '0' : '1',
      queryParam: item.query,
    }));
    return Result.ok(list);
  }

  async treeSelect() {
    const res = await this.menuRepo.findAllMenus();
    const tree = ListToTree(
      this.filterRetiredMessageMenus(res),
      (m) => m.menuId,
      (m) => m.menuName,
    );
    return Result.ok(tree);
  }

  async roleMenuTreeselect(roleId: number) {
    const res = await this.menuRepo.findAllMenus();
    const visibleMenus = this.filterRetiredMessageMenus(res);
    const retiredMenuIds = this.collectRetiredMessageMenuIds(res);
    const tree = ListToTree(
      visibleMenus,
      (m) => m.menuId,
      (m) => m.menuName,
    );
    const menuIds = await this.menuRepo.findRoleMenus(roleId);
    const checkedKeys = menuIds.map((item) => item.menuId).filter((menuId) => !retiredMenuIds.has(menuId));
    return Result.ok({
      menus: tree,
      checkedKeys: checkedKeys,
    });
  }

  /**
   * 租户套餐菜单树
   */
  async tenantPackageMenuTreeselect(packageId: number) {
    const res = await this.prisma.sysMenu.findMany({
      where: {
        tenantId: TenantContext.SUPER_TENANT_ID,
        delFlag: DelFlagEnum.NORMAL,
      },
      orderBy: [{ orderNum: 'asc' }, { parentId: 'asc' }],
    });
    const visibleMenus = this.filterRetiredMessageMenus(res);
    const retiredMenuIds = this.collectRetiredMessageMenuIds(res);
    const tree = ListToTree(
      visibleMenus,
      (m) => m.menuId,
      (m) => m.menuName,
    );
    // 查询租户套餐关联的菜单ID
    const tenantPackage = await this.prisma.sysTenantPackage.findUnique({
      where: { packageId },
      select: { menuIds: true },
    });

    let checkedKeys: number[] = [];
    if (tenantPackage && tenantPackage.menuIds) {
      checkedKeys = tenantPackage.menuIds
        .split(',')
        .map(Number)
        .filter((menuId) => !retiredMenuIds.has(menuId) && !RETIRED_MESSAGE_MENU_IDS.has(menuId));
    }

    return Result.ok({
      menus: tree,
      checkedKeys,
    });
  }

  async findOne(menuId: number) {
    const res = await this.menuRepo.findById(menuId);
    if (res) {
      return Result.ok({
        ...res,
        status: res.status === StatusEnum.NORMAL ? '0' : '1',
        queryParam: res.query,
      });
    }
    return Result.ok(res);
  }

  async update(updateMenuDto: UpdateMenuDto) {
    const { queryParam, status, menuId, ...rest } = updateMenuDto;
    const updateData: Prisma.SysMenuUpdateInput = {
      ...rest,
      query: queryParam ?? '',
    };

    if (status) {
      updateData.status = status === '0' ? StatusEnum.NORMAL : StatusEnum.STOP;
    }

    const res = await this.menuRepo.update(menuId, updateData);
    await this.clearCache();
    return Result.ok(res);
  }

  /**
   * 删除菜单
   *
   * @param menuId 菜单ID
   * @returns 删除结果
   * @throws BusinessException 存在子菜单时抛出异常
   */
  async remove(menuId: number) {
    // 检查是否存在子菜单
    await this.checkHasChildren(menuId);

    const data = await this.menuRepo.softDelete(menuId);
    await this.clearCache();
    return Result.ok(data);
  }

  /**
   * 检查菜单是否存在子菜单
   *
   * @param menuId 菜单ID
   * @throws BusinessException 存在子菜单时抛出异常
   */
  private async checkHasChildren(menuId: number): Promise<void> {
    const childCount = await this.menuRepo.countChildren(menuId);
    BusinessException.throwIf(childCount > 0, '存在子菜单，不允许删除');
  }

  /**
   * 批量更新菜单排序
   *
   * @param sortMenuDto 排序数据
   * @returns 更新的记录数
   */
  async batchSort(sortMenuDto: SortMenuDto) {
    const count = await this.menuRepo.batchUpdateOrder(sortMenuDto.items);
    await this.clearCache();
    return Result.ok(count);
  }

  /**
   * 根据菜单路径生成权限标识建议
   *
   * @param path 菜单路径，如 /system/user 或 user
   * @param parentPath 父菜单路径（可选）
   * @param menuType 菜单类型：M=目录 C=菜单 F=按钮
   * @param action 操作类型（按钮时使用）：list/add/edit/remove/export/import
   * @returns 权限标识建议
   */
  generatePermission(
    path: string,
    parentPath?: string,
    menuType?: string,
    action?: string,
  ): { perms: string; suggestions: string[] } {
    // 清理路径，移除开头的斜杠
    const cleanPath = path?.replace(/^\/+/, '') || '';
    const cleanParentPath = parentPath?.replace(/^\/+/, '') || '';

    // 构建完整路径
    let fullPath = cleanPath;
    if (cleanParentPath && !cleanPath.includes('/')) {
      fullPath = `${cleanParentPath}/${cleanPath}`;
    }

    // 将路径转换为权限格式：/system/user -> system:user
    const permBase = fullPath.replace(/\//g, ':');

    // 根据菜单类型生成权限标识
    let perms = '';
    const suggestions: string[] = [];

    if (menuType === 'F') {
      // 按钮类型：添加操作后缀
      const actionSuffix = action || 'list';
      perms = `${permBase}:${actionSuffix}`;
      suggestions.push(
        `${permBase}:list`,
        `${permBase}:query`,
        `${permBase}:add`,
        `${permBase}:edit`,
        `${permBase}:remove`,
        `${permBase}:export`,
        `${permBase}:import`,
      );
    } else if (menuType === 'C') {
      // 菜单类型：默认 list 权限
      perms = `${permBase}:list`;
      suggestions.push(`${permBase}:list`, `${permBase}:query`);
    } else {
      // 目录类型：通常不需要权限标识
      perms = '';
      suggestions.push(`${permBase}:list`);
    }

    return { perms, suggestions: [...new Set(suggestions)] };
  }

  /**
   * 获取菜单使用情况统计
   *
   * @param menuId 菜单ID
   * @returns 使用该菜单的角色列表
   */
  async getMenuUsage(menuId: number) {
    const roleMenus = await this.prisma.sysRoleMenu.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysRoleMenu', { menuId }) as Prisma.SysRoleMenuWhereInput,
      select: { roleId: true },
    });
    const roleIds = [...new Set(roleMenus.map((rm) => rm.roleId))];

    if (roleIds.length === 0) {
      return Result.ok({ menuId, roleCount: 0, roles: [] });
    }

    const rolesData = await this.prisma.sysRole.findMany({
      where: this.tenantHelper.readWhereForDelegate('sysRole', { roleId: { in: roleIds } }) as Prisma.SysRoleWhereInput,
      select: {
        roleId: true,
        roleName: true,
        roleKey: true,
        status: true,
      },
    });

    const roles = rolesData.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      roleKey: role.roleKey,
      status: role.status === StatusEnum.NORMAL ? '0' : '1',
    }));

    return Result.ok({
      menuId,
      roleCount: roles.length,
      roles,
    });
  }

  /**
   * 级联删除菜单
   */
  async cascadeRemove(menuIds: number[]) {
    const data = await this.prisma.sysMenu.updateMany({
      where: {
        menuId: {
          in: menuIds,
        },
      },
      data: {
        delFlag: DelFlagEnum.DELETE,
      },
    });
    await this.clearCache();
    return Result.ok(data.count);
  }

  /**
   * 清除菜单缓存
   */
  private async clearCache() {
    const deletedCount = await this.redis.scanAndDeleteByMatch(`${CacheEnum.SYS_MENU_KEY}*`);

    if (deletedCount > 0) {
      this.logger.log(`Cleared ${deletedCount} menu cache keys`);
    } else {
      this.logger.log('No menu cache keys found to clear.');
    }
  }

  async findMany(args: Prisma.SysMenuFindManyArgs) {
    const where = this.tenantHelper.readWhereForDelegate(
      'sysMenu',
      (args.where ?? {}) as object,
    ) as Prisma.SysMenuWhereInput;
    return await this.prisma.sysMenu.findMany({ ...args, where });
  }

  /**
   * 根据用户ID查询菜单
   *
   * @param userId 用户ID
   * @return 菜单列表
   */
  @Cacheable(CacheEnum.SYS_MENU_KEY, 'user:{userId}')
  async getMenuListByUserId(userId: number) {
    const roleIds = await this.userRoleQueryService.getRoleIds([userId]);
    const isSuperAdmin = roleIds.includes(1);
    let menuIds: number[] = [];

    if (isSuperAdmin) {
      const allMenus = await this.prisma.sysMenu.findMany({
        where: {
          tenantId: TenantContext.SUPER_TENANT_ID,
          delFlag: DelFlagEnum.NORMAL,
          status: StatusEnum.NORMAL,
        },
        select: {
          menuId: true,
        },
      });
      menuIds = allMenus.map((item) => item.menuId);
    } else {
      const menuWidthRoleList = await this.prisma.sysRoleMenu.findMany({
        where: this.tenantHelper.readWhereForDelegate('sysRoleMenu', {
          roleId: {
            in: roleIds,
          },
        }) as Prisma.SysRoleMenuWhereInput,
        select: {
          menuId: true,
        },
      });
      menuIds = Uniq(menuWidthRoleList.map((item) => item.menuId));
      // 补齐父级目录，否则 buildMenus 会丢弃「父未授权」的子菜单（侧栏不显示）
      menuIds = await this.expandMenuIdsWithAncestors(menuIds);
    }
    menuIds = menuIds.filter((menuId) => !RETIRED_MESSAGE_MENU_IDS.has(menuId));

    if (menuIds.length === 0) {
      return Result.ok([]);
    }

    const menuWhere = {
      delFlag: DelFlagEnum.NORMAL,
      status: StatusEnum.NORMAL,
      menuId: {
        in: menuIds,
      },
    };
    const menuList = await this.prisma.sysMenu.findMany({
      where: isSuperAdmin
        ? {
            ...menuWhere,
            tenantId: TenantContext.SUPER_TENANT_ID,
          }
        : (this.tenantHelper.readWhereForDelegate('sysMenu', menuWhere) as Prisma.SysMenuWhereInput),
      orderBy: {
        orderNum: 'asc',
      },
    });
    const normalizedMenus = this.normalizeVisibleMenus(menuList);
    const menuTree = buildMenus(normalizedMenus);
    return Result.ok(menuTree);
  }

  /**
   * 通知公告已承担站内消息投递入口；历史库里可能仍残留「消息管理」菜单。
   * 这里做运行时屏蔽，避免未重播 seed 或 Redis 缓存外的旧数据继续出现在侧栏/授权树。
   */
  private filterRetiredMessageMenus<T extends MenuVisibilityItem>(menus: T[]): T[] {
    return menus.filter((menu) => !this.isRetiredMessageMenu(menu));
  }

  private collectRetiredMessageMenuIds<T extends MenuVisibilityItem>(menus: T[]): Set<number> {
    return new Set(menus.filter((menu) => this.isRetiredMessageMenu(menu)).map((menu) => menu.menuId));
  }

  private isRetiredMessageMenu(menu: MenuVisibilityItem): boolean {
    if (RETIRED_MESSAGE_MENU_IDS.has(menu.menuId)) return true;

    const component = (menu.component ?? '').trim().toLowerCase();
    if (RETIRED_MESSAGE_MENU_COMPONENTS.has(component)) return true;

    const perms = (menu.perms ?? '').trim();
    if (RETIRED_MESSAGE_MENU_PERMS.has(perms)) return true;

    const path = (menu.path ?? '')
      .trim()
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
    const menuName = (menu.menuName ?? '').trim();
    return path === 'message' && menuName === '消息管理';
  }

  private normalizeVisibleMenus<T extends { menuId: number; parentId: number; path?: string | null }>(menus: T[]): T[] {
    return this.normalizeMarketingMenus(this.filterRetiredMessageMenus(menus));
  }

  /**
   * 营销菜单归一化：营销根目录下移除 legacy 直挂入口，避免与新分组并存。
   */
  private normalizeMarketingMenus<T extends { menuId: number; parentId: number; path?: string | null }>(
    menus: T[],
  ): T[] {
    const hasMarketingRoot = menus.some((menu) => menu.menuId === 7);
    if (!hasMarketingRoot) {
      return menus;
    }

    const legacyMenuIds = new Set([1114, 1136]);
    const legacyPaths = new Set(['config', 'instance']);

    return menus.filter((menu) => {
      if (menu.parentId !== 7) return true;
      if (legacyMenuIds.has(menu.menuId)) return false;
      const path = (menu.path ?? '').trim().toLowerCase();
      return !legacyPaths.has(path);
    });
  }

  /** 将角色已分配的菜单 ID 扩展为包含其所有祖先目录，保证树形挂载完整 */
  private async expandMenuIdsWithAncestors(menuIds: number[]): Promise<number[]> {
    if (menuIds.length === 0) {
      return [];
    }
    const baseWhere = this.tenantHelper.readWhereForDelegate('sysMenu', {
      delFlag: DelFlagEnum.NORMAL,
      status: StatusEnum.NORMAL,
    }) as Prisma.SysMenuWhereInput;
    const rows = await this.prisma.sysMenu.findMany({
      where: baseWhere,
      select: { menuId: true, parentId: true },
    });
    const parentByMenuId = new Map(rows.map((r) => [r.menuId, r.parentId]));
    const expanded = new Set<number>(menuIds);
    for (const mid of menuIds) {
      let pid = parentByMenuId.get(mid);
      while (pid !== undefined && pid > 0) {
        expanded.add(pid);
        pid = parentByMenuId.get(pid);
      }
    }
    return [...expanded];
  }
}
