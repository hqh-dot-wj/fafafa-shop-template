import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BusinessException } from 'src/common/exceptions';
import { Result, ResponseCode } from 'src/common/response';
import { TenantContext } from 'src/common/tenant';
import { RedisService } from 'src/module/common/redis/redis.service';
import { UserService } from '../system/user/user.service';
import { AccountLockService } from './services/account-lock.service';
import { SocialAuthService } from './services/social-auth.service';
import { TokenService } from './services/token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CryptoService } from 'src/common/crypto';

describe('admin auth HTTP security boundary', () => {
  let app: INestApplication;
  let authService: Record<string, jest.Mock>;
  let redisService: Record<string, jest.Mock>;
  let tokenService: Record<string, jest.Mock>;
  let accountLockService: Record<string, jest.Mock>;
  let observedTenantId: string | undefined;

  beforeAll(async () => {
    authService = {
      generateCaptcha: jest.fn().mockResolvedValue(Result.ok({ captchaEnabled: false, uuid: '', img: '' })),
      getTenantList: jest.fn().mockResolvedValue(Result.ok({ tenantEnabled: true, voList: [] })),
      login: jest.fn(),
      sendAdminLoginCode: jest.fn().mockImplementation(async () => {
        observedTenantId = TenantContext.getTenantId();
        return Result.ok(null);
      }),
      loginBySms: jest.fn(),
      sendAdminResetCode: jest.fn().mockResolvedValue(Result.ok(null)),
      resetPasswordBySms: jest.fn().mockResolvedValue(Result.ok(null)),
      register: jest.fn().mockResolvedValue(Result.fail(ResponseCode.OPERATION_FAILED, '管理员账号不支持公开自助注册')),
      logout: jest.fn().mockResolvedValue(Result.ok()),
    };
    redisService = {
      del: jest.fn(),
    };
    tokenService = {
      decodePayload: jest.fn(),
      generateTokenPair: jest.fn(),
      refreshToken: jest.fn(),
    };
    accountLockService = {
      checkAccountLocked: jest.fn().mockResolvedValue(undefined),
      recordLoginFail: jest.fn(),
      clearFailCount: jest.fn().mockResolvedValue(undefined),
    };

    const moduleFixture = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: RedisService, useValue: redisService },
        { provide: CryptoService, useValue: { getPublicKey: jest.fn().mockReturnValue('public-key') } },
        { provide: TokenService, useValue: tokenService },
        { provide: AccountLockService, useValue: accountLockService },
        { provide: SocialAuthService, useValue: { handleCallback: jest.fn() } },
        { provide: UserService, useValue: { loginByUserId: jest.fn() } },
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
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    observedTenantId = undefined;
    authService.sendAdminLoginCode.mockImplementation(async () => {
      observedTenantId = TenantContext.getTenantId();
      return Result.ok(null);
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('uses tenant-id header over a spoofed tenantId body on login code requests', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/send-login-code')
      .set('tenant-id', 'TENANT_HEADER')
      .send({ mobile: '13800138000', tenantId: 'TENANT_BODY' })
      .expect(200);

    expect(observedTenantId).toBe('TENANT_HEADER');
    expect(authService.sendAdminLoginCode).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: '13800138000',
        tenantId: 'TENANT_BODY',
      }),
    );
  });

  it('rejects invalid login-code mobile before calling AuthService', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/send-login-code')
      .set('tenant-id', '000000')
      .send({ mobile: '123' })
      .expect(400);

    expect(authService.sendAdminLoginCode).not.toHaveBeenCalled();
  });

  it('records a tenant-scoped login failure and does not issue token pairs', async () => {
    authService.login.mockResolvedValue(Result.fail(ResponseCode.PASSWORD_ERROR, '密码错误'));
    accountLockService.recordLoginFail.mockResolvedValue(3);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('tenant-id', 'TENANT_A')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe(ResponseCode.PASSWORD_ERROR);
        expect(body.msg).toContain('还可尝试3次');
      });

    expect(accountLockService.checkAccountLocked).toHaveBeenCalledWith('TENANT_A', 'admin');
    expect(accountLockService.recordLoginFail).toHaveBeenCalledWith('TENANT_A', 'admin');
    expect(accountLockService.clearFailCount).not.toHaveBeenCalled();
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('clears tenant-scoped login failures and returns a token pair after password login', async () => {
    authService.login.mockResolvedValue(Result.ok({ token: 'legacy-token' }));
    tokenService.decodePayload.mockReturnValue({ uuid: 'session-uuid', userId: 2 });
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessExpireIn: 3600,
      refreshExpireIn: 7200,
    });

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('tenant-id', 'TENANT_A')
      .send({ username: 'admin', password: 'Strong123', clientId: 'pc' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe(200);
        expect(body.data).toMatchObject({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expire_in: 3600,
          refresh_expire_in: 7200,
          client_id: 'pc',
        });
      });

    expect(accountLockService.clearFailCount).toHaveBeenCalledWith('TENANT_A', 'admin');
    expect(accountLockService.recordLoginFail).not.toHaveBeenCalled();
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith(2, 'session-uuid');
  });

  it('does not generate token pairs when SMS login service rejects the code', async () => {
    authService.loginBySms.mockResolvedValue(Result.fail(ResponseCode.PARAM_INVALID, '验证码错误或已失效'));

    await request(app.getHttpServer())
      .post('/api/auth/login-by-sms')
      .set('tenant-id', '000000')
      .send({ mobile: '13800138000', code: '000000' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe(ResponseCode.PARAM_INVALID);
      });

    expect(tokenService.decodePayload).not.toHaveBeenCalled();
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rejects an empty refresh token before calling TokenService', async () => {
    await request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken: '' }).expect(400);

    expect(tokenService.refreshToken).not.toHaveBeenCalled();
  });

  it('returns business code when refresh token points to a missing Redis session', async () => {
    tokenService.refreshToken.mockRejectedValue(
      new BusinessException(ResponseCode.UNAUTHORIZED, '会话已失效，请重新登录'),
    );

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'orphan-refresh-token' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.code).toBe(ResponseCode.UNAUTHORIZED);
        expect(body.msg).toBe('会话已失效，请重新登录');
      });
  });

  it('returns a new token pair for a valid refresh token', async () => {
    tokenService.refreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      accessExpireIn: 3600,
      refreshExpireIn: 7200,
    });

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'valid-refresh-token' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toMatchObject({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expire_in: 3600,
          refresh_expire_in: 7200,
        });
      });
  });

  it('treats logout without a user token as an idempotent no-op for Redis deletion', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(200);

    expect(redisService.del).not.toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalled();
  });
});
