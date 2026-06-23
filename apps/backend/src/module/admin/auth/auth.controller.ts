import { Controller, Get, Post, Body, HttpCode, Logger, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuthLoginDto, AuthRegisterDto, SocialLoginDto, WechatSocialCallbackDto } from './dto/auth.dto';
import {
  SendAdminLoginCodeDto,
  AdminLoginBySmsDto,
  SendAdminResetCodeDto,
  AdminResetPasswordDto,
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
} from './dto';
import { LoginTokenVo, CaptchaCodeVo, LoginTenantVo } from './vo/auth.vo';
import { Result, ResponseCode } from 'src/common/response';
import { CacheEnum } from 'src/common/enum/index';
import { RedisService } from 'src/module/common/redis/redis.service';
import { ClientInfo, ClientInfoDto } from 'src/common/decorators/common.decorator';
import { NotRequireAuth, User, UserDto } from 'src/module/admin/system/user/user.decorator';
import { Api } from 'src/common/decorators/api.decorator';
import { TenantContext, IgnoreTenant } from 'src/common/tenant';
import { CryptoService } from 'src/common/crypto';
import { TokenService } from './services/token.service';
import { AccountLockService } from './services/account-lock.service';
import { SocialAuthService, SocialSource } from './services/social-auth.service';
import { UserService } from '../system/user/user.service';
import { GenerateUUID } from 'src/common/utils';

/**
 * 认证控制器 - 匹配 Soybean 前端 API
 *
 * 路由前缀: /auth
 * 对应前端: src/service/api/auth.ts
 */
@ApiTags('认证模块')
@Controller('auth')
@ApiBearerAuth('Authorization')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly redisService: RedisService,
    private readonly cryptoService: CryptoService,
    private readonly tokenService: TokenService,
    private readonly accountLockService: AccountLockService,
    private readonly socialAuthService: SocialAuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * 获取加密公钥
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取加密公钥', description: '获取RSA公钥用于数据加密', security: false })
  @Get('publicKey')
  @NotRequireAuth()
  async getPublicKey(): Promise<Result> {
    const publicKey = this.cryptoService.getPublicKey();
    return Result.ok({ publicKey });
  }

  /**
   * 获取租户列表
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取租户列表', description: '获取系统中所有可用的租户列表', security: false, type: LoginTenantVo })
  @Get('tenant/list')
  @NotRequireAuth()
  @IgnoreTenant()
  async getTenantList(): Promise<Result> {
    return this.authService.getTenantList();
  }

  /**
   * 获取验证码
   *
   * @sloCategory list
   * @sloLatency P99 < 1000ms
   * @sloAvailability 99.5%
   */
  @Api({ summary: '获取验证码', description: '获取登录/注册所需的图形验证码', security: false, type: CaptchaCodeVo })
  @Get('code')
  @NotRequireAuth()
  async getCaptchaCode(): Promise<Result> {
    return this.authService.generateCaptcha();
  }

  /**
   * 用户登录
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({
    summary: '用户登录',
    description: '用户登录接口，支持租户、验证码验证',
    body: AuthLoginDto,
    security: false,
    type: LoginTokenVo,
  })
  @Post('login')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async login(
    @Body() loginDto: AuthLoginDto,
    @ClientInfo() clientInfo: ClientInfoDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || loginDto.tenantId || TenantContext.SUPER_TENANT_ID;

    this.logger.log(`用户登录: ${loginDto.username}, 租户: ${tenantId}`);

    const loginData: LoginDto = {
      userName: loginDto.username,
      password: loginDto.password,
      code: loginDto.code,
      uuid: loginDto.uuid,
    };

    return TenantContext.run({ tenantId }, async () => {
      await this.accountLockService.checkAccountLocked(tenantId, loginDto.username);

      const result = (await this.authService.login(loginData, clientInfo)) as Result<{ token?: string }>;

      if (result.code !== 200 || !result.data?.token) {
        const remaining = await this.accountLockService.recordLoginFail(tenantId, loginDto.username);
        if (remaining > 0) {
          return Result.fail(result.code, `${result.msg}，还可尝试${remaining}次`);
        }
        return result;
      }

      await this.accountLockService.clearFailCount(tenantId, loginDto.username);

      const decoded = this.tokenService.decodePayload(result.data.token);
      if (!decoded?.uuid || !decoded?.userId) {
        return result;
      }

      const tokenPair = this.tokenService.generateTokenPair(decoded.userId, decoded.uuid);

      const loginToken: LoginTokenVo = {
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
        expire_in: tokenPair.accessExpireIn,
        refresh_expire_in: tokenPair.refreshExpireIn,
        client_id: loginDto.clientId || 'pc',
        scope: '',
        openid: '',
      };

      return Result.ok(loginToken);
    });
  }

  /**
   * 发送管理员短信登录验证码
   */
  @Api({ summary: '发送管理员短信登录验证码', description: '仅已向系统登记手机号的管理员会收到短信', security: false })
  @Post('send-login-code')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async sendAdminLoginCode(
    @Body() dto: SendAdminLoginCodeDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || dto.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => this.authService.sendAdminLoginCode(dto));
  }

  /**
   * 管理员短信验证码登录
   */
  @Api({
    summary: '管理员短信登录',
    description: '使用短信验证码登录（仅限已存在管理员）',
    security: false,
    type: LoginTokenVo,
  })
  @Post('login-by-sms')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async loginBySms(
    @Body() dto: AdminLoginBySmsDto,
    @ClientInfo() clientInfo: ClientInfoDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || dto.tenantId || TenantContext.SUPER_TENANT_ID;

    return TenantContext.run({ tenantId }, async () => {
      const result = (await this.authService.loginBySms(dto, clientInfo)) as Result<{ token?: string }>;

      if (result.code !== 200 || !result.data?.token) {
        return result;
      }

      const decoded = this.tokenService.decodePayload(result.data.token);
      if (!decoded?.uuid || !decoded?.userId) {
        return result;
      }

      const tokenPair = this.tokenService.generateTokenPair(decoded.userId, decoded.uuid);

      const loginToken: LoginTokenVo = {
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
        expire_in: tokenPair.accessExpireIn,
        refresh_expire_in: tokenPair.refreshExpireIn,
        client_id: dto.clientId || 'pc',
        scope: '',
        openid: '',
      };

      return Result.ok(loginToken);
    });
  }

  /**
   * 发送管理员忘记密码短信验证码
   */
  @Api({ summary: '发送管理员重置密码验证码', security: false })
  @Post('send-reset-code')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async sendAdminResetCode(
    @Body() dto: SendAdminResetCodeDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || dto.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => this.authService.sendAdminResetCode(dto));
  }

  /**
   * 管理员通过短信重置密码
   */
  @Api({ summary: '管理员短信重置密码', description: '验证码校验通过后设置新密码，不创建新账号', security: false })
  @Post('reset-password')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async resetPasswordBySms(
    @Body() dto: AdminResetPasswordDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || dto.tenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () => this.authService.resetPasswordBySms(dto));
  }

  /**
   * 微信扫码/绑定回调占位（明确返回未接入，避免空响应）
   */
  @Api({ summary: '微信扫码登录/绑定回调（占位）', security: false })
  @Post('social/wechat/callback')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async wechatSocialCallback(
    @Body() _body: WechatSocialCallbackDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || TenantContext.SUPER_TENANT_ID;
    return TenantContext.run({ tenantId }, async () =>
      Result.fail(
        ResponseCode.NOT_IMPLEMENTED,
        '微信开放平台扫码登录尚未接入：请配置应用凭证并绑定管理员后重试，或使用账号密码、短信验证码登录',
      ),
    );
  }

  /**
   * 刷新令牌
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({
    summary: '刷新令牌',
    description: '使用 refresh_token 获取新的令牌对',
    body: RefreshTokenDto,
    security: false,
    type: LoginTokenVo,
  })
  @Post('refresh')
  @HttpCode(200)
  @NotRequireAuth()
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<Result> {
    const tokenPair = await this.tokenService.refreshToken(dto.refreshToken);

    const loginToken: LoginTokenVo = {
      access_token: tokenPair.accessToken,
      refresh_token: tokenPair.refreshToken,
      expire_in: tokenPair.accessExpireIn,
      refresh_expire_in: tokenPair.refreshExpireIn,
    };

    return Result.ok(loginToken);
  }

  /**
   * 用户注册
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '用户注册', description: '新用户注册接口', body: AuthRegisterDto, security: false })
  @Post('register')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async register(@Body() registerDto: AuthRegisterDto, @Headers('tenant-id') headerTenantId?: string): Promise<Result> {
    if (registerDto.password !== registerDto.confirmPassword) {
      return Result.fail(400, '两次输入的密码不一致');
    }

    const tenantId = headerTenantId || registerDto.tenantId || TenantContext.SUPER_TENANT_ID;

    const registerData: RegisterDto = {
      userName: registerDto.username,
      password: registerDto.password,
      code: registerDto.code,
      uuid: registerDto.uuid,
    };

    return TenantContext.run({ tenantId }, async () => {
      return this.authService.register(registerData);
    });
  }

  /**
   * 退出登录
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({ summary: '退出登录', description: '退出当前登录状态' })
  @NotRequireAuth()
  @Post('logout')
  @HttpCode(200)
  async logout(@User() user: UserDto, @ClientInfo() clientInfo: ClientInfoDto): Promise<Result> {
    if (user?.token) {
      await this.redisService.del(`${CacheEnum.LOGIN_TOKEN_KEY}${user.token}`);
    }
    return this.authService.logout(clientInfo);
  }

  /**
   * 社交登录回调
   *
   * @sloCategory core
   * @sloLatency P99 < 500ms
   * @sloAvailability 99.9%
   */
  @Api({
    summary: '社交登录回调',
    description: '第三方社交平台登录回调处理（GitHub OAuth）',
    body: SocialLoginDto,
    security: false,
    type: LoginTokenVo,
  })
  @Post('social/callback')
  @HttpCode(200)
  @NotRequireAuth()
  @ApiHeader({ name: 'tenant-id', description: '租户ID', required: false })
  async socialCallback(
    @Body() socialDto: SocialLoginDto,
    @ClientInfo() clientInfo: ClientInfoDto,
    @Headers('tenant-id') headerTenantId?: string,
  ): Promise<Result> {
    const tenantId = headerTenantId || socialDto.tenantId || TenantContext.SUPER_TENANT_ID;

    return TenantContext.run({ tenantId }, async () => {
      const { userId, socialUser } = await this.socialAuthService.handleCallback({
        source: socialDto.source as SocialSource,
        code: socialDto.socialCode,
        state: socialDto.socialState,
        tenantId,
      });

      if (!userId) {
        // 未绑定：返回社交用户信息，前端可引导绑定或自动注册
        return Result.ok({
          bound: false,
          socialUser: { nickname: socialUser.nickname, avatar: socialUser.avatar, openid: socialUser.openid },
          source: socialDto.source,
        });
      }

      // 已绑定：直接生成 Token 登录
      const uuid = GenerateUUID();
      const tokenPair = this.tokenService.generateTokenPair(userId, uuid);

      // 存储会话到 Redis（复用 UserService 的 loginByUserId 逻辑）
      await this.userService.loginByUserId(userId, uuid, clientInfo);

      const loginToken: LoginTokenVo = {
        access_token: tokenPair.accessToken,
        refresh_token: tokenPair.refreshToken,
        expire_in: tokenPair.accessExpireIn,
        refresh_expire_in: tokenPair.refreshExpireIn,
        client_id: socialDto.clientId || 'pc',
      };

      return Result.ok({ bound: true, ...loginToken });
    });
  }
}
