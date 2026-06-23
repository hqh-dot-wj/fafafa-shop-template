import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import type { AppPrismaTransactionClient } from 'src/prisma/prisma-tenant.types';
import { MemberStatus, Prisma, SocialPlatform, UmsMember } from '@prisma/client';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CheckLoginDto, ClientRegisterDto, BindPhoneDto } from './dto/auth.dto';
import { LoginOrRegisterBySmsDto, SendMemberLoginCodeDto } from './dto/sms-login.dto';
import { MemberPasswordLoginDto } from './dto/password-login.dto';
import { MemberResetPasswordDto, MemberSetPasswordDto, SendMemberResetCodeDto } from './dto/password-reset.dto';
import { MemberRefreshDto } from './dto/member-refresh.dto';
import { GenerateUUID } from 'src/common/utils';
import { CacheEnum } from 'src/common/enum';
import { Result } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response/response.interface';
import { ClientAuthStrategyFactory } from './strategies';
import { ActivityService } from 'src/module/marketing/activity/activity.service';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { AppConfigService } from 'src/config/app-config.service';
import { SmsCodeService } from 'src/module/auth-core/services/sms-code.service';
import { PasswordPolicyService } from 'src/module/auth-core/services/password-policy.service';
import { PasswordResetService } from 'src/module/auth-core/services/password-reset.service';
import { SmsVerificationScene } from 'src/module/auth-core/constants/sms-verification-scene.enum';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { parseMemberAvatarDataUrl } from './utils/member-avatar-data-url';

interface MemberDualTokens {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  refresh_expire_in: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly strategyFactory: ClientAuthStrategyFactory,
    private readonly activityService: ActivityService,
    private readonly tenantHelper: TenantHelper,
    private readonly appConfig: AppConfigService,
    private readonly smsCode: SmsCodeService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly passwordReset: PasswordResetService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 注册流程头像：优先使用 data URL 上传 OSS/本地；否则使用 userInfo.avatarUrl
   */
  private async resolveMemberAvatarUrl(dto: ClientRegisterDto): Promise<string> {
    const trimmed = dto.avatarImageBase64?.trim();
    if (trimmed) {
      const parsed = parseMemberAvatarDataUrl(trimmed);
      BusinessException.throwIf(!parsed, '头像数据无效或过大，请重新选择');
      const uploaded = await this.uploadService.uploadFromBuffer({
        buffer: parsed.buffer,
        originalName: parsed.fileName,
        mimeType: parsed.mimeType,
      });
      return uploaded.url;
    }
    return dto.userInfo?.avatarUrl?.trim() || '';
  }

  /**
   * 阶段二：静默登录检查
   * @param dto 登录检查参数
   * @param platform 客户端平台，默认 MP_MALL（向后兼容）
   */
  async checkLogin(dto: CheckLoginDto, platform: SocialPlatform = SocialPlatform.MP_MALL) {
    const strategy = this.strategyFactory.getStrategy(platform);

    const { openid } = await strategy.resolveIdentity(dto.code);

    const socialUser = await this.prisma.sysSocialUser.findFirst({
      where: { platform, openid },
      include: { member: true },
    });

    if (socialUser) {
      BusinessException.throwIf(socialUser.member?.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');

      const dual = await this.genDualToken(socialUser.member, platform);
      return Result.ok({
        isRegistered: true,
        ...this.dualTokenResponseFields(dual),
        userInfo: socialUser.member,
      });
    }

    return Result.ok({ isRegistered: false });
  }

  /**
   * 简化注册：仅需昵称头像 + referrerId（无需手机号）
   */
  async register(dto: ClientRegisterDto, platform: SocialPlatform = SocialPlatform.MP_MALL) {
    const strategy = this.strategyFactory.getStrategy(platform);

    const { openid, unionid, session_key } = await strategy.resolveIdentity(dto.loginCode);

    const existingSocial = await this.prisma.sysSocialUser.findFirst({
      where: { platform, openid },
      include: { member: true },
    });

    if (existingSocial?.member) {
      BusinessException.throwIf(existingSocial.member.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');
      const dual = await this.genDualToken(existingSocial.member, platform);
      return Result.ok({
        ...this.dualTokenResponseFields(dual),
        userInfo: existingSocial.member,
        isNew: false,
      });
    }

    const avatarUrl = await this.resolveMemberAvatarUrl(dto);

    const member = await this.prisma.$transaction(async (tx) => {
      const targetTenantId = await this.resolveTenantId(tx, dto.tenantId);
      const { finalParentId, finalIndirectParentId } = await this.resolveReferrer(tx, dto.referrerId, targetTenantId);

      const newMember = await tx.umsMember.create({
        data: {
          tenantId: targetTenantId,
          mobile: null,
          status: MemberStatus.NORMAL,
          nickname: dto.userInfo?.nickName || `微信用户_${openid.slice(-6)}`,
          avatar: avatarUrl,
          parentId: finalParentId,
          indirectParentId: finalIndirectParentId,
        },
      });

      await tx.sysSocialUser.create({
        data: {
          memberId: newMember.memberId,
          platform,
          openid,
          unionid,
          sessionKey: session_key,
          nickname: dto.userInfo?.nickName,
          avatar: avatarUrl || dto.userInfo?.avatarUrl,
        },
      });

      return newMember;
    });

    const dual = await this.genDualToken(member, platform);
    return Result.ok({
      ...this.dualTokenResponseFields(dual),
      userInfo: member,
      isNew: true,
    });
  }

  /**
   * 绑定手机号
   */
  async bindPhone(memberId: string, dto: BindPhoneDto, platform: SocialPlatform = SocialPlatform.MP_MALL) {
    const strategy = this.strategyFactory.getStrategy(platform);

    const phone = strategy.resolvePhone ? await strategy.resolvePhone(dto.phoneCode) : null;
    BusinessException.throwIf(!phone, '获取手机号失败');

    const existingMember = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { mobile: phone! }) as Prisma.UmsMemberWhereInput,
    });

    if (existingMember && existingMember.memberId !== memberId) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '该手机号已被其他账号绑定');
    }

    const updatedMember = await this.prisma.umsMember.update({
      where: { memberId },
      data: { mobile: phone },
    });

    this.activityService.onPhoneBound(memberId).catch(() => {});

    return Result.ok({ userInfo: updatedMember, message: '手机号绑定成功' });
  }

  /**
   * 手机号一键登录/注册 (兼容旧前端调用)
   */
  async registerMobile(
    dto: ClientRegisterDto & { phoneCode?: string },
    platform: SocialPlatform = SocialPlatform.MP_MALL,
  ) {
    const strategy = this.strategyFactory.getStrategy(platform);

    const { openid, unionid, session_key } = await strategy.resolveIdentity(dto.loginCode);

    const existingSocial = await this.prisma.sysSocialUser.findFirst({
      where: { platform, openid },
      include: { member: true },
    });

    if (existingSocial?.member) {
      BusinessException.throwIf(existingSocial.member.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');

      if (dto.phoneCode && !existingSocial.member.mobile && strategy.resolvePhone) {
        const phone = await strategy.resolvePhone(dto.phoneCode);
        if (phone) {
          await this.prisma.umsMember.update({
            where: { memberId: existingSocial.member.memberId },
            data: { mobile: phone },
          });
        }
      }

      const refreshed = await this.prisma.umsMember.findUnique({
        where: { memberId: existingSocial.member.memberId },
      });
      const dual = await this.genDualToken(refreshed!, platform);
      return Result.ok({
        ...this.dualTokenResponseFields(dual),
        userInfo: refreshed,
        isNew: false,
      });
    }

    let phone: string | null = null;
    if (dto.phoneCode && strategy.resolvePhone) {
      phone = await strategy.resolvePhone(dto.phoneCode);
    }

    const avatarUrl = await this.resolveMemberAvatarUrl(dto);

    const member = await this.prisma.$transaction(async (tx) => {
      const targetTenantId = await this.resolveTenantId(tx, dto.tenantId);
      const { finalParentId, finalIndirectParentId } = await this.resolveReferrer(tx, dto.referrerId, targetTenantId);

      const newMember = await tx.umsMember.create({
        data: {
          tenantId: targetTenantId,
          mobile: phone,
          status: MemberStatus.NORMAL,
          nickname: dto.userInfo?.nickName || `微信用户_${openid.slice(-6)}`,
          avatar: avatarUrl,
          parentId: finalParentId,
          indirectParentId: finalIndirectParentId,
        },
      });

      await tx.sysSocialUser.create({
        data: {
          memberId: newMember.memberId,
          platform,
          openid,
          unionid,
          sessionKey: session_key,
          nickname: dto.userInfo?.nickName,
          avatar: avatarUrl || dto.userInfo?.avatarUrl,
        },
      });

      return newMember;
    });

    const dual = await this.genDualToken(member, platform);
    return Result.ok({
      ...this.dualTokenResponseFields(dual),
      userInfo: member,
      isNew: true,
    });
  }

  /** 发送会员登录短信验证码 */
  async sendLoginCode(dto: SendMemberLoginCodeDto) {
    const tenantId = await this.resolveTenantId(this.prisma, dto.tenantId);
    await this.smsCode.sendCode(dto.mobile, SmsVerificationScene.MEMBER_LOGIN, tenantId);
    return Result.ok(null, '验证码已发送');
  }

  /** 短信验证码登录；若手机号未注册则自动注册 */
  async loginOrRegisterBySms(dto: LoginOrRegisterBySmsDto) {
    const tenantId = await this.resolveTenantId(this.prisma, dto.tenantId);
    const ok = await this.smsCode.verifyAndConsume(dto.mobile, SmsVerificationScene.MEMBER_LOGIN, tenantId, dto.code);
    BusinessException.throwIf(!ok, '验证码错误或已失效', ResponseCode.PARAM_INVALID);

    let member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { mobile: dto.mobile }) as Prisma.UmsMemberWhereInput,
    });

    let isNew = false;
    if (!member) {
      isNew = true;
      member = await this.prisma.$transaction(async (tx) => {
        const tid = await this.resolveTenantId(tx, dto.tenantId);
        const { finalParentId, finalIndirectParentId } = await this.resolveReferrer(tx, dto.referrerId, tid);
        return tx.umsMember.create({
          data: {
            tenantId: tid,
            mobile: dto.mobile,
            status: MemberStatus.NORMAL,
            nickname: `用户_${dto.mobile.slice(-4)}`,
            avatar: '',
            parentId: finalParentId,
            indirectParentId: finalIndirectParentId,
          },
        });
      });
    } else {
      BusinessException.throwIf(member.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');
    }

    const dual = await this.genDualToken(member, SocialPlatform.APP_MAIN);
    return Result.ok({
      ...this.dualTokenResponseFields(dual),
      userInfo: member,
      isNew,
    });
  }

  /** 密码登录（H5 等） */
  async passwordLogin(dto: MemberPasswordLoginDto) {
    await this.resolveTenantId(this.prisma, dto.tenantId);
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { mobile: dto.mobile }) as Prisma.UmsMemberWhereInput,
    });
    BusinessException.throwIf(!member, '账号或密码错误', ResponseCode.PASSWORD_ERROR);
    BusinessException.throwIf(member.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');
    BusinessException.throwIf(!member.password, '请先使用短信登录并设置密码', ResponseCode.PASSWORD_ERROR);

    const match = await bcrypt.compare(dto.password, member.password);
    BusinessException.throwIf(!match, '账号或密码错误', ResponseCode.PASSWORD_ERROR);

    const dual = await this.genDualToken(member, SocialPlatform.APP_MAIN);
    return Result.ok({
      ...this.dualTokenResponseFields(dual),
      userInfo: member,
    });
  }

  /** 发送忘记密码短信（仅已注册手机号会真实发送，避免短信轰炸） */
  async sendResetCode(dto: SendMemberResetCodeDto) {
    const tenantId = await this.resolveTenantId(this.prisma, dto.tenantId);
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { mobile: dto.mobile }) as Prisma.UmsMemberWhereInput,
    });
    if (member) {
      await this.smsCode.sendCode(dto.mobile, SmsVerificationScene.MEMBER_RESET_PASSWORD, tenantId);
    }
    return Result.ok(null, '若该手机号已注册，将收到验证码');
  }

  /**
   * 忘记密码：短信验证通过后重置密码（不注册新账号）
   */
  async resetPassword(dto: MemberResetPasswordDto) {
    const tenantId = await this.resolveTenantId(this.prisma, dto.tenantId);
    await this.passwordReset.assertMemberResetCodeConsumed(dto.mobile, tenantId, dto.code);

    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { mobile: dto.mobile }) as Prisma.UmsMemberWhereInput,
    });
    if (!member) {
      return Result.ok(null, '若验证通过，密码已更新');
    }

    this.passwordPolicy.assertAcceptable(dto.newPassword);
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.umsMember.update({
      where: { memberId: member.memberId },
      data: { password: hashed },
    });
    return Result.ok(null, '密码已重置');
  }

  /** 已登录会员设置/修改密码 */
  async setPassword(memberId: string, dto: MemberSetPasswordDto) {
    this.passwordPolicy.assertAcceptable(dto.newPassword);
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.umsMember.update({
      where: { memberId },
      data: { password: hashed },
    });
    return Result.ok(null, '密码已更新');
  }

  /** 刷新访问令牌 */
  async refreshMemberToken(dto: MemberRefreshDto) {
    const raw = dto.refresh_token.replace(/^Bearer\s+/i, '').trim();
    type RefreshPayload = { uuid: string; memberId: string; platform?: SocialPlatform; typ?: string };
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify(raw, { secret: this.appConfig.jwt.secretkey }) as RefreshPayload;
    } catch {
      BusinessException.throw(ResponseCode.TOKEN_REFRESH_EXPIRED, '刷新令牌无效或已过期');
    }
    BusinessException.throwIf(payload.typ !== 'refresh', '刷新令牌无效', ResponseCode.TOKEN_INVALID);

    const refreshKey = `${CacheEnum.MEMBER_REFRESH_TOKEN_KEY}${payload.uuid}`;
    const session = (await this.redisService.get(refreshKey)) as { accessUuid?: string } | null;
    BusinessException.throwIf(!session || !session.accessUuid, '刷新会话已失效', ResponseCode.TOKEN_REFRESH_EXPIRED);

    await this.redisService.del(refreshKey);
    await this.redisService.del(`${CacheEnum.LOGIN_TOKEN_KEY}${session.accessUuid}`);

    const member = await this.prisma.umsMember.findUnique({
      where: { memberId: payload.memberId },
    });
    BusinessException.throwIf(!member, '用户不存在', ResponseCode.USER_NOT_FOUND);
    BusinessException.throwIf(member.status === MemberStatus.DISABLED, '账号已禁用，请联系客服');

    const platform = payload.platform ?? SocialPlatform.APP_MAIN;
    const dual = await this.genDualToken(member, platform);
    return Result.ok({
      ...this.dualTokenResponseFields(dual),
      userInfo: member,
    });
  }

  /**
   * 退出登录（幂等：无 token 或解析失败也返回成功，避免前端统一响应解析报错）
   */
  async logout(token: string | undefined): Promise<Result> {
    try {
      if (token) {
        const realToken = token.replace('Bearer ', '');
        const payload = this.jwtService.decode(realToken) as { uuid?: string; typ?: string } | null;
        if (payload?.uuid && payload.typ !== 'refresh') {
          const tokenKey = `${CacheEnum.LOGIN_TOKEN_KEY}${payload.uuid}`;
          await this.redisService.del(tokenKey);
        }
      }
    } catch {
      // 忽略错误
    }
    return Result.ok(null, '退出成功');
  }

  // ================= 私有辅助方法 =================

  private dualTokenResponseFields(dual: MemberDualTokens) {
    return {
      access_token: dual.access_token,
      refresh_token: dual.refresh_token,
      expire_in: dual.expire_in,
      refresh_expire_in: dual.refresh_expire_in,
      token: dual.access_token,
      expiresIn: dual.expire_in,
    };
  }

  private parseDurationToMs(expiresIn: string): number {
    const m = /^(\d+)([smhd])$/i.exec(expiresIn.trim());
    if (!m) return 3600_000;
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    const sec = u === 's' ? n : u === 'm' ? n * 60 : u === 'h' ? n * 3600 : n * 86400;
    return sec * 1000;
  }

  /**
   * 签发访问令牌 + 刷新令牌，并写入 Redis 会话
   */
  private async genDualToken(member: UmsMember, platform: SocialPlatform): Promise<MemberDualTokens> {
    const accessUuid = GenerateUUID();
    const refreshUuid = GenerateUUID();
    const accessExpStr = this.appConfig.jwt.expiresin;
    const refreshExpStr = this.appConfig.jwt.refreshExpiresIn;
    const accessMs = this.parseDurationToMs(accessExpStr);
    const refreshMs = this.parseDurationToMs(refreshExpStr);

    const accessPayload = { uuid: accessUuid, memberId: member.memberId, platform, typ: 'access' as const };
    const refreshPayload = { uuid: refreshUuid, memberId: member.memberId, platform, typ: 'refresh' as const };

    const access_token = this.jwtService.sign(accessPayload, { expiresIn: accessExpStr });
    const refresh_token = this.jwtService.sign(refreshPayload, { expiresIn: refreshExpStr });

    const tokenKey = `${CacheEnum.LOGIN_TOKEN_KEY}${accessUuid}`;
    await this.redisService.set(tokenKey, member, accessMs);

    const refreshKey = `${CacheEnum.MEMBER_REFRESH_TOKEN_KEY}${refreshUuid}`;
    await this.redisService.set(refreshKey, { accessUuid: accessUuid }, refreshMs);

    return {
      access_token,
      refresh_token,
      expire_in: Math.floor(accessMs / 1000),
      refresh_expire_in: Math.floor(refreshMs / 1000),
    };
  }

  private async resolveTenantId(tx: AppPrismaTransactionClient, tenantId?: string): Promise<string> {
    const defaultTenantId = '000000';
    if (!tenantId) return defaultTenantId;
    const tenant = await tx.sysTenant.findUnique({ where: { tenantId } });
    return tenant ? tenantId : defaultTenantId;
  }

  private async resolveReferrer(
    tx: AppPrismaTransactionClient,
    referrerId: string | undefined,
    targetTenantId: string,
  ): Promise<{ finalParentId: string | null; finalIndirectParentId: string | null }> {
    let finalParentId: string | null = null;
    let finalIndirectParentId: string | null = null;

    if (!referrerId) return { finalParentId, finalIndirectParentId };

    const referrer = await tx.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', {
        memberId: referrerId,
      }) as Prisma.UmsMemberWhereInput,
      select: { tenantId: true, memberId: true, levelId: true, parentId: true },
    });

    if (!referrer || referrer.levelId < 1) return { finalParentId, finalIndirectParentId };

    const isCrossTenant = referrer.tenantId !== targetTenantId;

    if (isCrossTenant) {
      const distConfig = await tx.sysDistConfig.findFirst({
        where: this.tenantHelper.readWhereForDelegate('sysDistConfig', {
          tenantId: targetTenantId,
        }) as Prisma.SysDistConfigWhereInput,
      });

      if (distConfig?.enableCrossTenant) {
        finalParentId = referrerId;
        if (referrer.levelId === 1 && referrer.parentId) {
          finalIndirectParentId = referrer.parentId;
        }
      } else {
        this.logger.log(`Cross-tenant referrer ${referrerId} rejected: tenant ${targetTenantId} disables cross-tenant`);
      }
    } else {
      finalParentId = referrerId;
      if (referrer.levelId === 1 && referrer.parentId) {
        finalIndirectParentId = referrer.parentId;
      }
    }

    return { finalParentId, finalIndirectParentId };
  }
}
