import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import { PrismaService } from 'src/prisma/prisma.service';
import { Result, ResponseCode } from 'src/common/response';
import { BusinessException } from 'src/common/exceptions';
import { Transactional } from 'src/common/decorators/transactional.decorator';
import { ApplyUpgradeDto, UpgradeAttributionContextDto } from './dto/upgrade.dto';
import {
  ReferralCodeVo,
  TeamStatsVo,
  UpgradeApplyVo,
  UpgradeTriggerResultVo,
  UpgradeTriggerSnapshotVo,
} from './vo/upgrade.vo';
import { Prisma } from '@prisma/client';
import { WechatService } from '../common/service/wechat.service';
import { UploadService } from 'src/module/admin/upload/upload.service';
import { GenerateUUID } from 'src/common/utils';
import { getErrorMessage } from 'src/common/utils/error';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { MemberLevel } from 'src/module/admin/member/member.constant';

/**
 * C端会员升级服务
 * 处理升级申请、推荐码管理、团队查询
 */
@Injectable()
export class UpgradeService {
  private readonly logger = new Logger(UpgradeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wechatService: WechatService,
    private readonly uploadService: UploadService,
    private readonly tenantHelper: TenantHelper,
  ) {}

  /**
   * 申请升级 (通过扫描推荐码)
   */
  @Transactional()
  async applyUpgrade(memberId: string, dto: ApplyUpgradeDto): Promise<Result<UpgradeTriggerResultVo>> {
    // 1. 获取当前会员信息
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
    });
    BusinessException.throwIfNull(member, '会员不存在');
    const validMember = member; // 类型收窄：throwIfNull 保证非空

    // 2. 校验等级
    if (validMember.levelId >= dto.targetLevel) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '您已是该等级或更高等级');
    }

    // 3. 校验推荐码 (扫码申请必须有推荐码)
    let referrerId: string | null = null;
    let targetTenantId = validMember.tenantId;
    const applyType = dto.applyType || 'REFERRAL_CODE';

    if (dto.referralCode) {
      // 推荐码 code 全局唯一，解析可能跨租户；禁止 readWhereForDelegate（避免合并当前请求租户）
      const codeRecord = await this.prisma.umsReferralCode.findFirst({
        where: { code: dto.referralCode },
      });

      if (!codeRecord || !codeRecord.isActive) {
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, '推荐码无效或已失效');
      }

      // 推荐人可能归属推荐码所在租户；禁止 readWhereForDelegate（避免合并当前请求租户）
      const referrer = await this.prisma.umsMember.findFirst({
        where: { memberId: codeRecord.memberId },
      });

      if (!referrer || referrer.levelId < 2) {
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, '推荐人不是有效的股东');
      }

      referrerId = referrer.memberId;
      targetTenantId = codeRecord.tenantId;
      await this.assertNoCircularReferral(memberId, referrerId);

      // 更新推荐码使用次数
      await this.prisma.umsReferralCode.update({
        where: { id: codeRecord.id },
        data: { usageCount: { increment: 1 } },
      });
    }

    const triggerSnapshot = this.buildTriggerSnapshot({
      memberId,
      tenantId: targetTenantId,
      applyType,
      orderId: null,
      referralCode: dto.referralCode ?? null,
      referrerId,
      context: dto,
    });

    // 4. 创建升级申请
    const apply = await this.prisma.umsUpgradeApply.create({
      data: {
        tenantId: targetTenantId,
        memberId,
        fromLevel: validMember.levelId,
        toLevel: dto.targetLevel,
        applyType,
        referralCode: dto.referralCode,
        referrerId,
        status: 'APPROVED', // 扫码申请自动通过
        reviewRemark: JSON.stringify(triggerSnapshot),
      },
    });

    // 5. 立即升级会员
    await this.prisma.umsMember.update({
      where: { memberId },
      data: {
        levelId: dto.targetLevel,
        tenantId: targetTenantId, // 升级归属下单/推荐码门店
        parentId: referrerId || validMember.parentId, // 如有新推荐人则更新
        upgradedAt: new Date(),
      },
    });

    this.logger.log(`会员 ${memberId} 升级到等级 ${dto.targetLevel}, 申请ID: ${apply.id}`);

    return Result.ok(
      this.buildUpgradeResult({
        applied: true,
        applyId: apply.id,
        memberId,
        tenantId: targetTenantId,
        fromLevel: validMember.levelId,
        toLevel: dto.targetLevel,
        applyType,
        status: 'APPROVED',
        referralCode: dto.referralCode ?? null,
        orderId: null,
        referrerId,
        triggerSnapshot,
      }),
      '升级成功',
    );
  }

  /**
   * 通过购买商品自动升级 (由订单支付回调触发)
   */
  @Transactional()
  async upgradeByOrder(
    memberId: string,
    orderId: string,
    targetLevel: number,
    tenantId: string,
    context: UpgradeAttributionContextDto = {},
  ): Promise<Result<UpgradeTriggerResultVo>> {
    // 1. 获取会员
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
    });

    if (!member || member.levelId >= targetLevel) {
      this.logger.log(`会员 ${memberId} 无需升级, 当前等级: ${member?.levelId}, 目标: ${targetLevel}`);
      return Result.ok(
        this.buildUpgradeResult({
          applied: false,
          applyId: null,
          memberId,
          tenantId,
          fromLevel: member?.levelId ?? 0,
          toLevel: targetLevel,
          applyType: 'PRODUCT_PURCHASE',
          status: 'SKIPPED',
          referralCode: null,
          orderId,
          referrerId: context.referrerId ?? null,
          triggerSnapshot: this.buildTriggerSnapshot({
            memberId,
            tenantId,
            applyType: 'PRODUCT_PURCHASE',
            orderId,
            referralCode: null,
            referrerId: context.referrerId ?? null,
            context,
          }),
        }),
        '无需升级',
      );
    }

    const triggerSnapshot = this.buildTriggerSnapshot({
      memberId,
      tenantId,
      applyType: 'PRODUCT_PURCHASE',
      orderId,
      referralCode: null,
      referrerId: context.referrerId ?? null,
      context,
    });

    // 2. 创建申请记录
    const apply = await this.prisma.umsUpgradeApply.create({
      data: {
        tenantId,
        memberId,
        fromLevel: member.levelId,
        toLevel: targetLevel,
        applyType: 'PRODUCT_PURCHASE',
        orderId,
        status: 'APPROVED',
        reviewRemark: JSON.stringify(triggerSnapshot),
      },
    });

    // 3. 升级会员
    await this.prisma.umsMember.update({
      where: { memberId },
      data: {
        levelId: targetLevel,
        tenantId, // 升级归属下单门店
        upgradedAt: new Date(),
        upgradeOrderId: orderId,
      },
    });

    // 4. 如果升级到C2，自动生成推荐码
    if (targetLevel === 2) {
      await this.generateReferralCode(memberId, tenantId);
    }

    this.logger.log(`会员 ${memberId} 通过订单 ${orderId} 升级到等级 ${targetLevel}`);
    return Result.ok(
      this.buildUpgradeResult({
        applied: true,
        applyId: apply.id,
        memberId,
        tenantId,
        fromLevel: member.levelId,
        toLevel: targetLevel,
        applyType: 'PRODUCT_PURCHASE',
        status: 'APPROVED',
        referralCode: null,
        orderId,
        referrerId: context.referrerId ?? null,
        matchedActivityVersion: context.activityVersionId ?? null,
        triggerSnapshot,
      }),
      '升级成功',
    );
  }

  /**
   * 获取我的推荐码 (仅C2可用)
   */
  async getMyReferralCode(memberId: string): Promise<ReferralCodeVo | null> {
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
    });

    if (!member || member.levelId < 2) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '仅共享股东可获取推荐码');
    }

    // 查询现有推荐码
    let codeRecord = await this.prisma.umsReferralCode.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsReferralCode', {
        memberId,
        isActive: true,
        tenantId: member.tenantId,
      }) as Prisma.UmsReferralCodeWhereInput,
    });

    // 如果没有则生成
    if (!codeRecord) {
      codeRecord = await this.generateReferralCode(memberId, member.tenantId);
    }

    return {
      code: codeRecord.code,
      qrCodeUrl: codeRecord.qrCodeUrl,
      usageCount: codeRecord.usageCount,
    };
  }

  /**
   * 生成推荐码 (带租户前缀) + 小程序码
   */
  private async generateReferralCode(memberId: string, tenantId: string) {
    // 格式: T001-XXXX (租户前缀 + 随机码)
    const prefix = tenantId.slice(0, 4).toUpperCase();
    const randomPart = GenerateUUID().slice(0, 4).toUpperCase();
    const code = `${prefix}-${randomPart}`;

    let qrCodeUrl: string | null = null;

    // 生成小程序码
    try {
      const scene = `code=${code}`;
      const qrBuffer = await this.wechatService.getWxaCodeUnlimited(scene, {
        page: 'pages/upgrade/referral-code', // 小程序页面路径
        width: 430,
        envVersion: 'release',
      });

      if (qrBuffer) {
        // 上传小程序码图片
        const mockFile: Express.Multer.File = {
          originalname: `referral_${code}.png`,
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

        const uploadResult = await this.uploadService.singleFileUpload(mockFile);
        qrCodeUrl = uploadResult.url;
        this.logger.log(`为会员 ${memberId} 生成小程序码: ${qrCodeUrl}`);
      }
    } catch (error) {
      this.logger.error(`生成小程序码失败: ${getErrorMessage(error)}`);
      // 小程序码生成失败不影响推荐码创建
    }

    const record = await this.prisma.umsReferralCode.create({
      data: {
        tenantId,
        memberId,
        code,
        qrCodeUrl,
        isActive: true,
      },
    });

    this.logger.log(`为会员 ${memberId} 生成推荐码: ${code}`);
    return record;
  }

  /**
   * 获取团队统计
   */
  async getTeamStats(memberId: string): Promise<TeamStatsVo> {
    const member = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId }) as Prisma.UmsMemberWhereInput,
    });

    if (!member) {
      throw new BusinessException(ResponseCode.BUSINESS_ERROR, '会员不存在');
    }

    // 统计直接下级
    const directCount = await this.prisma.umsMember.count({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { parentId: memberId }),
    });

    // 统计间接下级
    const indirectCount = await this.prisma.umsMember.count({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { indirectParentId: memberId }),
    });

    // 统计团队总业绩 (下级的订单总额)
    const directMemberIds = await this.prisma.umsMember.findMany({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { parentId: memberId }),
      select: { memberId: true },
    });

    const indirectMemberIds = await this.prisma.umsMember.findMany({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { indirectParentId: memberId }),
      select: { memberId: true },
    });

    const allMemberIds = [...directMemberIds.map((m) => m.memberId), ...indirectMemberIds.map((m) => m.memberId)];

    let totalTeamSales = new Prisma.Decimal(0);
    if (allMemberIds.length > 0) {
      const result = await this.prisma.omsOrder.aggregate({
        where: this.tenantHelper.readWhereForDelegate('omsOrder', {
          memberId: { in: allMemberIds },
          payStatus: 'PAID',
        }),
        _sum: { payAmount: true },
      });
      totalTeamSales = result._sum.payAmount || new Prisma.Decimal(0);
    }

    const teamSize = directCount + indirectCount;
    const currentLevel = member.levelId;
    const nextLevelConfig =
      currentLevel >= MemberLevel.SHAREHOLDER
        ? null
        : await this.prisma.sysDistLevel.findFirst({
            where: this.tenantHelper.readWhereForDelegate('sysDistLevel', {
              tenantId: member.tenantId,
              levelId: currentLevel + 1,
              isActive: true,
            }) as Prisma.SysDistLevelWhereInput,
            select: {
              levelId: true,
              level1Rate: true,
            },
          });
    const nextLevel = nextLevelConfig?.levelId ?? null;
    const estimatedCommission = nextLevelConfig
      ? Number(totalTeamSales.mul(nextLevelConfig.level1Rate).toDecimalPlaces(2))
      : 0;
    const latestTriggerSnapshot = await this.getLatestUpgradeTriggerSnapshot(memberId);

    return {
      myLevel: currentLevel,
      currentLevel,
      nextLevel,
      teamSize,
      directCount,
      indirectCount,
      totalTeamSales: Number(totalTeamSales),
      estimatedCommission,
      matchedActivityVersion: latestTriggerSnapshot?.activityVersionId ?? null,
    };
  }

  /**
   * 获取我的团队列表
   */
  async getTeamList(memberId: string, type: 'direct' | 'indirect', pageNum: number = 1, pageSize: number = 10) {
    const rawWhere = type === 'direct' ? { parentId: memberId } : { indirectParentId: memberId };
    const scopedListWhere = this.tenantHelper.readWhereForDelegate('umsMember', rawWhere) as Prisma.UmsMemberWhereInput;
    const [list, total] = await Promise.all([
      this.prisma.umsMember.findMany({
        where: scopedListWhere,
        select: {
          memberId: true,
          nickname: true,
          avatar: true,
          levelId: true,
          createTime: true,
        },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        orderBy: { createTime: 'desc' },
      }),
      this.prisma.umsMember.count({
        where: this.tenantHelper.readWhereForDelegate('umsMember', rawWhere) as Prisma.UmsMemberWhereInput,
      }),
    ]);

    return Result.page(list, total);
  }

  /**
   * 查询升级申请状态
   */
  async getUpgradeStatus(memberId: string): Promise<UpgradeApplyVo | null> {
    const apply = await this.prisma.umsUpgradeApply.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsUpgradeApply', {
        memberId,
      }) as Prisma.UmsUpgradeApplyWhereInput,
      orderBy: { createTime: 'desc' },
    });

    if (!apply) return null;

    return {
      id: apply.id,
      fromLevel: apply.fromLevel,
      toLevel: apply.toLevel,
      applyType: apply.applyType,
      status: apply.status,
      createTime: apply.createTime,
    };
  }

  private buildTriggerSnapshot(params: {
    memberId: string;
    tenantId: string;
    applyType: string;
    orderId: string | null;
    referralCode: string | null;
    referrerId: string | null;
    context: UpgradeAttributionContextDto;
  }): UpgradeTriggerSnapshotVo {
    return {
      memberId: params.memberId,
      tenantId: params.tenantId,
      applyType: params.applyType,
      orderId: params.orderId,
      referralCode: params.referralCode,
      referrerId: params.referrerId,
      triggerTime: new Date(),
      activityVersionId: params.context.activityVersionId ?? null,
      attributionWindowMinutes: params.context.attributionWindowMinutes ?? null,
      shareChannel: params.context.shareChannel ?? null,
      sourceSceneCode: params.context.sourceSceneCode ?? null,
      sourceModuleCode: params.context.sourceModuleCode ?? null,
      sourcePagePath: params.context.sourcePagePath ?? null,
      shareUserId: params.context.shareUserId ?? null,
      activityContextKey: params.context.activityContextKey ?? null,
    };
  }

  private buildUpgradeResult(params: {
    applied: boolean;
    applyId: string | null;
    memberId: string;
    tenantId: string;
    fromLevel: number;
    toLevel: number;
    applyType: string;
    status: string;
    referralCode: string | null;
    orderId: string | null;
    referrerId: string | null;
    matchedActivityVersion?: string | null;
    triggerSnapshot: UpgradeTriggerSnapshotVo;
  }): UpgradeTriggerResultVo {
    return {
      applied: params.applied,
      applyId: params.applyId,
      memberId: params.memberId,
      tenantId: params.tenantId,
      fromLevel: params.fromLevel,
      toLevel: params.toLevel,
      applyType: params.applyType,
      status: params.status,
      referralCode: params.referralCode,
      orderId: params.orderId,
      referrerId: params.referrerId,
      matchedActivityVersion: params.matchedActivityVersion ?? params.triggerSnapshot.activityVersionId ?? null,
      triggerSnapshot: params.triggerSnapshot,
    };
  }

  private async assertNoCircularReferral(memberId: string, referrerId: string): Promise<void> {
    let currentId: string | null = referrerId;
    const visited = new Set<string>();

    for (let depth = 0; depth < 10 && currentId; depth += 1) {
      if (currentId === memberId) {
        throw new BusinessException(ResponseCode.BUSINESS_ERROR, '不能形成循环推荐');
      }
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const currentMember = await this.prisma.umsMember.findFirst({
        // 推荐链可能跨租户，循环检测必须按 memberId 全局查询
        where: { memberId: currentId },
        select: { memberId: true, parentId: true },
      });

      if (!currentMember) break;
      currentId = currentMember.parentId;
    }
  }

  private async getLatestUpgradeTriggerSnapshot(
    memberId: string,
  ): Promise<{ activityVersionId?: string | null } | null> {
    const latestApply = await this.prisma.umsUpgradeApply.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsUpgradeApply', {
        memberId,
      }) as Prisma.UmsUpgradeApplyWhereInput,
      orderBy: { createTime: 'desc' },
      select: { reviewRemark: true },
    });

    if (!latestApply?.reviewRemark) {
      return null;
    }

    try {
      const parsed = JSON.parse(latestApply.reviewRemark) as Record<string, unknown>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return {
        activityVersionId:
          typeof parsed.activityVersionId === 'string' && parsed.activityVersionId.trim().length > 0
            ? parsed.activityVersionId
            : null,
      };
    } catch {
      return null;
    }
  }
}
