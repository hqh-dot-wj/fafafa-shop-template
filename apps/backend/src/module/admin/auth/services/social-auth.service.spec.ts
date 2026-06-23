import { SocialAuthService } from './social-auth.service';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { AppConfigService } from 'src/config/app-config.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';

const createJsonResponse = (payload: unknown, init: Partial<Response> = {}): Response =>
  ({
    ok: true,
    status: 200,
    json: async () => payload,
    ...init,
  }) as Response;

const createPrismaMock = () => ({
  sysUserSocial: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
});

const createTenantHelperMock = () => ({
  readWhereForDelegate: (_delegateKey: string, w?: object) => ({ ...(w ?? {}) }),
});

const createRedisServiceMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

const createConfigMock = () => ({
  social: {
    github: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
    },
  },
});

describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let prisma: ReturnType<typeof createPrismaMock>;
  let redisService: ReturnType<typeof createRedisServiceMock>;
  let config: ReturnType<typeof createConfigMock>;
  let tenantHelper: ReturnType<typeof createTenantHelperMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrismaMock();
    redisService = createRedisServiceMock();
    config = createConfigMock();
    tenantHelper = createTenantHelperMock();
    service = new SocialAuthService(
      prisma as unknown as PrismaService,
      redisService as unknown as RedisService,
      config as unknown as AppConfigService,
      tenantHelper as unknown as TenantHelper,
    );
  });

  describe('generateState', () => {
    // R-FLOW-SOCIAL-01: 生成 state 并存入 Redis
    it('Given source, When generateState, Then return UUID and store in Redis', async () => {
      const state = await service.generateState('github');

      expect(state).toBeTruthy();
      expect(typeof state).toBe('string');
      expect(redisService.set).toHaveBeenCalledWith(expect.stringContaining('social_state:'), 'github', 5 * 60 * 1000);
    });

    it('Given wechat source, When generateState, Then store wechat in Redis', async () => {
      const state = await service.generateState('wechat');
      expect(state).toBeTruthy();
      expect(redisService.set).toHaveBeenCalledWith(expect.stringContaining('social_state:'), 'wechat', 5 * 60 * 1000);
    });
  });

  describe('handleCallback', () => {
    // R-PRE-SOCIAL-01: 缺少 state 参数
    it('Given no state, When handleCallback, Then throw BAD_REQUEST', async () => {
      await expect(
        service.handleCallback({
          source: 'github',
          code: 'test-code',
          state: undefined,
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);

      try {
        await service.handleCallback({
          source: 'github',
          code: 'test-code',
          state: undefined,
          tenantId: '000000',
        });
      } catch (e) {
        const ex = e as BusinessException;
        expect(ex.getResponse().msg).toContain('state');
      }
    });

    // R-PRE-SOCIAL-02: state 不匹配
    it('Given mismatched state, When handleCallback, Then throw BAD_REQUEST', async () => {
      redisService.get.mockResolvedValue('wechat'); // stored source doesn't match

      await expect(
        service.handleCallback({
          source: 'github',
          code: 'test-code',
          state: 'some-state',
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);

      redisService.get.mockResolvedValue('wechat');
      try {
        await service.handleCallback({
          source: 'github',
          code: 'test-code',
          state: 'some-state',
          tenantId: '000000',
        });
      } catch (e) {
        const ex = e as BusinessException;
        expect(ex.getResponse().msg).toContain('state 验证失败');
      }
    });

    it('Given state not in Redis, When handleCallback, Then throw BAD_REQUEST', async () => {
      redisService.get.mockResolvedValue(null);

      await expect(
        service.handleCallback({
          source: 'github',
          code: 'test-code',
          state: 'expired-state',
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('Given valid wechat state, When handleCallback, Then throw NOT_IMPLEMENTED', async () => {
      redisService.get.mockResolvedValueOnce('wechat');
      await expect(
        service.handleCallback({
          source: 'wechat',
          code: 'wx-code',
          state: 'valid-state',
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);

      redisService.get.mockResolvedValueOnce('wechat');
      try {
        await service.handleCallback({
          source: 'wechat',
          code: 'wx-code',
          state: 'valid-state-2',
          tenantId: '000000',
        });
      } catch (e) {
        const ex = e as BusinessException;
        expect(ex.getResponse()).toEqual(
          expect.objectContaining({
            code: ResponseCode.NOT_IMPLEMENTED,
            msg: expect.stringContaining('微信'),
          }),
        );
      }
    });

    // R-PRE-SOCIAL-03: 不支持的社交平台
    it('Given unsupported source, When handleCallback, Then throw BAD_REQUEST', async () => {
      // Valid state first
      redisService.get.mockResolvedValue('unknown_platform');

      // Create service without github config to test unsupported platform
      const noGithubConfig = { social: {} };
      const svc = new SocialAuthService(
        prisma as unknown as PrismaService,
        redisService as unknown as RedisService,
        noGithubConfig as AppConfigService,
        tenantHelper as unknown as TenantHelper,
      );

      redisService.get.mockResolvedValue('unknown_platform');
      await expect(
        svc.handleCallback({
          source: 'unknown_platform' as never,
          code: 'test-code',
          state: 'valid-state',
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);
    });

    // R-FLOW-SOCIAL-02: 已绑定用户返回 userId
    it('Given valid callback with bound user, When handleCallback, Then return userId', async () => {
      // Mock state validation
      redisService.get.mockResolvedValueOnce('github'); // state matches

      // Mock GitHub API via strategy — we need to mock fetch
      const mockFetchResponses = [
        // Token exchange
        createJsonResponse({ access_token: 'gh-token' }),
        // User info
        createJsonResponse({ id: 12345, login: 'testuser', avatar_url: 'https://avatar.url', name: 'Test User' }),
      ];
      let fetchCallCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(async () => mockFetchResponses[fetchCallCount++]);

      // Mock DB lookup — user is bound
      prisma.sysUserSocial.findFirst.mockResolvedValue({ userId: 42 });

      const result = await service.handleCallback({
        source: 'github',
        code: 'valid-code',
        state: 'valid-state',
        tenantId: '000000',
      });

      expect(result.userId).toBe(42);
      expect(result.socialUser.openid).toBe('12345');
      expect(result.socialUser.nickname).toBe('Test User');

      // state should be consumed (deleted)
      expect(redisService.del).toHaveBeenCalled();
    });

    // R-FLOW-SOCIAL-03: 未绑定用户返回 null userId
    it('Given valid callback with unbound user, When handleCallback, Then return null userId', async () => {
      redisService.get.mockResolvedValueOnce('github');

      const mockFetchResponses = [
        createJsonResponse({ access_token: 'gh-token' }),
        createJsonResponse({ id: 99999, login: 'newuser', avatar_url: '', name: 'New User' }),
      ];
      let fetchCallCount = 0;
      jest.spyOn(globalThis, 'fetch').mockImplementation(async () => mockFetchResponses[fetchCallCount++]);

      prisma.sysUserSocial.findFirst.mockResolvedValue(null);

      const result = await service.handleCallback({
        source: 'github',
        code: 'valid-code',
        state: 'valid-state',
        tenantId: '000000',
      });

      expect(result.userId).toBeNull();
      expect(result.socialUser.openid).toBe('99999');
    });

    // R-FLOW-SOCIAL-05: 第三方 API 失败
    it('Given third-party API failure, When handleCallback, Then throw EXTERNAL_SERVICE_ERROR', async () => {
      redisService.get.mockResolvedValueOnce('github');

      jest.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse({ error: 'bad_verification_code' }));

      await expect(
        service.handleCallback({
          source: 'github',
          code: 'invalid-code',
          state: 'valid-state',
          tenantId: '000000',
        }),
      ).rejects.toThrow(BusinessException);
    });

    it('Given GitHub HTTP failure, When handleCallback, Then wrap as EXTERNAL_SERVICE_ERROR', async () => {
      redisService.get.mockResolvedValueOnce('github');

      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(createJsonResponse({ message: 'bad gateway' }, { ok: false, status: 502 }));

      await expect(
        service.handleCallback({
          source: 'github',
          code: 'invalid-code',
          state: 'valid-state',
          tenantId: '000000',
        }),
      ).rejects.toMatchObject({
        errorCode: ResponseCode.EXTERNAL_SERVICE_ERROR,
      });
    });
  });

  describe('bindSocialUser', () => {
    // R-FLOW-SOCIAL-04: 绑定社交账号
    it('Given userId+socialUser, When bindSocialUser, Then upsert record in DB', async () => {
      prisma.sysUserSocial.upsert.mockResolvedValue({});

      await service.bindSocialUser(
        42,
        'github',
        { openid: '12345', nickname: 'testuser', avatar: 'https://avatar.url' },
        '000000',
      );

      expect(prisma.sysUserSocial.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source_openid_tenantId: { source: 'github', openid: '12345', tenantId: '000000' },
          },
          create: expect.objectContaining({
            userId: 42,
            source: 'github',
            openid: '12345',
          }),
          update: expect.objectContaining({
            userId: 42,
            nickname: 'testuser',
          }),
        }),
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
