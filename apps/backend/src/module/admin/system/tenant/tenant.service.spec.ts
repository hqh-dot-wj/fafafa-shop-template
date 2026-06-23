import { Test, TestingModule } from '@nestjs/testing';
import { TenantService } from './tenant.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { StationService } from 'src/module/lbs/station/station.service';
import { UserAuthService } from '../user/services/user-auth.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { CacheEnum, DataScopeEnum, DelFlagEnum, StatusEnum } from 'src/common/enum/index';
import { SYS_USER_TYPE } from 'src/common/constant/index';
import { ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { StepTraceService } from 'src/common/observability';

describe('TenantService', () => {
  let service: TenantService;
  let prisma: Record<string, any>;
  let redisService: { del: jest.Mock };
  const stepTraceService = {
    run: jest.fn(),
  };

  function createPrismaMock(): Record<string, any> {
    const prismaMock: Record<string, any> = {};
    Object.assign(prismaMock, {
      $transaction: jest.fn(async (callback: (tx: Record<string, any>) => Promise<unknown>) => callback(prismaMock)),
      sysTenant: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      sysTenantPackage: {
        findFirst: jest.fn(),
      },
      sysMenu: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sysDept: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      sysUser: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      sysRole: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      sysRoleMenu: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      sysUserRole: {
        createMany: jest.fn(),
      },
    });
    return prismaMock;
  }

  beforeEach(async () => {
    prisma = createPrismaMock();
    redisService = {
      del: jest.fn().mockResolvedValue(0),
    };
    stepTraceService.run.mockImplementation(async (_context: unknown, task: () => Promise<unknown>) => task());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: StationService,
          useValue: {
            upsertMainStation: jest.fn(),
          },
        },
        {
          provide: UserAuthService,
          useValue: {
            updateRedisToken: jest.fn(),
            createToken: jest.fn(),
          },
        },
        {
          provide: StepTraceService,
          useValue: stepTraceService,
        },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Given 城市代理套餐菜单, When syncTenantPackage, Then 补齐租户菜单、部门、角色和管理员授权', async () => {
    const tenant = {
      tenantId: '100003',
      companyName: '南京城市代理运营中心',
      contactUserName: '周城',
      contactPhone: '13902580003',
    };
    const tenantPackage = {
      packageId: 9,
      packageName: '城市代理套餐-UI自动化',
      menuIds: '2,3,5',
      menuCheckStrictly: false,
      status: StatusEnum.NORMAL,
      delFlag: DelFlagEnum.NORMAL,
    };
    const platformMenus = [
      {
        menuId: 1,
        tenantId: '000000',
        menuName: '系统管理',
        parentId: 0,
        orderNum: 1,
        path: 'system',
        component: 'layout.base$view.iframe-page',
        query: '',
        isFrame: '1',
        isCache: '0',
        menuType: 'M',
        visible: '0',
        status: StatusEnum.NORMAL,
        perms: '',
        icon: 'system',
        remark: '',
        delFlag: DelFlagEnum.NORMAL,
      },
      {
        menuId: 2,
        tenantId: '000000',
        menuName: '用户管理',
        parentId: 1,
        orderNum: 1,
        path: 'user',
        component: 'system/user/index',
        query: '',
        isFrame: '1',
        isCache: '0',
        menuType: 'C',
        visible: '0',
        status: StatusEnum.NORMAL,
        perms: 'system:user:list',
        icon: 'user',
        remark: '',
        delFlag: DelFlagEnum.NORMAL,
      },
      {
        menuId: 3,
        tenantId: '000000',
        menuName: '用户新增',
        parentId: 2,
        orderNum: 1,
        path: '',
        component: '',
        query: '',
        isFrame: '1',
        isCache: '0',
        menuType: 'F',
        visible: '0',
        status: StatusEnum.NORMAL,
        perms: 'system:user:add',
        icon: '',
        remark: '',
        delFlag: DelFlagEnum.NORMAL,
      },
      {
        menuId: 5,
        tenantId: '000000',
        menuName: '门店管理',
        parentId: 0,
        orderNum: 2,
        path: 'store',
        component: 'layout.base$view.iframe-page',
        query: '',
        isFrame: '1',
        isCache: '0',
        menuType: 'M',
        visible: '0',
        status: StatusEnum.NORMAL,
        perms: '',
        icon: 'store',
        remark: '',
        delFlag: DelFlagEnum.NORMAL,
      },
    ];
    let nextTenantMenuId = 100;

    prisma.sysTenant.findUnique.mockResolvedValue(tenant);
    prisma.sysTenantPackage.findFirst.mockResolvedValue(tenantPackage);
    prisma.sysTenant.update.mockResolvedValue({ ...tenant, packageId: 9 });
    prisma.sysMenu.findMany.mockResolvedValueOnce(platformMenus).mockResolvedValueOnce([]);
    prisma.sysMenu.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      menuId: nextTenantMenuId++,
    }));
    prisma.sysDept.findFirst.mockResolvedValue(null);
    prisma.sysDept.create.mockResolvedValue({ deptId: 88, tenantId: tenant.tenantId });
    prisma.sysUser.findFirst.mockResolvedValue({
      userId: 66,
      tenantId: tenant.tenantId,
      userName: 'cityagentsz',
      nickName: '租户管理员',
      userType: SYS_USER_TYPE.SYS,
      delFlag: DelFlagEnum.NORMAL,
    });
    prisma.sysUser.update.mockResolvedValue({ userId: 66, tenantId: tenant.tenantId, deptId: 88 });
    prisma.sysRole.findFirst.mockResolvedValue(null);
    prisma.sysRole.create.mockResolvedValue({ roleId: 77, tenantId: tenant.tenantId, roleKey: 'tenant_admin' });
    prisma.sysRoleMenu.deleteMany.mockResolvedValue({ count: 0 });
    prisma.sysRoleMenu.createMany.mockResolvedValue({ count: 4 });
    prisma.sysUserRole.createMany.mockResolvedValue({ count: 1 });

    const result = await service.syncTenantPackage({ tenantId: tenant.tenantId, packageId: '9' as unknown as number });

    expect(result.code).toBe(ResponseCode.SUCCESS);
    expect(prisma.sysTenant.update).toHaveBeenCalledWith({
      where: { tenantId: tenant.tenantId },
      data: { packageId: 9 },
    });
    expect(prisma.sysMenu.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: '000000',
          delFlag: DelFlagEnum.NORMAL,
          status: StatusEnum.NORMAL,
        }),
      }),
    );

    const createCalls = prisma.sysMenu.create.mock.calls;
    expect(createCalls).toHaveLength(4);
    const systemMenu = createCalls.find((call) => call[0].data.menuName === '系统管理')?.[0].data;
    const userMenu = createCalls.find((call) => call[0].data.menuName === '用户管理')?.[0].data;
    expect(systemMenu?.parentId).toBe(0);
    expect(userMenu?.parentId).toBe(100);

    expect(prisma.sysDept.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenant.tenantId,
          deptName: tenant.companyName,
          leader: tenant.contactUserName,
          phone: tenant.contactPhone,
        }),
      }),
    );
    expect(prisma.sysUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 66 },
        data: expect.objectContaining({
          deptId: 88,
          nickName: tenant.contactUserName,
          phonenumber: tenant.contactPhone,
        }),
      }),
    );
    expect(prisma.sysRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: tenant.tenantId,
          roleKey: 'tenant_admin',
          roleName: '城市代理管理员',
          dataScope: DataScopeEnum.DATA_SCOPE_ALL,
        }),
      }),
    );
    expect(prisma.sysRoleMenu.deleteMany).toHaveBeenCalledWith({ where: { roleId: 77 } });
    const roleMenuIds = prisma.sysRoleMenu.createMany.mock.calls[0][0].data.map(
      (item: { menuId: number }) => item.menuId,
    );
    expect(new Set(roleMenuIds)).toEqual(new Set([100, 101, 102, 103]));
    expect(prisma.sysUserRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 66, roleId: 77 }],
      skipDuplicates: true,
    });
    expect(redisService.del).toHaveBeenCalledWith([
      `${CacheEnum.SYS_MENU_KEY}${tenant.tenantId}:user:66`,
      `${CacheEnum.SYS_USER_KEY}${tenant.tenantId}:66`,
      `${CacheEnum.SYS_USER_KEY}${tenant.tenantId}:permissions:66`,
    ]);
  });

  it('Given 超级租户ID, When syncTenantPackage, Then 拒绝同步', async () => {
    await expect(service.syncTenantPackage({ tenantId: '000000', packageId: 1 })).rejects.toThrow(BusinessException);
    expect(prisma.sysTenant.findUnique).not.toHaveBeenCalled();
  });

  describe('resource and authorization boundaries', () => {
    it('Given missing tenant id, When findOne, Then throw NOT_FOUND', async () => {
      prisma.sysTenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne(404)).rejects.toThrow(BusinessException);

      try {
        await service.findOne(404);
      } catch (error) {
        expect((error as BusinessException).getResponse()).toMatchObject({
          code: ResponseCode.NOT_FOUND,
          msg: '租户不存在',
        });
      }
    });

    it('Given missing tenant id, When update, Then throw NOT_FOUND and skip write', async () => {
      prisma.sysTenant.findUnique.mockResolvedValue(null);

      await expect(service.update({ id: 404, companyName: '不存在租户' } as any)).rejects.toThrow(BusinessException);

      expect(prisma.sysTenant.update).not.toHaveBeenCalled();
    });

    it('Given duplicate company name, When update, Then throw BAD_REQUEST and skip write', async () => {
      prisma.sysTenant.findUnique.mockResolvedValue({ id: 1, tenantId: '100001', companyName: '原企业' });
      prisma.sysTenant.findFirst.mockResolvedValue({ id: 2, tenantId: '100002', companyName: '重复企业' });

      await expect(service.update({ id: 1, companyName: '重复企业' } as any)).rejects.toThrow(BusinessException);

      expect(prisma.sysTenant.update).not.toHaveBeenCalled();
    });

    it('Given non-super admin, When dynamicTenant, Then reject before tenant lookup', async () => {
      await expect(service.dynamicTenant('100001', { userId: 2 } as any)).rejects.toThrow(BusinessException);

      expect(prisma.sysTenant.findFirst).not.toHaveBeenCalled();
    });

    it('Given super admin and missing tenant, When dynamicTenant, Then throw NOT_FOUND', async () => {
      prisma.sysTenant.findFirst.mockResolvedValue(null);

      await expect(service.dynamicTenant('missing-tenant', { userId: 1, userName: 'admin' } as any)).rejects.toThrow(
        BusinessException,
      );
    });

    it('Given non-super admin, When clearDynamicTenant, Then reject without writing a new session', async () => {
      const userAuthService = (service as any).userAuthService as { updateRedisToken: jest.Mock };

      await expect(service.clearDynamicTenant({ userId: 2 } as any)).rejects.toThrow(BusinessException);

      expect(userAuthService.updateRedisToken).not.toHaveBeenCalled();
    });
  });
});
