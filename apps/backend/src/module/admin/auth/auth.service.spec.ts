import { AuthService } from './auth.service';
import { StatusEnum, CacheEnum } from 'src/common/enum';
import { ResponseCode } from 'src/common/response';

const createUserServiceMock = () => ({
  login: jest.fn(),
  register: jest.fn(),
  issuePasswordlessLoginToken: jest.fn(),
  resetPwd: jest.fn(),
});

const createLoginlogServiceMock = () => ({
  create: jest.fn(),
});

const createAxiosServiceMock = () => ({
  getIpAddress: jest.fn().mockResolvedValue('本地'),
});

const createRedisServiceMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
});

const createSysConfigServiceMock = () => ({
  getSystemConfigValue: jest.fn(),
});

const createConfigMock = () => ({
  tenant: { enabled: true },
});

const createPrismaMock = () => ({
  sysTenant: {
    findMany: jest.fn(),
  },
  sysUser: {
    findFirst: jest.fn(),
  },
});

const createTenantHelperMock = () => ({
  readWhereForDelegate: (_delegateKey: string, w?: object) => ({ ...(w ?? {}) }),
});

const createSmsCodeServiceMock = () => ({
  sendCode: jest.fn(),
  verifyAndConsume: jest.fn(),
});

const createPasswordResetServiceMock = () => ({
  assertAdminResetCodeConsumed: jest.fn(),
  assertNewPasswordPlain: jest.fn(),
});

describe('AuthService', () => {
  let service: AuthService;
  let userService: ReturnType<typeof createUserServiceMock>;
  let loginlogService: ReturnType<typeof createLoginlogServiceMock>;
  let axiosService: ReturnType<typeof createAxiosServiceMock>;
  let redisService: ReturnType<typeof createRedisServiceMock>;
  let sysConfigService: ReturnType<typeof createSysConfigServiceMock>;
  let config: ReturnType<typeof createConfigMock>;
  let prisma: ReturnType<typeof createPrismaMock>;
  let tenantHelper: ReturnType<typeof createTenantHelperMock>;
  let smsCodeService: ReturnType<typeof createSmsCodeServiceMock>;
  let passwordResetService: ReturnType<typeof createPasswordResetServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    userService = createUserServiceMock();
    loginlogService = createLoginlogServiceMock();
    axiosService = createAxiosServiceMock();
    redisService = createRedisServiceMock();
    sysConfigService = createSysConfigServiceMock();
    config = createConfigMock();
    prisma = createPrismaMock();
    tenantHelper = createTenantHelperMock();
    smsCodeService = createSmsCodeServiceMock();
    passwordResetService = createPasswordResetServiceMock();

    service = new AuthService(
      userService,
      loginlogService,
      axiosService,
      redisService,
      sysConfigService,
      config,
      prisma,
      tenantHelper,
      smsCodeService,
      passwordResetService,
    );
  });

  describe('generateCaptcha', () => {
    // R-FLOW-CAPTCHA-01: 验证码开启时生成图片
    it('Given captchaEnabled=true, When generateCaptcha, Then return img+uuid', async () => {
      sysConfigService.getSystemConfigValue.mockResolvedValue('true');

      const result = await service.generateCaptcha();

      expect(result.code).toBe(200);
      expect(result.data.captchaEnabled).toBe(true);
      expect(result.data.img).toBeTruthy();
      expect(result.data.uuid).toBeTruthy();
      // 验证 Redis 存储
      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining(CacheEnum.CAPTCHA_CODE_KEY),
        expect.any(String),
        expect.any(Number),
      );
    });

    // R-FLOW-CAPTCHA-02: 验证码关闭时返回空
    it('Given captchaEnabled=false, When generateCaptcha, Then return empty img', async () => {
      sysConfigService.getSystemConfigValue.mockResolvedValue('false');

      const result = await service.generateCaptcha();

      expect(result.code).toBe(200);
      expect(result.data.captchaEnabled).toBe(false);
      expect(result.data.img).toBe('');
      expect(result.data.uuid).toBe('');
      expect(redisService.set).not.toHaveBeenCalled();
    });

    // R-FLOW-CAPTCHA-03: 生成异常时返回错误
    it('Given captcha generation error, When generateCaptcha, Then return error result', async () => {
      sysConfigService.getSystemConfigValue.mockRejectedValue(new Error('config error'));

      // generateCaptcha catches errors internally
      // When getSystemConfigValue throws, captchaEnabled defaults to false
      // Let's test the case where createMath throws
      sysConfigService.getSystemConfigValue.mockResolvedValue('true');

      // Mock createMath to throw — we can't easily mock it since it's imported directly
      // Instead, test that the method handles Redis errors gracefully
      redisService.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await service.generateCaptcha();

      expect(result.code).toBe(ResponseCode.INTERNAL_SERVER_ERROR);
      expect(result.msg).toContain('验证码');
    });
  });

  describe('getTenantList', () => {
    // R-FLOW-TENANT-01: 多租户开启时返回租户列表
    it('Given tenantEnabled=true, When getTenantList, Then return tenant list from DB', async () => {
      prisma.sysTenant.findMany.mockResolvedValue([
        { tenantId: '000000', companyName: '默认租户', domain: '' },
        { tenantId: '000001', companyName: '测试租户', domain: 'test.com' },
      ]);

      const result = await service.getTenantList();

      expect(result.code).toBe(200);
      expect(result.data.tenantEnabled).toBe(true);
      expect(result.data.voList).toHaveLength(2);
      expect(result.data.voList[0].companyName).toBe('默认租户');
    });

    // R-FLOW-TENANT-02: 多租户关闭时返回空列表
    it('Given tenantEnabled=false, When getTenantList, Then return empty list', async () => {
      config.tenant.enabled = false;

      const result = await service.getTenantList();

      expect(result.code).toBe(200);
      expect(result.data.tenantEnabled).toBe(false);
      expect(result.data.voList).toEqual([]);
      expect(prisma.sysTenant.findMany).not.toHaveBeenCalled();
    });

    // R-FLOW-TENANT-03: 数据库异常时返回默认租户
    it('Given DB error, When getTenantList, Then return default tenant', async () => {
      prisma.sysTenant.findMany.mockRejectedValue(new Error('Table not found'));

      const result = await service.getTenantList();

      expect(result.code).toBe(200);
      expect(result.data.voList).toHaveLength(1);
      expect(result.data.voList[0].tenantId).toBe('000000');
      expect(result.data.voList[0].companyName).toBe('默认租户');
    });
  });

  describe('register', () => {
    it('rejects public self-registration for admin', async () => {
      const result = await service.register({ userName: 'x', password: 'y' } as any);
      expect(result.code).toBe(ResponseCode.OPERATION_FAILED);
      expect(result.msg).toContain('不支持公开自助注册');
      expect(userService.register).not.toHaveBeenCalled();
    });
  });

  describe('sendAdminLoginCode', () => {
    it('does not send SMS when no admin matches mobile', async () => {
      prisma.sysUser.findFirst.mockResolvedValue(null);
      const result = await service.sendAdminLoginCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).not.toHaveBeenCalled();
    });

    it('sends SMS when admin exists and is active', async () => {
      prisma.sysUser.findFirst.mockResolvedValue({
        userId: 2,
        phonenumber: '13800138000',
        status: StatusEnum.NORMAL,
      });
      const result = await service.sendAdminLoginCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).toHaveBeenCalledWith('13800138000', expect.any(String), expect.any(String));
    });

    it('does not send SMS when admin is stopped', async () => {
      prisma.sysUser.findFirst.mockResolvedValue({
        userId: 2,
        phonenumber: '13800138000',
        status: StatusEnum.STOP,
      });
      const result = await service.sendAdminLoginCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).not.toHaveBeenCalled();
    });
  });

  describe('loginBySms', () => {
    it('returns PARAM_INVALID when SMS code is wrong or expired', async () => {
      smsCodeService.verifyAndConsume.mockResolvedValue(false);
      const result = await service.loginBySms({ mobile: '13800138000', code: '000000' }, {
        ipaddr: '127.0.0.1',
      } as any);
      expect(result.code).toBe(ResponseCode.PARAM_INVALID);
      expect(userService.issuePasswordlessLoginToken).not.toHaveBeenCalled();
    });

    it('issues token when code is valid and admin exists', async () => {
      smsCodeService.verifyAndConsume.mockResolvedValue(true);
      prisma.sysUser.findFirst.mockResolvedValue({
        userId: 2,
        phonenumber: '13800138000',
        status: StatusEnum.NORMAL,
      });
      userService.issuePasswordlessLoginToken.mockResolvedValue({ code: 200, data: { token: 'jwt' } });

      const result = await service.loginBySms({ mobile: '13800138000', code: '123456' }, {
        ipaddr: '127.0.0.1',
      } as any);

      expect(result.code).toBe(200);
      expect(userService.issuePasswordlessLoginToken).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ ipaddr: '127.0.0.1' }),
      );
    });

    it('returns PARAM_INVALID when code is valid but admin not found', async () => {
      smsCodeService.verifyAndConsume.mockResolvedValue(true);
      prisma.sysUser.findFirst.mockResolvedValue(null);

      const result = await service.loginBySms({ mobile: '13800138000', code: '123456' }, {
        ipaddr: '127.0.0.1',
      } as any);

      expect(result.code).toBe(ResponseCode.PARAM_INVALID);
    });
  });

  describe('sendAdminResetCode', () => {
    it('sends SMS when admin exists and is not built-in', async () => {
      prisma.sysUser.findFirst.mockResolvedValue({
        userId: 2,
        phonenumber: '13800138000',
        status: StatusEnum.NORMAL,
      });
      const result = await service.sendAdminResetCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).toHaveBeenCalled();
    });

    it('does not send SMS when admin not found', async () => {
      prisma.sysUser.findFirst.mockResolvedValue(null);
      const result = await service.sendAdminResetCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).not.toHaveBeenCalled();
    });

    it('does not send SMS for built-in admin (userId=1)', async () => {
      prisma.sysUser.findFirst.mockResolvedValue({
        userId: 1,
        phonenumber: '13800138000',
        status: StatusEnum.NORMAL,
      });
      const result = await service.sendAdminResetCode({ mobile: '13800138000' });
      expect(result.code).toBe(200);
      expect(smsCodeService.sendCode).not.toHaveBeenCalled();
    });
  });

  describe('resetPasswordBySms', () => {
    it('updates password via UserService after SMS reset flow', async () => {
      passwordResetService.assertAdminResetCodeConsumed.mockResolvedValue(undefined);
      passwordResetService.assertNewPasswordPlain.mockImplementation(() => undefined);
      prisma.sysUser.findFirst.mockResolvedValue({ userId: 2, phonenumber: '13800138000' });
      userService.resetPwd.mockResolvedValue({ code: 200 } as any);

      const result = await service.resetPasswordBySms({
        mobile: '13800138000',
        code: '123456',
        newPassword: 'Str0ng!pass',
      });

      expect(result.code).toBe(200);
      expect(userService.resetPwd).toHaveBeenCalledWith({ userId: 2, password: 'Str0ng!pass' });
    });

    it('rejects reset for built-in admin (userId=1)', async () => {
      passwordResetService.assertAdminResetCodeConsumed.mockResolvedValue(undefined);
      passwordResetService.assertNewPasswordPlain.mockImplementation(() => undefined);
      prisma.sysUser.findFirst.mockResolvedValue({ userId: 1, phonenumber: '13800138000' });

      const result = await service.resetPasswordBySms({
        mobile: '13800138000',
        code: '123456',
        newPassword: 'Str0ng!pass',
      });

      expect(result.code).toBe(ResponseCode.OPERATION_FAILED);
      expect(userService.resetPwd).not.toHaveBeenCalled();
    });
  });
});
