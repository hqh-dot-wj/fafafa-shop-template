import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/module/admin/common/guards/auth.guard';
import { UserService } from 'src/module/admin/system/user/user.service';
import { AppConfigService } from 'src/config/app-config.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let userService: UserService;
  let configService: AppConfigService;

  const mockUserService = {
    parseToken: jest.fn(),
  };

  const mockConfigService = {
    app: {
      prefix: '/api',
    },
    perm: {
      router: {
        whitelist: [
          { path: '/login', method: 'POST' },
          { path: '/captchaImage', method: 'GET' },
          { path: '/logout', method: 'POST' },
        ],
      },
    },
  };

  const createMockContext = (options: {
    path?: string;
    originalUrl?: string;
    url?: string;
    method?: string;
    authorization?: string;
    notRequireAuth?: boolean;
  }): ExecutionContext => {
    const {
      path = '/test',
      originalUrl,
      url,
      method = 'GET',
      authorization = '',
      notRequireAuth = false,
    } = options;

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          route: { path },
          path,
          originalUrl,
          url,
          method,
          get: (header: string) => (header === 'Authorization' ? authorization : null),
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: JwtAuthGuard,
          useFactory: (reflector: Reflector, userService: UserService, config: AppConfigService) => {
            return new JwtAuthGuard(reflector, userService, config);
          },
          inject: [Reflector, UserService, AppConfigService],
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    reflector = module.get<Reflector>(Reflector);
    userService = module.get<UserService>(UserService);
    configService = module.get<AppConfigService>(AppConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canActivate', () => {
    it('should allow access when @NotRequireAuth is set', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      const context = createMockContext({ notRequireAuth: true });

      // Mock the super.canActivate to avoid actual passport validation
      jest.spyOn(guard as any, 'activate').mockResolvedValue(true);
      jest.spyOn(guard as any, 'jumpActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access for whitelisted routes', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = createMockContext({
        path: '/login',
        method: 'POST',
      });

      jest.spyOn(guard as any, 'jumpActivate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when no token provided', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = createMockContext({
        path: '/protected',
        method: 'GET',
        authorization: '',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockUserService.parseToken.mockReturnValue(null);

      const context = createMockContext({
        path: '/protected',
        method: 'GET',
        authorization: 'Bearer invalid-token',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should allow access with valid token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockUserService.parseToken.mockReturnValue({ userId: 1 });

      const context = createMockContext({
        path: '/protected',
        method: 'GET',
        authorization: 'Bearer valid-token',
      });

      jest.spyOn(guard as any, 'activate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('后台 system/client（OAuth 客户端管理）不得误判为 C 端 /client，应走管理员鉴权', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockUserService.parseToken.mockReturnValue({ userId: 1 });

      const context = createMockContext({
        path: '/system/client/list',
        originalUrl: '/api/system/client/list',
        method: 'GET',
        authorization: 'Bearer admin-token',
      });

      jest.spyOn(guard as any, 'activate').mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockUserService.parseToken).toHaveBeenCalledWith('Bearer admin-token');
    });

    it('小程序模块 /client/* 应跳过管理员 JwtAuthGuard', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);

      const context = createMockContext({
        path: '/client/foo',
        originalUrl: '/api/client/foo',
        method: 'GET',
        authorization: '',
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockUserService.parseToken).not.toHaveBeenCalled();
    });
  });

  describe('checkWhiteList', () => {
    it('should return true for exact match in whitelist', () => {
      const context = createMockContext({
        path: '/login',
        method: 'POST',
      });

      const result = guard.checkWhiteList(context);

      expect(result).toBe(true);
    });

    it('should return false for non-whitelisted route', () => {
      const context = createMockContext({
        path: '/users',
        method: 'GET',
      });

      const result = guard.checkWhiteList(context);

      expect(result).toBe(false);
    });

    it('should match regardless of method case', () => {
      const context = createMockContext({
        path: '/login',
        method: 'post',
      });

      const result = guard.checkWhiteList(context);

      expect(result).toBe(true);
    });

    it('should return false for whitelist route with wrong method', () => {
      const context = createMockContext({
        path: '/login',
        method: 'GET',
      });

      const result = guard.checkWhiteList(context);

      expect(result).toBe(false);
    });
  });

  describe('parseToken integration', () => {
    it('should call userService.parseToken with correct token', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      mockUserService.parseToken.mockReturnValue({ userId: 1 });

      const context = createMockContext({
        path: '/protected',
        method: 'GET',
        authorization: 'Bearer test-token-123',
      });

      jest.spyOn(guard as any, 'activate').mockResolvedValue(true);

      await guard.canActivate(context);

      expect(mockUserService.parseToken).toHaveBeenCalledWith('Bearer test-token-123');
    });
  });
});
