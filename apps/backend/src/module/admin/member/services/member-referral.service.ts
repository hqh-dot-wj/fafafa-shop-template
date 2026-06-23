import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { MemberRepository } from '../member.repository';
import { BusinessException } from 'src/common/exceptions';
import { ResponseCode } from 'src/common/response';
import { MemberLevel } from '../member.constant';

interface ReferralResolveContext {
  activityVersionId?: string;
  attributionWindowMinutes?: number;
  shareChannel?: string;
  sourceSceneCode?: string;
  sourceModuleCode?: string;
  sourcePagePath?: string;
  shareUserId?: string;
  activityContextKey?: string;
}

interface ReferralResolveResult {
  referralCode: string;
  tenantId: string;
  referrerId: string;
  referrerLevel: number;
  matchedActivityVersion: string | null;
  triggerSnapshot: {
    referralCode: string;
    tenantId: string;
    referrerId: string;
    referrerLevel: number;
    matchedActivityVersion: string | null;
    activityVersionId: string | null;
    attributionWindowMinutes: number | null;
    shareChannel: string | null;
    sourceSceneCode: string | null;
    sourceModuleCode: string | null;
    sourcePagePath: string | null;
    shareUserId: string | null;
    activityContextKey: string | null;
  };
}

interface TeamResultInput {
  currentLevel: number;
  directCount: number;
  indirectCount: number;
  totalTeamSales: number;
  estimatedCommission?: number | null;
  matchedActivityVersion?: string | null;
}

/**
 * 会员推荐关系子服务 (Member Referral Sub-service)
 * 处理 C1/C2 分销层级的推荐人查找、更新及跨店校验
 */
@Injectable()
export class MemberReferralService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    private readonly memberRepo: MemberRepository,
  ) {}

  /**
   * 批量获取会员的推荐人信息 (含 C1 直接推荐和 C2 间接推荐)
   * @param list 会员记录列表
   */
  async getBatchReferralInfo(list: Array<{ parentId?: string | null }>) {
    const parentIds = [...new Set(list.map((item) => item.parentId).filter(Boolean))] as string[];

    // 1. 批量查询直接上级 (C1/C2)
    const parents = await this.prisma.umsMember.findMany({
      where: this.tenantHelper.readWhereForDelegate('umsMember', {
        memberId: { in: parentIds },
      }) as Prisma.UmsMemberWhereInput,
      select: { memberId: true, nickname: true, mobile: true, parentId: true, levelId: true, tenantId: true, referralCode: true },
    });
    const parentMap = new Map(parents.map((r) => [r.memberId, r]));

    // 2. 批量查询间接上级 (通常是 C2 股东)
    const indirectParentIds = [...new Set(parents.map((item) => item.parentId).filter(Boolean))] as string[];
    const indirectParents = await this.prisma.umsMember.findMany({
      where: this.tenantHelper.readWhereForDelegate('umsMember', {
        memberId: { in: indirectParentIds },
      }) as Prisma.UmsMemberWhereInput,
      select: { memberId: true, nickname: true, mobile: true, levelId: true, tenantId: true, referralCode: true },
    });
    const indirectParentMap = new Map(indirectParents.map((r) => [r.memberId, r]));

    return { parentMap, indirectParentMap };
  }

  /** 推荐链最大遍历深度（普通→C1→C2，3 层足够） */
  private static readonly MAX_CHAIN_DEPTH = 10;

  /**
   * 校验并获取新推荐人的间接推荐关系
   * @param memberId 会员 ID
   * @param parentId 新上级 ID
   * @returns 间接推荐人 ID，无则返回 null
   * @throws BusinessException 自引用、循环推荐、推荐人不存在、等级不足
   */
  async validateAndGetIndirectParent(memberId: string, parentId: string): Promise<string | null> {
    BusinessException.throwIf(memberId === parentId, '不可将自己设为推荐人');

    if (!parentId) return null;

    const parent = await this.memberRepo.findById(parentId);
    BusinessException.throwIfNull(parent, '推荐人不存在');
    const validParent = parent; // 类型收窄：throwIfNull 保证非空
    BusinessException.throwIf(validParent.levelId < 1, '推荐人必须是 C1团长 或 C2股东');

    // 循环推荐检测：沿推荐链向上遍历，确保 memberId 不在链中
    await this.checkCircularReferral(memberId, parentId);

    // 间接推荐人计算
    if (validParent.levelId === 1) {
      return validParent.parentId;
    }
    // C2 股东为顶级，无间接推荐人
    return null;
  }

  /**
   * 解析推荐码并返回可落库的触发结果
   * 说明：用于给上层链路透出推荐码、推荐人和活动上下文的标准结果。
   */
  async resolveReferralCode(referralCode: string, memberId?: string, context: ReferralResolveContext = {}): Promise<ReferralResolveResult> {
    const codeRecord = await this.prisma.umsReferralCode.findFirst({
      where: { code: referralCode },
    });
    if (!codeRecord || !codeRecord.isActive) {
      BusinessException.throw(ResponseCode.BUSINESS_ERROR, '推荐码无效或已失效');
    }

    const referrer = await this.prisma.umsMember.findFirst({
      where: this.tenantHelper.readWhereForDelegate('umsMember', { memberId: codeRecord.memberId }) as Prisma.UmsMemberWhereInput,
      select: { memberId: true, levelId: true },
    });
    BusinessException.throwIfNull(referrer, '推荐人不存在');
    const validReferrer = referrer;
    BusinessException.throwIf(validReferrer.levelId < MemberLevel.SHAREHOLDER, '推荐人不是有效的股东');

    if (memberId) {
      await this.validateAndGetIndirectParent(memberId, validReferrer.memberId);
    }

    const matchedActivityVersion = context.activityVersionId ?? null;
    return {
      referralCode: codeRecord.code,
      tenantId: codeRecord.tenantId,
      referrerId: validReferrer.memberId,
      referrerLevel: validReferrer.levelId,
      matchedActivityVersion,
      triggerSnapshot: {
        referralCode: codeRecord.code,
        tenantId: codeRecord.tenantId,
        referrerId: validReferrer.memberId,
        referrerLevel: validReferrer.levelId,
        matchedActivityVersion,
        activityVersionId: context.activityVersionId ?? null,
        attributionWindowMinutes: context.attributionWindowMinutes ?? null,
        shareChannel: context.shareChannel ?? null,
        sourceSceneCode: context.sourceSceneCode ?? null,
        sourceModuleCode: context.sourceModuleCode ?? null,
        sourcePagePath: context.sourcePagePath ?? null,
        shareUserId: context.shareUserId ?? null,
        activityContextKey: context.activityContextKey ?? null,
      },
    };
  }

  /**
   * 将团队基础数据映射为标准结果
   * 说明：这里只做结果归一，不引入任何新的结算逻辑。
   */
  buildTeamResult(input: TeamResultInput) {
    const teamSize = input.directCount + input.indirectCount;
    const nextLevel = input.currentLevel >= MemberLevel.SHAREHOLDER ? null : input.currentLevel + 1;

    return {
      myLevel: input.currentLevel,
      currentLevel: input.currentLevel,
      nextLevel,
      teamSize,
      directCount: input.directCount,
      indirectCount: input.indirectCount,
      totalTeamSales: input.totalTeamSales,
      estimatedCommission: input.estimatedCommission ?? 0,
      matchedActivityVersion: input.matchedActivityVersion ?? null,
    };
  }

  /**
   * 检测循环推荐：从 startId 沿 parentId 链向上遍历，若遇到 targetId 则为循环
   * @param targetId 不允许出现在链中的会员 ID
   * @param startId 遍历起点（新推荐人）
   * @throws BusinessException 检测到循环推荐
   */
  private async checkCircularReferral(targetId: string, startId: string): Promise<void> {
    let currentId: string | null = startId;
    const visited = new Set<string>();

    for (let depth = 0; depth < MemberReferralService.MAX_CHAIN_DEPTH && currentId; depth++) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const member = await this.memberRepo.findById(currentId);
      if (!member) break;

      if (member.parentId === targetId) {
        BusinessException.throwIf(true, '不能形成循环推荐');
      }
      currentId = member.parentId;
    }
  }
}
