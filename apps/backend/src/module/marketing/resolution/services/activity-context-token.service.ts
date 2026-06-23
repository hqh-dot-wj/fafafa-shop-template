import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { decodeBase64Url, encodeBase64Url } from './token-codec.util';

const TOKEN_VERSION = 1 as const;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
/**
 * HMAC-SHA256 输出截断到 128 bit（16 字节）。
 *
 * 决策依据：
 * 1. token 通过 URL / 二维码传播，需要短小；完整 32 字节 base64url 后多出 22 个字符。
 * 2. 微信侧短链/二维码长度对扫码识别率敏感，截 128 bit 后 base64url 仅 22 字符，单二维码足够。
 * 3. NIST SP 800-107 §5.3.4 允许将 HMAC-SHA256 截到 ≥128 bit 用于 MAC 场景，
 *    抵抗碰撞与伪造的安全裕度仍超过通用业务（攻击者需 2^64 次尝试），与 OAuth/JWT 短签名取舍一致。
 * 4. token 同时绑 tenantId / memberId / exp，且 exp 默认 24h 限制重放窗口；
 *    即便理论上发生签名截断空间内的碰撞，也无法跨租户跨成员伪造。
 *
 * 若未来接入跨业务 token（不绑 tenant/member），需重新评估到 32 字节。
 */
const SIGNATURE_BYTES = 16;

export type ActivityContextTokenKid = '1' | '2';

interface ActivityContextTokenPayload {
  v: typeof TOKEN_VERSION;
  t: string;
  m: string | null;
  type: string;
  cid: string;
  ver?: string;
  esc?: string;
  emc?: string;
  ctc?: string;
  rpc?: string;
  rrn?: number;
  awm?: number;
  sc?: string;
  iat: number;
  exp: number;
}

export interface ActivityContextTokenIssueInput {
  tenantId: string;
  memberId?: string | null;
  activityType: string;
  activityConfigId: string;
  activityVersionId?: string | null;
  entrySceneCode?: string | null;
  entryModuleCode?: string | null;
  cardTemplateCode?: string | null;
  resolverPolicyCode?: string | null;
  resolverReleaseNo?: number | null;
  attributionWindowMinutes?: number | null;
  shareChannel?: string | null;
  ttlSeconds?: number;
}

export interface ActivityContextTokenVerifyExpected {
  tenantId: string;
  memberId?: string | null;
}

export interface ActivityContextTokenVerifyOptions {
  allowAnonymousMember?: boolean;
  ignoreMember?: boolean;
}

export interface VerifiedActivityContextToken {
  tenantId: string;
  memberId: string | null;
  activityType: string;
  activityConfigId: string;
  activityVersionId?: string;
  entrySceneCode?: string;
  entryModuleCode?: string;
  cardTemplateCode?: string;
  resolverPolicyCode?: string;
  resolverReleaseNo?: number;
  attributionWindowMinutes?: number;
  shareChannel?: string;
  issuedAt: number;
  expiresAt: number;
  signedWith: ActivityContextTokenKid;
}

@Injectable()
export class ActivityContextTokenService {
  issue(input: ActivityContextTokenIssueInput): string {
    const tenantId = this.normalizeRequiredString(input.tenantId, '租户ID不能为空');
    const activityType = this.normalizeRequiredString(input.activityType, '活动类型不能为空');
    const activityConfigId = this.normalizeRequiredString(input.activityConfigId, '活动配置ID不能为空');
    const now = Math.floor(Date.now() / 1000);
    const ttl = this.resolveTtlSeconds(input.ttlSeconds);
    const payload: ActivityContextTokenPayload = {
      v: TOKEN_VERSION,
      t: tenantId,
      m: this.normalizeOptionalString(input.memberId),
      type: activityType,
      cid: activityConfigId,
      iat: now,
      exp: now + ttl,
    };
    const activityVersionId = this.normalizeOptionalString(input.activityVersionId);
    const entrySceneCode = this.normalizeOptionalString(input.entrySceneCode);
    const entryModuleCode = this.normalizeOptionalString(input.entryModuleCode);
    const cardTemplateCode = this.normalizeOptionalString(input.cardTemplateCode);
    const resolverPolicyCode = this.normalizeOptionalString(input.resolverPolicyCode);
    const shareChannel = this.normalizeOptionalString(input.shareChannel);
    if (activityVersionId) payload.ver = activityVersionId;
    if (entrySceneCode) payload.esc = entrySceneCode;
    if (entryModuleCode) payload.emc = entryModuleCode;
    if (cardTemplateCode) payload.ctc = cardTemplateCode;
    if (resolverPolicyCode) payload.rpc = resolverPolicyCode;
    if (typeof input.resolverReleaseNo === 'number' && Number.isFinite(input.resolverReleaseNo)) {
      payload.rrn = Math.trunc(input.resolverReleaseNo);
    }
    if (typeof input.attributionWindowMinutes === 'number' && Number.isFinite(input.attributionWindowMinutes)) {
      payload.awm = Math.trunc(input.attributionWindowMinutes);
    }
    if (shareChannel) payload.sc = shareChannel;

    const payloadB64 = encodeBase64Url(JSON.stringify(payload));
    const kid: ActivityContextTokenKid = '1';
    const signature = this.sign(payloadB64, kid, this.requirePrimarySecret());
    return `${payloadB64}.${kid}.${signature}`;
  }

  verify(
    token: string | null | undefined,
    expected: ActivityContextTokenVerifyExpected,
    options: ActivityContextTokenVerifyOptions = {},
  ): VerifiedActivityContextToken {
    const raw = token?.trim();
    if (!raw) {
      this.throwTokenInvalid('活动上下文缺失');
    }
    const parts = raw.split('.');
    if (parts.length !== 3) {
      this.throwTokenInvalid('活动上下文格式非法');
    }

    const [payloadB64, kidRaw, signature] = parts;
    const kid = this.parseKid(kidRaw);
    const signedWith = this.verifySignature(payloadB64, kid, signature);
    const payload = this.decodePayload(payloadB64);
    this.assertPayloadShape(payload);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new BusinessException(ResponseCode.TOKEN_EXPIRED, '活动上下文已过期，请重新打开商品');
    }
    if (payload.t !== expected.tenantId) {
      this.throwTokenInvalid('活动上下文租户不匹配');
    }

    const actualMemberId = this.normalizeOptionalString(payload.m);
    const expectedMemberId = this.normalizeOptionalString(expected.memberId);
    const anonymousAllowed = options.allowAnonymousMember === true && actualMemberId === null;
    if (!options.ignoreMember && actualMemberId !== expectedMemberId && !anonymousAllowed) {
      this.throwTokenInvalid('活动上下文会员不匹配');
    }

    return {
      tenantId: payload.t,
      memberId: actualMemberId,
      activityType: payload.type,
      activityConfigId: payload.cid,
      activityVersionId: payload.ver,
      entrySceneCode: payload.esc,
      entryModuleCode: payload.emc,
      cardTemplateCode: payload.ctc,
      resolverPolicyCode: payload.rpc,
      resolverReleaseNo: payload.rrn,
      attributionWindowMinutes: payload.awm,
      shareChannel: payload.sc,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      signedWith,
    };
  }

  issueForMember(input: VerifiedActivityContextToken, memberId: string): string {
    return this.issue({
      tenantId: input.tenantId,
      memberId,
      activityType: input.activityType,
      activityConfigId: input.activityConfigId,
      activityVersionId: input.activityVersionId,
      entrySceneCode: input.entrySceneCode,
      entryModuleCode: input.entryModuleCode,
      cardTemplateCode: input.cardTemplateCode,
      resolverPolicyCode: input.resolverPolicyCode,
      resolverReleaseNo: input.resolverReleaseNo,
      attributionWindowMinutes: input.attributionWindowMinutes,
      shareChannel: input.shareChannel,
    });
  }

  private verifySignature(
    payloadB64: string,
    kid: ActivityContextTokenKid,
    signature: string,
  ): ActivityContextTokenKid {
    const primary = this.requirePrimarySecret();
    if (this.signatureMatches(payloadB64, kid, signature, primary)) {
      return '1';
    }

    const secondary = this.readSecondarySecret();
    if (secondary && this.signatureMatches(payloadB64, kid, signature, secondary)) {
      return '2';
    }

    this.throwTokenInvalid('活动上下文签名校验失败');
  }

  private signatureMatches(payloadB64: string, kid: ActivityContextTokenKid, actual: string, secret: string): boolean {
    const expected = this.sign(payloadB64, kid, secret);
    return this.constantTimeEquals(actual, expected);
  }

  private sign(payloadB64: string, kid: ActivityContextTokenKid, secret: string): string {
    const digest = createHmac('sha256', secret).update(`${payloadB64}.${kid}`).digest();
    return encodeBase64Url(digest.subarray(0, SIGNATURE_BYTES));
  }

  private constantTimeEquals(a: string, b: string): boolean {
    const ab = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }

  private decodePayload(payloadB64: string): ActivityContextTokenPayload {
    try {
      const parsed = JSON.parse(decodeBase64Url(payloadB64)) as ActivityContextTokenPayload;
      return parsed;
    } catch {
      this.throwTokenInvalid('活动上下文载荷非法');
    }
  }

  private assertPayloadShape(payload: ActivityContextTokenPayload): void {
    if (
      !payload ||
      payload.v !== TOKEN_VERSION ||
      typeof payload.t !== 'string' ||
      typeof payload.type !== 'string' ||
      typeof payload.cid !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      this.throwTokenInvalid('活动上下文载荷不完整');
    }
  }

  private parseKid(kid: string): ActivityContextTokenKid {
    if (kid === '1' || kid === '2') {
      return kid;
    }
    this.throwTokenInvalid('活动上下文密钥版本未知');
  }

  private requirePrimarySecret(): string {
    const secret = process.env.MARKETING_ACTIVITY_TOKEN_SECRET_PRIMARY;
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new BusinessException(ResponseCode.INTERNAL_SERVER_ERROR, '活动上下文签名密钥未配置');
    }
    return secret;
  }

  private readSecondarySecret(): string | null {
    const secret = process.env.MARKETING_ACTIVITY_TOKEN_SECRET_SECONDARY;
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      return null;
    }
    return secret;
  }

  private resolveTtlSeconds(input?: number): number {
    const raw = input ?? Number(process.env.MARKETING_ACTIVITY_TOKEN_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
    if (!Number.isFinite(raw)) return DEFAULT_TTL_SECONDS;
    const value = Math.trunc(raw);
    if (value <= 0) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, '活动上下文有效期必须大于 0');
    }
    return value;
  }

  private normalizeRequiredString(value: string | null | undefined, message: string): string {
    const normalized = this.normalizeOptionalString(value);
    if (!normalized) {
      throw new BusinessException(ResponseCode.PARAM_INVALID, message);
    }
    return normalized;
  }

  private normalizeOptionalString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private throwTokenInvalid(message: string): never {
    throw new BusinessException(ResponseCode.TOKEN_INVALID, message);
  }
}
