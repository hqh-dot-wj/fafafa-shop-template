import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import type { UserMarketingContext } from '../dto/user-marketing-context.dto';
import type { ResolvedProduct } from './primary-offer-resolver.service';
import { TeamProjectionService } from '../../course-group/services/team-projection.service';
import { TeamReconcileService } from '../../course-group/services/team-reconcile.service';
import {
  TeamStateService,
  type CourseGroupJoinBlockReasonCode,
  type CourseGroupJoinDecision,
} from '../../course-group/services/team-state.service';

const COURSE_GROUP_ACTIVITY_TYPES = new Set(['COURSE_GROUP', 'COURSE_GROUP_BUY']);
const COURSE_GROUP_INSTANCE_STATUSES = [
  PlayInstanceStatus.PENDING_PAY,
  PlayInstanceStatus.PAID,
  PlayInstanceStatus.ACTIVE,
  PlayInstanceStatus.SUCCESS,
  PlayInstanceStatus.FAILED,
  PlayInstanceStatus.TIMEOUT,
  PlayInstanceStatus.REFUNDED,
] as const;

type CourseGroupSceneInstance = {
  id: string;
  tenantId: string;
  memberId: string;
  configId: string;
  templateCode: string;
  status: PlayInstanceStatus;
  instanceData: unknown;
  createTime: Date;
  updateTime: Date;
};

type CourseGroupActivityCandidate = NonNullable<ResolvedProduct['activityCandidates']>[number];

export type CourseGroupSceneJoinExplain = {
  joinable: boolean;
  reasonCode: CourseGroupJoinBlockReasonCode;
  reasonText: string;
  candidateTeamId?: string;
  teamStatus?: string;
  /** 离满员剩余名额（max − effective） */
  remainingSlots?: number;
  /** 离成班还差人数（min − effective），与 remainingSlots 不可混用 */
  remainingToForm?: number;
  effectiveMemberCount?: number;
  minCount?: number;
  maxCount?: number;
  classStartTime?: string;
  classAddress?: string;
  formedByVirtual?: boolean;
  driftFlags?: string[];
  financeProjectionReady?: boolean;
};

export type CourseGroupSceneExplainItem = {
  domain: 'COURSE_GROUP';
  code: CourseGroupJoinBlockReasonCode;
  message: string;
  severity: 'INFO' | 'WARN';
  source: 'COURSE_GROUP_TEAM_PROJECTION';
};

type TeamExplainCandidate = {
  explain: CourseGroupSceneJoinExplain;
  createdAtMs: number;
};

@Injectable()
export class CourseGroupSceneExplainService {
  private readonly teamStateService = new TeamStateService();
  private readonly teamReconcileService = new TeamReconcileService(new TeamProjectionService(this.teamStateService));

  constructor(private readonly prisma: PrismaService) {}

  async attach(products: ResolvedProduct[], ctx: UserMarketingContext): Promise<ResolvedProduct[]> {
    const courseGroupRefs = products
      .map((product) => ({
        product,
        configId: this.readPrimaryCourseGroupConfigId(product),
      }))
      .filter((item): item is { product: ResolvedProduct; configId: string } => Boolean(item.configId));

    if (courseGroupRefs.length === 0) {
      return products;
    }

    const configIds = [...new Set(courseGroupRefs.map((item) => item.configId))];
    const instances = await this.prisma.playInstance.findMany({
      where: {
        tenantId: ctx.tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        configId: { in: configIds },
        status: { in: [...COURSE_GROUP_INSTANCE_STATUSES] },
      },
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        configId: true,
        templateCode: true,
        status: true,
        instanceData: true,
        createTime: true,
        updateTime: true,
      },
      orderBy: [{ createTime: 'desc' }],
    });

    const groupsByConfigId = this.groupInstancesByConfig(instances);
    const enriched: ResolvedProduct[] = [];
    for (const product of products) {
      const configId = this.readPrimaryCourseGroupConfigId(product);
      if (!configId) {
        enriched.push(product);
        continue;
      }

      const activity = this.findSelectedActivity(product, configId);
      const explain = await this.resolveProductExplain(
        product,
        configId,
        activity,
        groupsByConfigId.get(configId) ?? new Map(),
        ctx,
      );
      const explainItem = this.toSceneExplainItem(explain);

      enriched.push({
        ...product,
        courseGroupJoinExplain: explain,
        explain: [...this.readExplainItems(product.explain), explainItem],
        primaryOffer: {
          ...this.toRecord(product.primaryOffer),
          courseGroupJoinExplain: explain,
        },
      });
    }
    return enriched;
  }

  private async resolveProductExplain(
    product: ResolvedProduct,
    configId: string,
    activity: CourseGroupActivityCandidate | null,
    groups: Map<string, CourseGroupSceneInstance[]>,
    ctx: UserMarketingContext,
  ): Promise<CourseGroupSceneJoinExplain> {
    const rules = this.toRecord(activity?.rules);
    const minCount = this.readPositiveInt(rules.minCount, 2);
    const maxCount = Math.max(minCount, this.readPositiveInt(rules.maxCount, Math.max(2, minCount)));
    const activityOnShelf = !activity || String(activity.status || '').toUpperCase() === 'ON_SHELF';

    if (groups.size === 0) {
      return this.noRecruitingTeamExplain(product, configId, minCount, maxCount, activityOnShelf);
    }

    const leaderIds = [...groups.keys()];
    const extensions = leaderIds.length
      ? await this.prisma.courseGroupBuyExtension.findMany({
          where: { tenantId: ctx.tenantId, instanceId: { in: leaderIds } },
          select: { instanceId: true, classStartTime: true, classAddress: true },
        })
      : [];
    const extensionByLeaderId = new Map(extensions.map((row) => [row.instanceId, row]));

    const candidates: TeamExplainCandidate[] = [];
    for (const [leaderId, members] of groups) {
      const leader = members.find((member) => member.id === leaderId) ?? members[0];
      if (!leader) continue;

      const projection = this.teamReconcileService.reconcileLeaderInstanceData({
        teamId: leader.id,
        reason: 'SCENE_EXPLAIN',
        leaderStatus: leader.status,
        minCount,
        maxCount,
        instanceData: leader.instanceData,
        members,
      }).projection;
      const viewerJoined = Boolean(ctx.memberId) && members.some((member) => member.memberId === ctx.memberId);
      const decision = this.teamStateService.resolveJoinDecision({
        teamStatus: projection.status.displayStatus,
        remainingSlots: projection.counts.remainingRealSlots,
        viewerJoined,
        activityOnShelf,
      });
      const extension = extensionByLeaderId.get(leader.id);
      const classStartTime =
        extension?.classStartTime?.toISOString() ?? this.readString(rules.classStartTime) ?? undefined;
      const classAddress = extension?.classAddress ?? this.readString(rules.classAddress) ?? undefined;

      candidates.push({
        explain: this.buildTeamExplain(decision, {
          teamId: leader.id,
          teamStatus: projection.status.displayStatus,
          remainingSlots: projection.counts.remainingRealSlots,
          effectiveMemberCount: projection.counts.effectiveMemberCount,
          minCount,
          maxCount,
          classStartTime,
          classAddress,
          formedByVirtual: projection.status.formedByVirtual,
          driftFlags: projection.evidence.driftFlags,
          financeProjectionReady: projection.evidence.financeProjectionReady,
        }),
        createdAtMs: leader.createTime.getTime(),
      });
    }

    if (candidates.length === 0) {
      return this.noRecruitingTeamExplain(product, configId, minCount, maxCount, activityOnShelf);
    }

    const joinable = candidates
      .filter((item) => item.explain.joinable)
      .sort((left, right) => {
        const leftToForm = left.explain.remainingToForm ?? Number.MAX_SAFE_INTEGER;
        const rightToForm = right.explain.remainingToForm ?? Number.MAX_SAFE_INTEGER;
        if (leftToForm !== rightToForm) return leftToForm - rightToForm;
        return right.createdAtMs - left.createdAtMs;
      })[0];
    if (joinable) {
      return joinable.explain;
    }

    // 无 joinable 团时：优先展示招募中团（与详情 listCourseGroupTeams 一致），避免默认落到已成团团展示「还差7人」
    return [...candidates].sort((left, right) => {
      const leftRecruiting = left.explain.teamStatus === 'RECRUITING' ? 0 : 1;
      const rightRecruiting = right.explain.teamStatus === 'RECRUITING' ? 0 : 1;
      if (leftRecruiting !== rightRecruiting) return leftRecruiting - rightRecruiting;

      const leftToForm = left.explain.remainingToForm ?? Number.MAX_SAFE_INTEGER;
      const rightToForm = right.explain.remainingToForm ?? Number.MAX_SAFE_INTEGER;
      if (leftToForm !== rightToForm) return leftToForm - rightToForm;

      const priorityDelta =
        this.blockReasonPriority(left.explain.reasonCode) - this.blockReasonPriority(right.explain.reasonCode);
      if (priorityDelta !== 0) return priorityDelta;
      return right.createdAtMs - left.createdAtMs;
    })[0].explain;
  }

  private noRecruitingTeamExplain(
    _product: ResolvedProduct,
    _configId: string,
    minCount: number,
    maxCount: number,
    activityOnShelf: boolean,
  ): CourseGroupSceneJoinExplain {
    if (!activityOnShelf) {
      return {
        joinable: false,
        reasonCode: 'ACTIVITY_OFF_SHELF',
        reasonText: '活动已下架',
        minCount,
        maxCount,
      };
    }
    return {
      joinable: false,
      reasonCode: 'NO_RECRUITING_TEAM',
      reasonText: '暂无可加入团队，可先开团',
      minCount,
      maxCount,
    };
  }

  private buildTeamExplain(
    decision: CourseGroupJoinDecision,
    input: {
      teamId: string;
      teamStatus: string;
      remainingSlots: number;
      effectiveMemberCount: number;
      minCount: number;
      maxCount: number;
      classStartTime?: string;
      classAddress?: string;
      formedByVirtual: boolean;
      driftFlags: string[];
      financeProjectionReady: boolean;
    },
  ): CourseGroupSceneJoinExplain {
    const remainingToForm = Math.max(0, input.minCount - input.effectiveMemberCount);
    return {
      joinable: decision.joinable,
      reasonCode: decision.reasonCode,
      reasonText: this.toSceneReasonText(decision, { ...input, remainingToForm }),
      candidateTeamId: input.teamId,
      teamStatus: input.teamStatus,
      remainingSlots: input.remainingSlots,
      remainingToForm,
      effectiveMemberCount: input.effectiveMemberCount,
      minCount: input.minCount,
      maxCount: input.maxCount,
      classStartTime: input.classStartTime,
      classAddress: input.classAddress,
      formedByVirtual: input.formedByVirtual,
      driftFlags: input.driftFlags,
      financeProjectionReady: input.financeProjectionReady,
    };
  }

  private toSceneReasonText(
    decision: CourseGroupJoinDecision,
    input: {
      teamStatus: string;
      remainingSlots: number;
      remainingToForm: number;
      effectiveMemberCount: number;
      minCount: number;
      formedByVirtual: boolean;
    },
  ): string {
    if (decision.joinable) {
      if (input.remainingToForm > 0) {
        return `离您最近，还差${input.remainingToForm}人即可成团`;
      }
      return '即将成团，可直接参团';
    }
    if (decision.reasonCode === 'TEAM_FORMED' && input.formedByVirtual) {
      return '已补位成团';
    }
    if (input.teamStatus === 'FORMED' && input.remainingSlots > 0) {
      return `已成团，剩余${input.remainingSlots}个名额`;
    }
    return decision.reasonText;
  }

  private toSceneExplainItem(explain: CourseGroupSceneJoinExplain): CourseGroupSceneExplainItem {
    return {
      domain: 'COURSE_GROUP',
      code: explain.reasonCode,
      message: explain.reasonText,
      severity: explain.joinable ? 'INFO' : 'WARN',
      source: 'COURSE_GROUP_TEAM_PROJECTION',
    };
  }

  private groupInstancesByConfig(
    instances: CourseGroupSceneInstance[],
  ): Map<string, Map<string, CourseGroupSceneInstance[]>> {
    const result = new Map<string, Map<string, CourseGroupSceneInstance[]>>();
    for (const instance of instances) {
      const data = this.toRecord(instance.instanceData);
      const parentId = this.readString(data.parentId);
      const isLeader = this.readBoolean(data.isLeader) ?? false;
      const leaderId = parentId || (isLeader ? instance.id : instance.id);
      if (!result.has(instance.configId)) {
        result.set(instance.configId, new Map());
      }
      const groups = result.get(instance.configId)!;
      groups.set(leaderId, [...(groups.get(leaderId) ?? []), instance]);
    }
    return result;
  }

  private findSelectedActivity(product: ResolvedProduct, configId: string): CourseGroupActivityCandidate | null {
    const activities = Array.isArray(product.activityCandidates) ? product.activityCandidates : [];
    return activities.find((activity) => activity.configId === configId) ?? null;
  }

  private readPrimaryCourseGroupConfigId(product: ResolvedProduct): string | null {
    const offer = this.toRecord(product.primaryOffer);
    const activityType = this.readString(offer.activityType)?.toUpperCase();
    if (!activityType || !COURSE_GROUP_ACTIVITY_TYPES.has(activityType)) {
      return null;
    }
    return this.readString(offer.configId);
  }

  private readExplainItems(value: unknown): CourseGroupSceneExplainItem[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is CourseGroupSceneExplainItem => {
      const record = this.toRecord(item);
      return Boolean(this.readString(record.domain) && this.readString(record.code));
    });
  }

  private blockReasonPriority(reasonCode: CourseGroupJoinBlockReasonCode): number {
    switch (reasonCode) {
      case 'VIEWER_ALREADY_JOINED':
        return 10;
      case 'TEAM_FORMED':
        return 20;
      case 'TEAM_FULL':
        return 30;
      case 'TEAM_IN_CLASS':
        return 40;
      case 'TEAM_FINISHED':
        return 50;
      case 'TEAM_CLOSED':
        return 60;
      case 'TEAM_FAILED':
        return 70;
      case 'ACTIVITY_OFF_SHELF':
        return 80;
      case 'STORE_NOT_READY':
        return 90;
      case 'NO_RECRUITING_TEAM':
        return 100;
      default:
        return 110;
    }
  }

  private readPositiveInt(value: unknown, fallback: number): number {
    const parsed = this.readNumber(value);
    if (parsed === null || parsed <= 0) return fallback;
    return Math.trunc(parsed);
  }

  private readNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') return true;
      if (normalized === 'false' || normalized === '0') return false;
    }
    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }
}
