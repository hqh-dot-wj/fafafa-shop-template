import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import request from 'supertest';
import { TenantMiddleware } from 'src/common/tenant/tenant.middleware';
import { AppConfigService } from 'src/config/app-config.service';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OperlogService } from '../monitor/operlog/operlog.service';
import { UploadService } from '../upload/upload.service';
import { RoleController } from './role/role.controller';
import { RoleService } from './role/role.service';
import { TenantController } from './tenant/tenant.controller';
import { TenantService } from './tenant/tenant.service';
import { UserController } from './user/user.controller';
import { UserService } from './user/user.service';

const testUser = {
  browser: 'jest',
  deptId: 1,
  deviceType: 'test',
  ipaddr: '127.0.0.1',
  loginLocation: 'local',
  loginTime: new Date('2024-01-01T00:00:00.000Z'),
  os: 'jest',
  token: 'valid-token',
  userId: 1,
  userName: 'admin',
  user: {
    userId: 1,
    userName: 'admin',
    nickName: '管理员',
    password: 'secret',
    deptId: 1,
    dept: null,
    roles: [],
    posts: [],
  },
};

@Injectable()
class HeaderAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const notRequireAuth = this.reflector.getAllAndOverride<boolean>('notRequireAuth', [
      ctx.getClass(),
      ctx.getHandler(),
    ]);
    if (notRequireAuth) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<Request & { user?: typeof testUser }>();
    if (req.headers.authorization !== 'Bearer valid-token') {
      throw new ForbiddenException('请重新登录');
    }

    const permissions = this.parseCsvHeader(req.headers['x-test-permissions']);
    const roles = this.parseCsvHeader(req.headers['x-test-roles']);
    req.user = {
      ...testUser,
      permissions,
      roles,
    };
    return true;
  }

  private parseCsvHeader(value: string | string[] | undefined): string[] {
    const raw = Array.isArray(value) ? value.join(',') : value;
    return raw
      ? raw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  }
}

describe('admin system HTTP entry security', () => {
  let app: INestApplication;
  let roleService: Record<string, jest.Mock>;
  let userService: Record<string, jest.Mock>;
  let tenantService: Record<string, jest.Mock>;

  beforeAll(async () => {
    roleService = {
      create: jest.fn().mockResolvedValue({ ok: true }),
      findAll: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      optionselect: jest.fn().mockResolvedValue([]),
      deptTree: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue({ roleId: 1 }),
      update: jest.fn().mockResolvedValue({ ok: true }),
      dataScope: jest.fn().mockResolvedValue({ ok: true }),
      changeStatus: jest.fn().mockResolvedValue({ ok: true }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
      export: jest.fn().mockResolvedValue(undefined),
    };
    userService = {
      create: jest.fn().mockResolvedValue({ ok: true }),
      findAll: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      deptTree: jest.fn().mockResolvedValue([]),
      findPostAndRoleAll: jest.fn().mockResolvedValue({}),
      authRole: jest.fn().mockResolvedValue({}),
      updateAuthRole: jest.fn().mockResolvedValue({ ok: true }),
      optionselect: jest.fn().mockResolvedValue([]),
      findByDeptId: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ userId: 1 }),
      changeStatus: jest.fn().mockResolvedValue({ ok: true }),
      update: jest.fn().mockResolvedValue({ ok: true }),
      resetPwd: jest.fn().mockResolvedValue({ ok: true }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
      export: jest.fn().mockResolvedValue(undefined),
      allocatedList: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      unallocatedList: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      authUserCancel: jest.fn().mockResolvedValue({ ok: true }),
      authUserCancelAll: jest.fn().mockResolvedValue({ ok: true }),
      authUserSelectAll: jest.fn().mockResolvedValue({ ok: true }),
      updateProfile: jest.fn().mockResolvedValue({ ok: true }),
      updatePwd: jest.fn().mockResolvedValue({ ok: true }),
    };
    tenantService = {
      create: jest.fn().mockResolvedValue({ ok: true }),
      findAll: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
      syncTenantDict: jest.fn().mockResolvedValue({ ok: true }),
      syncTenantPackage: jest.fn().mockResolvedValue({ ok: true }),
      syncTenantConfig: jest.fn().mockResolvedValue({ ok: true }),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      update: jest.fn().mockResolvedValue({ ok: true }),
      remove: jest.fn().mockResolvedValue({ ok: true }),
      clearDynamicTenant: jest.fn().mockResolvedValue({ ok: true }),
      dynamicTenant: jest.fn().mockResolvedValue({ ok: true }),
      export: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture = await Test.createTestingModule({
      controllers: [RoleController, UserController, TenantController],
      providers: [
        { provide: RoleService, useValue: roleService },
        { provide: UserService, useValue: userService },
        { provide: TenantService, useValue: tenantService },
        { provide: OperlogService, useValue: { logAction: jest.fn() } },
        { provide: UploadService, useValue: { singleFileUpload: jest.fn().mockResolvedValue({ url: '/avatar.png' }) } },
        { provide: APP_GUARD, useClass: HeaderAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('/api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    const tenantMiddleware = new TenantMiddleware(
      {
        app: { prefix: '/api' },
        perm: { router: { whitelist: [] } },
        tenant: { enabled: true, exemptPathPrefixes: [] },
      } as AppConfigService,
      {
        isActive: jest.fn().mockReturnValue(false),
        set: jest.fn(),
      } as unknown as ClsService,
    );
    app.use((req: Request, res: Response, next: NextFunction) => tenantMiddleware.use(req, res, next));

    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects admin requests without tenant-id before reaching the service', async () => {
    await request(app.getHttpServer())
      .get('/api/system/role/list')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:role:list')
      .expect(403)
      .expect(({ body }) => {
        expect(body.msg).toContain('tenant-id');
      });

    expect(roleService.findAll).not.toHaveBeenCalled();
  });

  it('rejects protected endpoints without a login token', async () => {
    await request(app.getHttpServer()).get('/api/system/role/list').set('tenant-id', '000000').expect(403);

    expect(roleService.findAll).not.toHaveBeenCalled();
  });

  it('rejects protected endpoints when the permission is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/system/role/list')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .expect(403);

    expect(roleService.findAll).not.toHaveBeenCalled();
  });

  it('allows the role list endpoint only when tenant, login, and permission are all present', async () => {
    await request(app.getHttpServer())
      .get('/api/system/role/list')
      .query({ pageNum: 1, pageSize: 10 })
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:role:list')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ rows: [], total: 0 });
      });

    expect(roleService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNum: 1,
        pageSize: 10,
      }),
    );
  });

  it('rejects non-whitelisted role create fields before calling the service', async () => {
    await request(app.getHttpServer())
      .post('/api/system/role')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:role:add')
      .send({
        roleName: 'operator',
        roleKey: 'operator',
        roleSort: 1,
        dataScope: '1',
        unexpectedPermission: '*:*:*',
      })
      .expect(400);

    expect(roleService.create).not.toHaveBeenCalled();
  });

  it('rejects boundary pagination before user list service execution', async () => {
    await request(app.getHttpServer())
      .get('/api/system/user/list')
      .query({ pageNum: 0, pageSize: 10 })
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:user:list')
      .expect(400);

    expect(userService.findAll).not.toHaveBeenCalled();
  });

  it('rejects tenant dynamic switching without the dynamic permission', async () => {
    await request(app.getHttpServer())
      .get('/api/system/tenant/dynamic/T000001')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:tenant:list')
      .expect(403);

    expect(tenantService.dynamicTenant).not.toHaveBeenCalled();
  });

  it('rejects tenant package sync when required query fields are missing', async () => {
    await request(app.getHttpServer())
      .get('/api/system/tenant/syncTenantPackage')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-permissions', 'system:tenant:edit')
      .expect(400);

    expect(tenantService.syncTenantPackage).not.toHaveBeenCalled();
  });

  it('rejects RequireRole endpoints when the admin role is missing', async () => {
    await request(app.getHttpServer())
      .get('/api/system/user/authRole/2')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-roles', 'operator')
      .expect(403);

    expect(userService.authRole).not.toHaveBeenCalled();
  });

  it('allows RequireRole endpoints for admin role users', async () => {
    await request(app.getHttpServer())
      .get('/api/system/user/authRole/2')
      .set('tenant-id', '000000')
      .set('Authorization', 'Bearer valid-token')
      .set('x-test-roles', 'admin')
      .expect(200);

    expect(userService.authRole).toHaveBeenCalledWith(2);
  });
});
