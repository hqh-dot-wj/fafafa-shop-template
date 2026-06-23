import { Injectable, Logger } from '@nestjs/common';
import { DistShareBizType, DistShareEventType, DistShareTokenStatus, Prisma } from '@prisma/client';
import { Readable } from 'stream';
import { BusinessException } from 'src/common/exceptions';
import { BusinessConstants } from 'src/common/constants/business.constants';
import { ResponseCode, Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { GenerateUUID } from 'src/common/utils';
import { PaginationHelper } from 'src/common/utils/pagination.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { WechatService } from 'src/module/client/common/service/wechat.service';
import { RedisService } from 'src/module/common/redis/redis.service';
import { AttributionConfigService } from 'src/module/marketing/common/attribution-config.service';
import { minutesToMillis } from 'src/module/marketing/common/duration.util';
import {
  SHARE_UNAVAILABLE_CODE,
  SHARE_UNAVAILABLE_MESSAGE,
  type ShareUnavailableCode,
} from '../constants/share.constants';
import { CreateShareTokenDto } from '../dto/create-share-token.dto';
import { GenerateShareTokenQrcodeDto } from '../dto/generate-share-token-qrcode.dto';
import { ListShareTokenLogDto } from '../dto/list-share-token-log.dto';
import { ShareTokenLogVo } from '../vo/share-token-log.vo';
import { ShareTokenQrcodeVo, ShareTokenVo } from '../vo/share-token.vo';
import { DistributorEligibilityService } from './distributor-eligibility.service';
import { SharePolicyService } from './share-policy.service';

export interface ClientShareResolveVo {
  available: boolean;
  sid: string;
  code?: ShareUnavailableCode;
  message?: string;
  shareUserId?: string;
  bizType?: string;
  bizId?: string;
  sharePath?: string;
  shareUrl?: string;
  expireAt?: string;
  remainClicks?: number;
  remainBinds?: number;
  remainOrders?: number;
}

export interface TrackShareEventDto {
  sid: string;
  eventType: DistShareEventType;
  orderId?: string;
  ext?: Record<string, unknown>;
}

interface CreateShareTokenInput {
  tenantId: string;
  shareUserId: string;
  bizType: CreateShareTokenDto['bizType'];
  bizId: string;
  linkExpireMinutes?: number;
  maxClickCount?: number;
  maxBindCount?: number;
  maxOrderCount?: number;
  metadata?: Record<string, unknown>;
  targetPath?: string;
  operator: string;
}

interface ApplySidOrderCountOptions {
  tenantId: string;
  orderId: string;
  memberId?: string;
  eventLog?: boolean;
}

@Injectable()
export class ShareTokenService {
  private readonly logger = new Logger(ShareTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly sharePolicyService: SharePolicyService,
    private readonly wechatService: WechatService,
    private readonly uploadService: UploadService,
    private readonly redisService: RedisService,
    private readonly attributionConfigService: AttributionConfigService,
    private readonly distributorEligibilityService: DistributorEligibilityService,
  ) {}

  async createTokenForAdmin(
    tenantId: string,
    dto: CreateShareTokenDto,
    operator: string,
  ): Promise<Result<ShareTokenVo>> {
    return this.createToken({
      tenantId,
      shareUserId: dto.shareUserId,
      bizType: dto.bizType,
      bizId: dto.bizId,
      linkExpireMinutes: dto.linkExpireMinutes,
      maxClickCount: dto.maxClickCount,
      maxBindCount: dto.maxBindCount,
      maxOrderCount: dto.maxOrderCount,
      metadata: dto.metadata,
      targetPath: this.readTargetPath(dto.metadata),
      operator,
    });
  }

  async createTokenForClient(
    memberId: string,
    dto: Omit<CreateShareTokenDto, 'shareUserId'> & { targetPath?: string },
  ): Promise<Result<ShareTokenVo>> {
    const member = await this.prisma.umsMember.findFirst({
      where: { memberId },
      select: { memberId: true, tenantId: true },
    });
    BusinessException.throwIfNull(member, '会员不存在', ResponseCode.USER_NOT_FOUND);

    return this.createToken({
      tenantId: member.tenantId,
      shareUserId: member.memberId,
      bizType: dto.bizType,
      bizId: dto.bizId,
      linkExpireMinutes: dto.linkExpireMinutes,
      maxClickCount: dto.maxClickCount,
      maxBindCount: dto.maxBindCount,
      maxOrderCount: dto.maxOrderCount,
      metadata: dto.metadata,
      targetPath: dto.targetPath || this.readTargetPath(dto.metadata),
      operator: member.memberId,
    });
  }

  async generateShareTokenQrcode(
    tenantId: string,
    dto: GenerateShareTokenQrcodeDto,
    operator: string,
  ): Promise<Result<ShareTokenQrcodeVo>> {
    const token = await this.prisma.sysDistShareToken.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistShareToken', {
        tenantId,
        sid: dto.sid,
      }) as Prisma.SysDistShareTokenWhereInput,
    });
    BusinessException.throwIfNull(token, '分享凭证不存在', ResponseCode.DATA_NOT_FOUND);

    const targetPath = this.resolveTargetPath(token.metadata);
    const page = this.normalizeMiniProgramPath(dto.page || this.stripLeadingSlash(this.entryPagePath()));
    const width = dto.width ?? 430;
    const envVersion = dto.envVersion || 'release';
    const scene = `sid=${token.sid}`;

    const qrBuffer = await this.wechatService.getWxaCodeUnlimited(scene, { page, width, envVersion });
    BusinessException.throwIf(!qrBuffer, '小程序码生成失败', ResponseCode.OPERATION_FAILED);

    const file: Express.Multer.File = {
      originalname: `dist_share_${token.sid}.png`,
      buffer: qrBuffer,
      size: qrBuffer.length,
      mimetype: 'image/png',
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: Readable.from(qrBuffer),
    };
    const uploaded = await this.uploadService.singleFileUpload(file);
    BusinessException.throwIf(!uploaded?.url, '小程序码上传失败', ResponseCode.OPERATION_FAILED);

    const nextMetadata = {
      ...(this.toRecord(token.metadata) || {}),
      qrcodeUrl: uploaded.url,
      qrcodeGeneratedAt: new Date().toISOString(),
      ...(targetPath ? { targetPath } : {}),
    };

    await this.prisma.sysDistShareToken.update({
      where: { id: token.id },
      data: {
        metadata: nextMetadata,
        updateBy: operator,
      },
    });

    return Result.ok({
      sid: token.sid,
      qrCodeUrl: uploaded.url,
      scene,
    });
  }

  async listTokenLogs(
    tenantId: string,
    query: ListShareTokenLogDto,
  ): Promise<Result<{ rows: ShareTokenLogVo[]; total: number }>> {
    const { skip, take } = PaginationHelper.getPagination(query);
    const sourceWhere: Prisma.SysDistShareEventWhereInput = {
      tenantId,
      ...(query.sid ? { sid: query.sid } : {}),
      ...(query.memberId ? { memberId: query.memberId } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
    };
    const where = this.tenantHelper.readWhereForDelegate(
      'sysDistShareEvent',
      sourceWhere,
    ) as Prisma.SysDistShareEventWhereInput;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sysDistShareEvent.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip,
        take,
      }),
      this.prisma.sysDistShareEvent.count({ where }),
    ]);

    return Result.ok({
      rows: rows.map((item) => ({
        id: item.id,
        sid: item.sid,
        tenantId: item.tenantId,
        shareUserId: item.shareUserId,
        memberId: item.memberId,
        eventType: item.eventType,
        bizType: item.bizType,
        bizId: item.bizId,
        eventCode: item.eventCode,
        eventMessage: item.eventMessage,
        orderId: item.orderId,
        metadata: this.toRecord(item.metadata),
        createTime: item.createTime.toISOString(),
      })),
      total,
    });
  }

  async resolveForClient(sid: string, memberId?: string): Promise<Result<ClientShareResolveVo>> {
    const token = await this.prisma.sysDistShareToken.findUnique({ where: { sid } });
    if (!token) {
      return Result.ok(this.buildUnavailableResult(sid, SHARE_UNAVAILABLE_CODE.INVALID));
    }

    const unavailable = await this.validateTokenAvailability(token, memberId);
    if (unavailable) return Result.ok(unavailable);

    const shouldCountClick = await this.shouldIncrementClick(sid, memberId);
    let current = token;
    if (shouldCountClick) {
      const increased = await this.increaseClickCount(token.id, token.maxClickCount);
      if (!increased) {
        await this.writeShareEvent({
          sid: token.sid,
          tenantId: token.tenantId,
          shareUserId: token.shareUserId,
          memberId,
          eventType: DistShareEventType.LIMIT_HIT,
          bizType: token.bizType,
          bizId: token.bizId,
          eventCode: SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED,
          eventMessage: SHARE_UNAVAILABLE_MESSAGE[SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED],
        });
        return Result.ok(this.buildUnavailableResult(token.sid, SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED));
      }

      const refreshed = await this.prisma.sysDistShareToken.findUnique({ where: { id: token.id } });
      if (refreshed) current = refreshed;

      await this.writeShareEvent({
        sid: current.sid,
        tenantId: current.tenantId,
        shareUserId: current.shareUserId,
        memberId,
        eventType: DistShareEventType.CLICK,
        bizType: current.bizType,
        bizId: current.bizId,
      });
    }

    return Result.ok(this.buildAvailableResult(current));
  }

  async trackClientEvent(
    tenantId: string,
    memberId: string,
    dto: TrackShareEventDto,
  ): Promise<Result<{ bound: boolean; code?: string; message?: string }>> {
    const token = await this.prisma.sysDistShareToken.findUnique({ where: { sid: dto.sid } });
    if (!token) {
      return Result.ok({
        bound: false,
        code: SHARE_UNAVAILABLE_CODE.INVALID,
        message: SHARE_UNAVAILABLE_MESSAGE[SHARE_UNAVAILABLE_CODE.INVALID],
      });
    }
    BusinessException.throwIf(
      dto.eventType === DistShareEventType.ORDER_ATTRIBUTED,
      '订单归因事件由服务端订单 worker 写入',
      ResponseCode.PARAM_INVALID,
    );

    let code: string | undefined;
    let message: string | undefined;
    let bound = false;

    if (dto.eventType === DistShareEventType.BIND) {
      if (token.maxBindCount > 0 && token.bindCount >= token.maxBindCount) {
        code = SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED;
        message = '分销绑定次数已达上限';
      } else {
        bound = await this.tryBindMember(token, memberId);
        if (bound) {
          const bindAllowed = await this.increaseBindCount(token.id, token.maxBindCount);
          if (!bindAllowed) {
            code = SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED;
            message = '分销绑定次数已达上限';
          }
        }
      }
    }

    await this.writeShareEvent({
      sid: token.sid,
      tenantId: token.tenantId,
      shareUserId: token.shareUserId,
      memberId,
      eventType: dto.eventType,
      bizType: token.bizType,
      bizId: token.bizId,
      orderId: dto.orderId,
      eventCode: code,
      eventMessage: message,
      metadata: dto.ext,
    });

    return Result.ok({ bound, code, message });
  }

  async findBySid(
    sid: string,
    tenantId: string,
  ): Promise<Prisma.SysDistShareTokenGetPayload<Record<string, never>> | null> {
    const normalizedSid = sid.trim();
    if (!normalizedSid) return null;
    return this.prisma.sysDistShareToken.findFirst({
      where: this.tenantHelper.readWhereForDelegate('sysDistShareToken', {
        sid: normalizedSid,
        tenantId,
      }) as Prisma.SysDistShareTokenWhereInput,
    });
  }

  async applySidOrderCountIncrement(sid: string, options: ApplySidOrderCountOptions): Promise<boolean> {
    const token = await this.findBySid(sid, options.tenantId);
    if (!token || token.status === DistShareTokenStatus.DISABLED) return false;

    const increased = await this.increaseOrderCount(token.id, token.maxOrderCount);
    if (!increased) {
      await this.expireTokenIfOrderLimitReached(token);
      return false;
    }

    await this.expireTokenIfOrderLimitReached({ ...token, orderCount: token.orderCount + 1 });
    if (options.eventLog !== false) {
      await this.writeShareEvent({
        sid: token.sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        memberId: options.memberId,
        eventType: DistShareEventType.ORDER_ATTRIBUTED,
        bizType: token.bizType,
        bizId: token.bizId,
        orderId: options.orderId,
        metadata: { source: 'order_paid_worker' },
      });
    }
    return true;
  }

  async applySidOrderCountDecrement(sid: string, options: ApplySidOrderCountOptions): Promise<boolean> {
    const token = await this.findBySid(sid, options.tenantId);
    if (!token || token.status === DistShareTokenStatus.DISABLED) return false;

    const res = await this.prisma.sysDistShareToken.updateMany({
      where: {
        id: token.id,
        orderCount: { gt: 0 },
        status: { not: DistShareTokenStatus.DISABLED },
      },
      data: {
        orderCount: { decrement: 1 },
        updateBy: 'order.refund.worker',
      },
    });
    if (res.count <= 0) return false;

    if (options.eventLog !== false) {
      await this.writeShareEvent({
        sid: token.sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        memberId: options.memberId,
        eventType: DistShareEventType.ORDER_REFUND_REVERSED,
        bizType: token.bizType,
        bizId: token.bizId,
        orderId: options.orderId,
        metadata: { source: 'order_refund_worker' },
      });
    }
    return true;
  }

  private async createToken(input: CreateShareTokenInput): Promise<Result<ShareTokenVo>> {
    const shareMember = await this.prisma.umsMember.findFirst({
      where: { memberId: input.shareUserId },
      select: { tenantId: true },
    });
    BusinessException.throwIfNull(shareMember, '分享人不存在', ResponseCode.USER_NOT_FOUND);
    BusinessException.throwIf(
      shareMember.tenantId !== input.tenantId,
      '分享人与门店租户不匹配',
      ResponseCode.PARAM_INVALID,
    );

    const policyResult = await this.sharePolicyService.getPolicy(input.tenantId);
    const policy = policyResult.data;
    BusinessException.throwIf(!policy?.isActive, '分销分享策略未启用', ResponseCode.BUSINESS_ERROR);
    await this.distributorEligibilityService.assertActive(input.tenantId, input.shareUserId);

    const sid = await this.generateSid();
    const expireMinutes = await this.attributionConfigService.getLinkExpireMinutes({
      tenantId: input.tenantId,
      override: input.linkExpireMinutes,
    });
    const expireAt = new Date(Date.now() + Math.max(1, expireMinutes) * 60 * 1000);
    const maxClickCount = input.maxClickCount ?? policy.maxClickCount;
    const maxBindCount = input.maxBindCount ?? policy.maxBindCount;
    const maxOrderCount = input.maxOrderCount ?? policy.maxOrderCount;
    const metadata = this.buildTokenMetadata(input.metadata, input.targetPath);

    const created = await this.prisma.sysDistShareToken.create({
      data: {
        sid,
        tenantId: input.tenantId,
        shareUserId: input.shareUserId,
        bizType: input.bizType,
        bizId: input.bizId,
        expireAt,
        maxClickCount,
        maxBindCount,
        maxOrderCount,
        metadata,
        createBy: input.operator,
        updateBy: input.operator,
      },
    });

    return Result.ok(this.toShareTokenVo(created), '分享凭证生成成功');
  }

  private async generateSid(): Promise<string> {
    for (let i = 0; i < 6; i += 1) {
      const sid = `DST_${GenerateUUID().slice(0, 12).toUpperCase()}`;
      const exists = await this.prisma.sysDistShareToken.findUnique({
        where: { sid },
        select: { id: true },
      });
      if (!exists) return sid;
    }
    throw new BusinessException(ResponseCode.OPERATION_FAILED, '分享凭证生成失败，请重试');
  }

  private async validateTokenAvailability(
    token: Prisma.SysDistShareTokenGetPayload<Record<string, never>>,
    memberId?: string,
  ): Promise<ClientShareResolveVo | null> {
    if (token.status === DistShareTokenStatus.DISABLED) {
      await this.writeShareEvent({
        sid: token.sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        memberId,
        eventType: DistShareEventType.MANUAL_DISABLE,
        bizType: token.bizType,
        bizId: token.bizId,
        eventCode: SHARE_UNAVAILABLE_CODE.TOKEN_DISABLED,
        eventMessage: SHARE_UNAVAILABLE_MESSAGE[SHARE_UNAVAILABLE_CODE.TOKEN_DISABLED],
      });
      return this.buildUnavailableResult(token.sid, SHARE_UNAVAILABLE_CODE.TOKEN_DISABLED);
    }

    const now = Date.now();
    if (token.expireAt.getTime() <= now) {
      await this.prisma.sysDistShareToken.updateMany({
        where: { id: token.id, status: DistShareTokenStatus.ACTIVE },
        data: { status: DistShareTokenStatus.EXPIRED, updateBy: 'system' },
      });
      await this.writeShareEvent({
        sid: token.sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        memberId,
        eventType: DistShareEventType.EXPIRED_HIT,
        bizType: token.bizType,
        bizId: token.bizId,
        eventCode: SHARE_UNAVAILABLE_CODE.EXPIRED,
        eventMessage: SHARE_UNAVAILABLE_MESSAGE[SHARE_UNAVAILABLE_CODE.EXPIRED],
      });
      return this.buildUnavailableResult(token.sid, SHARE_UNAVAILABLE_CODE.EXPIRED);
    }

    if (token.maxClickCount > 0 && token.clickCount >= token.maxClickCount) {
      await this.writeShareEvent({
        sid: token.sid,
        tenantId: token.tenantId,
        shareUserId: token.shareUserId,
        memberId,
        eventType: DistShareEventType.LIMIT_HIT,
        bizType: token.bizType,
        bizId: token.bizId,
        eventCode: SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED,
        eventMessage: SHARE_UNAVAILABLE_MESSAGE[SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED],
      });
      return this.buildUnavailableResult(token.sid, SHARE_UNAVAILABLE_CODE.CLICK_LIMIT_REACHED);
    }

    return null;
  }

  private buildUnavailableResult(sid: string, code: ShareUnavailableCode): ClientShareResolveVo {
    return {
      available: false,
      sid,
      code,
      message: SHARE_UNAVAILABLE_MESSAGE[code],
    };
  }

  private buildAvailableResult(token: Prisma.SysDistShareTokenGetPayload<Record<string, never>>): ClientShareResolveVo {
    const targetPath = this.resolveTargetPath(token.metadata);
    return {
      available: true,
      sid: token.sid,
      shareUserId: token.shareUserId,
      bizType: token.bizType,
      bizId: token.bizId,
      sharePath: this.buildSharePath(token.sid, targetPath),
      shareUrl: this.buildSharePath(token.sid, targetPath),
      expireAt: token.expireAt.toISOString(),
      remainClicks: Math.max(0, token.maxClickCount - token.clickCount),
      remainBinds: Math.max(0, token.maxBindCount - token.bindCount),
      remainOrders: Math.max(0, token.maxOrderCount - token.orderCount),
    };
  }

  private async shouldIncrementClick(sid: string, memberId?: string): Promise<boolean> {
    if (!memberId) return true;

    const windowMinutes = BusinessConstants.DISTRIBUTION.SHARE_CLICK_DEDUPE_WINDOW_MINUTES;
    const threshold = new Date(Date.now() - windowMinutes * 60 * 1000);
    const existed = await this.prisma.sysDistShareEvent.findFirst({
      where: {
        sid,
        memberId,
        eventType: DistShareEventType.CLICK,
        createTime: { gte: threshold },
      },
      select: { id: true },
    });
    return !existed;
  }

  private async increaseClickCount(tokenId: string, maxClickCount: number): Promise<boolean> {
    const res = await this.prisma.sysDistShareToken.updateMany({
      where: { id: tokenId, clickCount: { lt: maxClickCount } },
      data: {
        clickCount: { increment: 1 },
        updateBy: 'client.resolve',
      },
    });
    return res.count > 0;
  }

  private async increaseBindCount(tokenId: string, maxBindCount: number): Promise<boolean> {
    const res = await this.prisma.sysDistShareToken.updateMany({
      where: { id: tokenId, bindCount: { lt: maxBindCount } },
      data: {
        bindCount: { increment: 1 },
        updateBy: 'client.event',
      },
    });
    return res.count > 0;
  }

  private async increaseOrderCount(tokenId: string, maxOrderCount: number): Promise<boolean> {
    const res = await this.prisma.sysDistShareToken.updateMany({
      where: {
        id: tokenId,
        orderCount: { lt: maxOrderCount },
        status: { not: DistShareTokenStatus.DISABLED },
      },
      data: {
        orderCount: { increment: 1 },
        updateBy: 'order.paid.worker',
      },
    });
    return res.count > 0;
  }

  private async expireTokenIfOrderLimitReached(token: { id: string; maxOrderCount: number; orderCount: number }) {
    if (token.maxOrderCount <= 0 || token.orderCount < token.maxOrderCount) return;
    await this.prisma.sysDistShareToken.updateMany({
      where: {
        id: token.id,
        status: { not: DistShareTokenStatus.DISABLED },
      },
      data: {
        status: DistShareTokenStatus.EXPIRED,
        updateBy: 'order.paid.worker',
      },
    });
  }

  private async tryBindMember(
    token: Prisma.SysDistShareTokenGetPayload<Record<string, never>>,
    memberId: string,
  ): Promise<boolean> {
    if (!memberId || memberId === token.shareUserId) return false;

    const [targetMember, shareMember] = await Promise.all([
      this.prisma.umsMember.findFirst({
        where: { memberId },
        select: { memberId: true, tenantId: true, parentId: true },
      }),
      this.prisma.umsMember.findFirst({
        where: { memberId: token.shareUserId },
        select: { memberId: true, tenantId: true, parentId: true },
      }),
    ]);

    if (!targetMember || !shareMember) return false;
    if (targetMember.parentId) return false;
    if (!(await this.distributorEligibilityService.isActive(token.tenantId, shareMember.memberId))) {
      return false;
    }

    const policy = (await this.sharePolicyService.getPolicy(token.tenantId)).data;
    if (!policy?.enableCrossTenantBind && targetMember.tenantId !== shareMember.tenantId) {
      return false;
    }

    const circular = await this.hasCircularRelation(targetMember.memberId, shareMember.memberId);
    if (circular) return false;

    const updated = await this.prisma.umsMember.updateMany({
      where: {
        memberId: targetMember.memberId,
        parentId: null,
      },
      data: {
        parentId: shareMember.memberId,
        indirectParentId: shareMember.parentId || null,
      },
    });
    if (updated.count <= 0) return false;

    const activityVersionId = this.resolveActivityVersionId(token);
    const attributionWindowMinutes = await this.attributionConfigService.getAttributionWindowMinutes({
      tenantId: token.tenantId,
      activityVersionId,
    });

    await this.redisService.set(
      `attr:member:${targetMember.memberId}`,
      {
        shareUserId: shareMember.memberId,
        activityVersionId,
        attributionWindowMinutes,
        sourceChannel: 'DIST_SHARE_TOKEN',
      },
      minutesToMillis(attributionWindowMinutes),
    );

    return true;
  }

  private async hasCircularRelation(memberId: string, parentId: string): Promise<boolean> {
    let currentId: string | null = parentId;
    let depth = 0;

    while (currentId && depth < 12) {
      if (currentId === memberId) return true;
      const current = await this.prisma.umsMember.findFirst({
        where: { memberId: currentId },
        select: { parentId: true },
      });
      currentId = current?.parentId || null;
      depth += 1;
    }

    return false;
  }

  private async writeShareEvent(input: {
    sid: string;
    tenantId: string;
    shareUserId?: string;
    memberId?: string;
    eventType: DistShareEventType;
    bizType?: CreateShareTokenDto['bizType'];
    bizId?: string;
    eventCode?: string;
    eventMessage?: string;
    orderId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.sysDistShareEvent.create({
        data: {
          sid: input.sid,
          tenantId: input.tenantId,
          shareUserId: input.shareUserId || null,
          memberId: input.memberId || null,
          eventType: input.eventType,
          bizType: input.bizType,
          bizId: input.bizId || null,
          eventCode: input.eventCode || null,
          eventMessage: input.eventMessage || null,
          orderId: input.orderId || null,
          metadata: input.metadata || null,
        },
      });
    } catch (error) {
      this.logger.warn(`写入分销分享事件失败 sid=${input.sid}: ${(error as Error).message}`);
    }
  }

  private toShareTokenVo(token: Prisma.SysDistShareTokenGetPayload<Record<string, never>>): ShareTokenVo {
    const targetPath = this.resolveTargetPath(token.metadata);
    return {
      sid: token.sid,
      tenantId: token.tenantId,
      shareUserId: token.shareUserId,
      bizType: token.bizType,
      bizId: token.bizId,
      expireAt: token.expireAt.toISOString(),
      maxClickCount: token.maxClickCount,
      maxBindCount: token.maxBindCount,
      maxOrderCount: token.maxOrderCount,
      clickCount: token.clickCount,
      bindCount: token.bindCount,
      orderCount: token.orderCount,
      status: token.status,
      shareUrl: this.buildSharePath(token.sid, targetPath),
      metadata: this.toRecord(token.metadata),
    };
  }

  private readTargetPath(metadata?: Record<string, unknown>): string | undefined {
    if (!metadata) return undefined;
    const direct = metadata.targetPath;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const pagePath = metadata.pagePath;
    if (typeof pagePath === 'string' && pagePath.trim()) return pagePath.trim();
    return undefined;
  }

  private buildTokenMetadata(
    metadata: Record<string, unknown> | undefined,
    targetPath?: string,
  ): Prisma.JsonObject | null {
    const next: Record<string, unknown> = {
      ...(metadata || {}),
      ...(targetPath ? { targetPath } : {}),
    };
    return Object.keys(next).length > 0 ? (next as Prisma.JsonObject) : null;
  }

  private resolveActivityVersionId(
    token: Prisma.SysDistShareTokenGetPayload<Record<string, never>>,
  ): string | undefined {
    const metadata = this.toRecord(token.metadata);
    const fromMetadata = metadata?.activityVersionId;
    if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
      return fromMetadata.trim();
    }

    return token.bizType === DistShareBizType.ACTIVITY ? token.bizId : undefined;
  }

  private resolveTargetPath(metadata: unknown): string | undefined {
    const record = this.toRecord(metadata);
    if (!record) return undefined;
    const targetPath = record.targetPath;
    return typeof targetPath === 'string' && targetPath.trim() ? targetPath.trim() : undefined;
  }

  private buildSharePath(sid: string, targetPath?: string): string {
    const entryPath = this.entryPagePath();
    if (!targetPath) {
      return `${entryPath}?sid=${encodeURIComponent(sid)}`;
    }
    return `${entryPath}?sid=${encodeURIComponent(sid)}&targetPath=${encodeURIComponent(targetPath)}`;
  }

  private entryPagePath(): string {
    const raw = BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_ENTRY_PAGE || 'pages/distribution/entry';
    return raw.startsWith('/') ? raw : `/${raw}`;
  }

  private normalizeMiniProgramPath(path: string): string {
    const normalized = this.stripLeadingSlash(path);
    return normalized || this.stripLeadingSlash(BusinessConstants.DISTRIBUTION.DEFAULT_SHARE_ENTRY_PAGE);
  }

  private stripLeadingSlash(path: string): string {
    return path.replace(/^\/+/, '');
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }
}
