import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { LOGIN_TOKEN_EXPIRESIN } from 'src/common/constant';
import { BusinessException } from 'src/common/exceptions';
import { CacheEnum, DelFlagEnum, StatusEnum } from 'src/common/enum';
import { ResponseCode } from 'src/common/response';
import { TenantContext } from 'src/common/tenant';
import { ConfigService } from 'src/module/admin/system/config/config.service';
import { RoleService } from 'src/module/admin/system/role/role.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { getTenantHelperTestProvider } from 'src/test-utils/mocks';
import { UserRepository } from '../user.repository';
import { UserAuthService } from './user-auth.service';
import { UserRoleQueryService } from './user-role-query.service';

const clientInfo = {
  browser: 'Chrome',
  deviceType: '0',
  ipaddr: '127.0.0.1',
  loginLocation: 'Local',
  os: 'Windows',
};

const createUser = (overrides: Record<string, unknown> = {}) => ({
  userId: 2,
  tenantId: 'STORED_TENANT',
  deptId: 10,
  userName: 'admin',
  nickName: '管理员',
  password: bcrypt.hashSync('RightPass123', bcrypt.genSaltSync(4)),
  status: StatusEnum.NORMAL,
  delFlag: DelFlagEnum.NORMAL,
  roles: [],
  posts: [],
  dept: null,
  ...overrides,
});

describe('UserAuthService security invariants', () => {
  let module: TestingModule;
  let service: UserAuthService;
  let prisma: Record<string, any>;
  let userRepo: Record<string, jest.Mock>;
  let roleService: Record<string, jest.Mock>;
  let redisService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;
  let userRoleQueryService: Record<string, jest.Mock>;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  const loginDto = {
    userName: 'admin',
    password: 'RightPass123',
    code: 'ABCD',
    uuid: 'captcha-uuid',
  };

  beforeAll(() => {
    loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  beforeEach(async () => {
    prisma = {
      sysDept: {
        findFirst: jest.fn().mockResolvedValue({ deptName: '运营部' }),
      },
      sysPost: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      sysUser: {
        update: jest.fn().mockResolvedValue({}),
      },
      sysUserPost: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    userRepo = {
      findByUserName: jest.fn().mockResolvedValue(createUser()),
      findById: jest.fn().mockResolvedValue(createUser()),
      updateLoginTime: jest.fn().mockResolvedValue(undefined),
    };
    roleService = {
      findRoles: jest.fn().mockResolvedValue([{ roleId: 1, roleKey: 'admin', delFlag: DelFlagEnum.NORMAL }]),
      getPermissionsByRoleIds: jest
        .fn()
        .mockResolvedValue([
          { perms: 'system:user:list' },
          { perms: 'system:user:list' },
          { perms: 'system:role:list' },
        ]),
    };
    redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      keys: jest.fn().mockResolvedValue([]),
    };
    configService = {
      getSystemConfigValue: jest.fn().mockResolvedValue('false'),
    };
    userRoleQueryService = {
      getRoleIds: jest.fn().mockResolvedValue([1]),
    };

    module = await Test.createTestingModule({
      providers: [
        UserAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserRepository, useValue: userRepo },
        { provide: RedisService, useValue: redisService },
        { provide: ConfigService, useValue: configService },
        { provide: RoleService, useValue: roleService },
        { provide: UserRoleQueryService, useValue: userRoleQueryService },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('legacy-token'),
            verify: jest.fn().mockReturnValue({ uuid: 'session-uuid', userId: 2 }),
          },
        },
        getTenantHelperTestProvider(),
      ],
    }).compile();

    service = module.get(UserAuthService);
  });

  afterEach(async () => {
    await module.close();
  });

  afterAll(() => {
    loggerLogSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  function mockCaptchaCode(code: string | null) {
    let storedCode = code;
    redisService.get.mockImplementation(async (key: string) => {
      if (key === `${CacheEnum.CAPTCHA_CODE_KEY}${loginDto.uuid}`) {
        return storedCode;
      }
      return null;
    });
    redisService.del.mockImplementation(async (key: string) => {
      if (key === `${CacheEnum.CAPTCHA_CODE_KEY}${loginDto.uuid}`) {
        storedCode = null;
      }
      return 1;
    });
  }

  function findLoginSessionSetCall() {
    return redisService.set.mock.calls.find((call) => String(call[0]).startsWith(CacheEnum.LOGIN_TOKEN_KEY));
  }

  describe('captcha preconditions', () => {
    beforeEach(() => {
      configService.getSystemConfigValue.mockResolvedValue('true');
    });

    it('rejects missing captcha code before querying the user repository', async () => {
      mockCaptchaCode('abcd');

      const result = await service.login({ ...loginDto, code: '' }, clientInfo);

      expect(result.code).toBe(500);
      expect(result.msg).toContain('请输入验证码');
      expect(userRepo.findByUserName).not.toHaveBeenCalled();
    });

    it('rejects expired captcha before password verification', async () => {
      mockCaptchaCode(null);

      const result = await service.login(loginDto, clientInfo);

      expect(result.code).toBe(500);
      expect(result.msg).toContain('验证码已过期');
      expect(userRepo.findByUserName).not.toHaveBeenCalled();
    });

    it('rejects mismatched captcha before password verification', async () => {
      mockCaptchaCode('wxyz');

      const result = await service.login(loginDto, clientInfo);

      expect(result.code).toBe(500);
      expect(result.msg).toContain('验证码错误');
      expect(userRepo.findByUserName).not.toHaveBeenCalled();
    });

    it('accepts captcha case-insensitively and writes a tenant-scoped session', async () => {
      mockCaptchaCode('abcd');

      const result = await TenantContext.run({ tenantId: 'TENANT_A' }, () => service.login(loginDto, clientInfo));

      expect(result.code).toBe(200);
      const sessionSet = findLoginSessionSetCall();
      expect(sessionSet).toBeTruthy();
      expect(sessionSet?.[1]).toMatchObject({
        permissions: ['system:user:list', 'system:role:list'],
        roles: ['admin'],
        user: expect.objectContaining({ tenantId: 'TENANT_A' }),
        userId: 2,
        userName: 'admin',
      });
      expect(sessionSet?.[2]).toBe(LOGIN_TOKEN_EXPIRESIN);
      expect(redisService.del).toHaveBeenCalledWith(`${CacheEnum.CAPTCHA_CODE_KEY}${loginDto.uuid}`);
      expect(userRepo.updateLoginTime).toHaveBeenCalledWith(2);
      expect(prisma.sysUser.update).toHaveBeenCalledWith({
        where: { userId: 2 },
        data: { loginIp: '127.0.0.1' },
      });
    });

    it('rejects replaying the same captcha uuid after a successful validation', async () => {
      mockCaptchaCode('abcd');

      const first = await service.login(loginDto, clientInfo);
      const second = await service.login(loginDto, clientInfo);

      expect(first.code).toBe(200);
      expect(second.code).toBe(500);
      expect(second.msg).toContain('验证码已过期');
      expect(
        redisService.del.mock.calls.filter((call) => call[0] === `${CacheEnum.CAPTCHA_CODE_KEY}${loginDto.uuid}`),
      ).toHaveLength(1);
    });
  });

  describe('password and user state', () => {
    it('rejects wrong password without writing a login session', async () => {
      const result = await service.login({ ...loginDto, password: 'WrongPass123' }, clientInfo);

      expect(result.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(result.msg).toContain('帐号或密码错误');
      expect(userRepo.updateLoginTime).not.toHaveBeenCalled();
      expect(findLoginSessionSetCall()).toBeUndefined();
    });

    it('rejects deleted users without writing a login session', async () => {
      userRepo.findById.mockResolvedValue(createUser({ delFlag: DelFlagEnum.DELETE }));

      const result = await service.login(loginDto, clientInfo);

      expect(result.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(result.msg).toContain('您已被禁用');
      expect(userRepo.updateLoginTime).not.toHaveBeenCalled();
      expect(findLoginSessionSetCall()).toBeUndefined();
    });

    it('rejects stopped users without writing a login session', async () => {
      userRepo.findById.mockResolvedValue(createUser({ status: StatusEnum.STOP }));

      const result = await service.login(loginDto, clientInfo);

      expect(result.code).toBe(ResponseCode.BUSINESS_ERROR);
      expect(result.msg).toContain('您已被停用');
      expect(userRepo.updateLoginTime).not.toHaveBeenCalled();
      expect(findLoginSessionSetCall()).toBeUndefined();
    });
  });

  describe('session mutation', () => {
    it('merges new session metadata into an existing Redis session', async () => {
      redisService.get.mockResolvedValue({
        permissions: ['old:permission'],
        token: 'session-uuid',
        userName: 'admin',
      });

      await service.updateRedisToken('session-uuid', { roles: ['admin'] });

      expect(redisService.set).toHaveBeenCalledWith(
        `${CacheEnum.LOGIN_TOKEN_KEY}session-uuid`,
        expect.objectContaining({
          permissions: ['old:permission'],
          roles: ['admin'],
          token: 'session-uuid',
        }),
        LOGIN_TOKEN_EXPIRESIN,
      );
    });

    it('rejects passwordless login for stopped users before session write', async () => {
      userRepo.findById.mockResolvedValue(createUser({ status: StatusEnum.STOP }));

      await expect(service.loginByUserId(2, 'session-uuid', clientInfo)).rejects.toThrow(BusinessException);

      expect(userRepo.updateLoginTime).not.toHaveBeenCalled();
      expect(findLoginSessionSetCall()).toBeUndefined();
    });

    it('writes tenant-scoped metadata for passwordless login sessions', async () => {
      await TenantContext.run({ tenantId: 'TENANT_B' }, () =>
        service.loginByUserId(2, 'passwordless-uuid', clientInfo),
      );

      expect(redisService.set).toHaveBeenCalledWith(
        `${CacheEnum.LOGIN_TOKEN_KEY}passwordless-uuid`,
        expect.objectContaining({
          user: expect.objectContaining({ tenantId: 'TENANT_B' }),
          userId: 2,
          userName: 'admin',
        }),
        LOGIN_TOKEN_EXPIRESIN,
      );
    });
  });
});
