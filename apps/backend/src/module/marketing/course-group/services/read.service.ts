import { Injectable } from '@nestjs/common';
import { Prisma, PublishStatus } from '@prisma/client';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { Result } from 'src/common/response';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  buildCourseGroupMemberViews,
  fallbackLeaderView,
  isCourseGroupPaidStatus,
  loadCourseGroupProductMap,
  loadCourseGroupStoreMap,
  loadTeamFinancialSnapshot,
  readBooleanByKeys,
  toTeamStatusText,
  type CourseGroupProductMap,
  type CourseGroupStoreMap,
} from '../course-group-read.helpers';
import {
  buildActivityContextKey,
  readBoolean,
  readRuleInt,
  readString,
  resolveTenantId,
  toRecord,
} from '../course-group-util';
import type { TeamDetailAudience, TeamMemberView, TeamSummary } from '../course-group.types';
import {
  TeamRepository,
  type CourseGroupConfigRecord as CourseGroupConfig,
  type CourseGroupInstanceRecord as CourseGroupInstance,
} from '../team.repository';
import { readCourseGroupTeamState, TeamProjectionService } from './team-projection.service';
import { TeamReconcileService } from './team-reconcile.service';
import { TeamStateService } from './team-state.service';
import { TeamCourseRuntimeService, type TeamCourseRuntimeMember } from './team-course-runtime.service';

@Injectable()
export class CourseGroupReadService {
  private readonly teamRepository: TeamRepository;
  private readonly teamStateService: TeamStateService;
  private readonly teamProjectionService: TeamProjectionService;
  private readonly teamReconcileService: TeamReconcileService;
  private readonly teamCourseRuntimeService: TeamCourseRuntimeService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantHelper: TenantHelper,
    teamRepository?: TeamRepository,
    teamStateService?: TeamStateService,
    teamCourseRuntimeService?: TeamCourseRuntimeService,
  ) {
    this.teamRepository = teamRepository ?? new TeamRepository(prisma, tenantHelper);
    this.teamStateService = teamStateService ?? new TeamStateService();
    this.teamProjectionService = new TeamProjectionService(this.teamStateService);
    this.teamReconcileService = new TeamReconcileService(this.teamProjectionService);
    this.teamCourseRuntimeService = teamCourseRuntimeService ?? new TeamCourseRuntimeService(prisma, tenantHelper);
  }

  resolveTenantId(tenantId?: string): string {
    return resolveTenantId(tenantId);
  }

  getTeamRepository() {
    return this.teamRepository;
  }

  getTeamStateService() {
    return this.teamStateService;
  }

  async findCourseGroupConfigByProduct(tenantId: string, productId: string): Promise<CourseGroupConfig> {
    const config = await this.teamRepository.findConfigByProduct(tenantId, productId);
    BusinessException.throwIfNull(config, '当前商品未开启拼课');
    return config!;
  }

  async listProductTeams(input: {
    memberId: string;
    tenantId?: string;
    productId: string;
    activityContextKey?: string;
    pageNum?: number;
    pageSize?: number;
  }) {
    const tenantId = this.resolveTenantId(input.tenantId);
    const config = await this.findCourseGroupConfigByProduct(tenantId, input.productId);
    const openPermissions = this.resolveOpenPermissions(config.rules);
    const teamRows = await this.buildTeamRows({
      tenantId,
      configIds: [config.id],
      productId: input.productId,
      viewerMemberId: input.memberId,
    });

    const pageNum = Math.max(1, Number(input.pageNum ?? 1));
    const pageSize = Math.max(1, Math.min(50, Number(input.pageSize ?? 20)));
    const start = (pageNum - 1) * pageSize;
    const rows = teamRows.slice(start, start + pageSize);

    return Result.ok({
      productId: input.productId,
      productName: teamRows[0]?.productName ?? '拼课商品',
      productImg: teamRows[0]?.productImg ?? '',
      tenantId,
      tenantName: teamRows[0]?.tenantName ?? tenantId,
      activityContextKey: input.activityContextKey ?? buildActivityContextKey(config.id),
      activityConfigId: config.id,
      canOpen: this.isStoreReady(config),
      allowProxyOpen: openPermissions.allowProxyOpen,
      teams: rows,
      total: teamRows.length,
      pageNum,
      pageSize,
      emptyHint: teamRows.length === 0 ? '当前暂无可参与的拼课团队，可以先发起一团。' : undefined,
    });
  }

  async getTeamDetail(input: { memberId: string; tenantId?: string; teamId: string }) {
    return this.getTeamDetailInternal(input, 'client');
  }

  async getStoreTeamDetail(input: { tenantId?: string; teamId: string }) {
    return this.getTeamDetailInternal({ memberId: '', tenantId: input.tenantId, teamId: input.teamId }, 'admin');
  }

  async getStoreTeamCourseSummary(input: { tenantId?: string; teamId: string }) {
    const context = await this.loadTeamRuntimeContext(input);
    return Result.ok(
      await this.teamCourseRuntimeService.getCourseSummary({
        tenantId: context.tenantId,
        teamId: input.teamId,
        teamRuntimeStatus: context.teamStatus,
      }),
    );
  }

  async getStoreTeamSchedules(input: { tenantId?: string; teamId: string }) {
    const tenantId = this.resolveTenantId(input.tenantId);
    await this.ensureStoreTeamExists(tenantId, input.teamId);
    return Result.ok(await this.teamCourseRuntimeService.listSchedules({ tenantId, teamId: input.teamId }));
  }

  async listStoreTeams(input: { tenantId?: string; pageNum?: number; pageSize?: number; status?: string }) {
    const tenantId = this.resolveTenantId(input.tenantId);
    const configs = await this.teamRepository.listStoreConfigs(tenantId);
    const rows = await this.buildTeamRows({
      tenantId,
      configIds: configs.map((config) => config.id),
      viewerMemberId: '',
    });

    const filtered = input.status ? rows.filter((row) => row.teamStatus === input.status) : rows;
    const pageNum = Math.max(1, Number(input.pageNum ?? 1));
    const pageSize = Math.max(1, Math.min(50, Number(input.pageSize ?? 20)));
    const start = (pageNum - 1) * pageSize;

    return Result.ok({
      rows: filtered.slice(start, start + pageSize),
      total: filtered.length,
      pageNum,
      pageSize,
    });
  }

  async loadTeamRuntimeContext(input: { tenantId?: string; teamId: string }) {
    const tenantId = this.resolveTenantId(input.tenantId);
    const leader = await this.teamRepository.findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');

    const config = await this.teamRepository.findConfigById(leader!.configId);
    BusinessException.throwIfNull(config, '拼课活动配置不存在');

    const members = await this.findTeamMembers(tenantId, leader!);
    const projection = this.buildTeamProjection(leader!, config!, members);

    return {
      tenantId,
      leader: leader!,
      config: config!,
      members,
      teamStatus: projection.status.displayStatus,
    };
  }

  async ensureStoreTeamExists(tenantId: string, teamId: string) {
    const leader = await this.teamRepository.findLeaderTeam(tenantId, teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');
  }

  async buildAttendanceMembers(
    leader: CourseGroupInstance,
    members: CourseGroupInstance[],
  ): Promise<TeamCourseRuntimeMember[]> {
    const memberViews = await this.buildMemberViews(leader, members, 'admin');
    return memberViews
      .filter((member) => member.memberType === 'REAL' && member.participatesInAttendance !== false)
      .map((member) => ({
        memberId: member.memberId,
        name: member.name,
        mobile: member.mobile,
      }));
  }

  async findTeamMembers(tenantId: string, leader: CourseGroupInstance) {
    return this.prisma.playInstance.findMany({
      where: this.tenantHelper.readWhereForDelegate('playInstance', {
        tenantId,
        templateCode: 'COURSE_GROUP_BUY',
        configId: leader.configId,
        OR: [{ id: leader.id }, { instanceData: { path: ['parentId'], equals: leader.id } }],
      }) as Prisma.PlayInstanceWhereInput,
      select: {
        id: true,
        tenantId: true,
        memberId: true,
        configId: true,
        templateCode: true,
        orderItemId: true,
        status: true,
        instanceData: true,
        createTime: true,
        updateTime: true,
      },
      orderBy: { createTime: 'asc' },
    });
  }

  async buildMemberViews(
    leader: CourseGroupInstance,
    instances: CourseGroupInstance[],
    audience: TeamDetailAudience,
  ): Promise<TeamMemberView[]> {
    return buildCourseGroupMemberViews({
      prisma: this.prisma,
      tenantHelper: this.tenantHelper,
      teamProjectionService: this.teamProjectionService,
      leader,
      instances,
      audience,
    });
  }

  buildTeamProjection(leader: CourseGroupInstance, config: CourseGroupConfig, members: CourseGroupInstance[]) {
    const minCount = readRuleInt(config.rules, 'minCount', 2);
    const maxCount = readRuleInt(config.rules, 'maxCount', Math.max(2, minCount));

    return this.teamReconcileService.reconcileLeaderInstanceData({
      teamId: leader.id,
      reason: 'RUNTIME_READ',
      leaderStatus: leader.status,
      minCount,
      maxCount,
      instanceData: leader.instanceData,
      members,
    }).projection;
  }

  isStoreReady(config: CourseGroupConfig): boolean {
    const rules = toRecord(config.rules);
    return (
      config.status === PublishStatus.ON_SHELF &&
      readRuleInt(config.rules, 'minCount', 0) > 0 &&
      readRuleInt(config.rules, 'maxCount', 0) >= readRuleInt(config.rules, 'minCount', 0) &&
      Boolean(readString(rules.classAddress))
    );
  }

  resolveOpenPermissions(rules: unknown): { allowQualifiedUserOpen: boolean; allowProxyOpen: boolean } {
    const rec = toRecord(rules);
    return {
      allowQualifiedUserOpen: readBooleanByKeys(rec, ['allowQualifiedUserOpen', 'allowOpen'], false),
      allowProxyOpen: readBooleanByKeys(rec, ['allowStaffProxyOpen', 'allowProxyOpen'], false),
    };
  }

  async updateTeamRuntimeState(
    leaderId: string,
    currentInstanceData: unknown,
    runtimeStatus: 'IN_CLASS' | 'FINISHED' | 'CLOSED',
    extraData?: Record<string, unknown>,
  ) {
    await this.teamRepository.updateTeamRuntimeState(leaderId, currentInstanceData, runtimeStatus, extraData);
  }

  private async getTeamDetailInternal(
    input: { memberId: string; tenantId?: string; teamId: string },
    audience: TeamDetailAudience,
  ) {
    const tenantId = this.resolveTenantId(input.tenantId);
    const leader = await this.teamRepository.findLeaderTeam(tenantId, input.teamId);
    BusinessException.throwIfNull(leader, '拼课团不存在');

    const config = await this.teamRepository.findConfigById(leader!.configId);
    BusinessException.throwIfNull(config, '拼课活动配置不存在');

    const members = await this.findTeamMembers(tenantId, leader!);
    const summary = await this.buildTeamSummary(tenantId, config!, leader!, members, input.memberId);
    const memberViews = await this.buildMemberViews(leader!, members, audience);
    const courseGroupTeam = readCourseGroupTeamState(leader!.instanceData);

    const viewerJoined = members.some((member) => member.memberId === input.memberId);
    const viewerRole = leader!.memberId === input.memberId ? 'LEADER' : viewerJoined ? 'MEMBER' : 'VISITOR';

    return Result.ok({
      ...summary,
      detailId: summary.teamId,
      viewerRole,
      viewerJoined,
      viewerPaid: members.some(
        (member) => member.memberId === input.memberId && isCourseGroupPaidStatus(member.status),
      ),
      canShare: summary.teamStatus === 'RECRUITING',
      canJoin: summary.joinable && !viewerJoined,
      teamStatusText: toTeamStatusText(summary.teamStatus),
      members: memberViews,
      revenueDescription: summary.revenueHint,
      inviteDescription: summary.shareTitle,
      virtualFillAudits: audience === 'admin' ? courseGroupTeam.facts.audits.virtualFill : undefined,
    });
  }

  private async buildTeamRows(input: {
    tenantId: string;
    configIds: string[];
    productId?: string;
    viewerMemberId: string;
  }): Promise<TeamSummary[]> {
    if (input.configIds.length === 0) return [];

    const configs = await this.teamRepository.listConfigsByIds(input.configIds);
    const productIds = input.productId ? [input.productId] : configs.map((config) => config.serviceId);
    const [products, stores, instances] = await Promise.all([
      this.teamRepository.loadProductsByIds(productIds),
      this.teamRepository.loadStores(configs.map((config) => config.tenantId)),
      this.teamRepository.listInstancesByConfigIds(input.tenantId, input.configIds),
    ]);

    const configMap = new Map(configs.map((config) => [config.id, config]));
    const productMap = new Map(products.map((product) => [product.productId, product]));
    const storeMap = new Map(stores.map((store) => [store.tenantId, store.companyName]));
    const grouped = new Map<string, CourseGroupInstance[]>();

    for (const instance of instances) {
      const data = toRecord(instance.instanceData);
      const parentId = readString(data.parentId);
      const isLeader = readBoolean(data.isLeader) ?? false;
      const leaderId = parentId || (isLeader ? instance.id : instance.id);
      if (!grouped.has(leaderId)) grouped.set(leaderId, []);
      grouped.get(leaderId)!.push(instance);
    }

    const summaries: TeamSummary[] = [];
    for (const leaderId of grouped.keys()) {
      const members = grouped.get(leaderId) ?? [];
      const leader = members.find((member) => member.id === leaderId) ?? members[0];
      if (!leader) continue;
      const config = configMap.get(leader.configId);
      if (!config) continue;
      summaries.push(
        await this.buildTeamSummary(
          input.tenantId,
          config,
          leader,
          members,
          input.viewerMemberId,
          productMap,
          storeMap,
        ),
      );
    }
    return summaries.sort((left, right) => right.currentMembers - left.currentMembers);
  }

  private async buildTeamSummary(
    tenantId: string,
    config: CourseGroupConfig,
    leader: CourseGroupInstance,
    members: CourseGroupInstance[],
    viewerMemberId: string,
    externalProductMap?: CourseGroupProductMap,
    externalStoreMap?: CourseGroupStoreMap,
  ): Promise<TeamSummary> {
    const rules = toRecord(config.rules);
    const leaderData = toRecord(leader.instanceData);
    const minCount = readRuleInt(config.rules, 'minCount', 2);
    const maxCount = readRuleInt(config.rules, 'maxCount', Math.max(2, minCount));
    const projection = this.buildTeamProjection(leader, config, members);
    const finance = await loadTeamFinancialSnapshot({
      prisma: this.prisma,
      tenantHelper: this.tenantHelper,
      tenantId,
      members,
    });
    const courseGroupTeam = readCourseGroupTeamState(leader.instanceData);
    const latestVirtualFillAudit = [...courseGroupTeam.facts.audits.virtualFill]
      .reverse()
      .find((audit) => audit.opType === 'ADD');
    const productMap = externalProductMap ?? (await loadCourseGroupProductMap(this.prisma, config.serviceId));
    const storeMap = externalStoreMap ?? (await loadCourseGroupStoreMap(this.prisma, config.tenantId));
    const product = productMap.get(config.serviceId);
    const leaderView = (await this.buildMemberViews(leader, [leader], 'client'))[0] ?? fallbackLeaderView(leader);
    const teamStatus = projection.status.displayStatus;
    const viewerJoined = Boolean(viewerMemberId) && members.some((member) => member.memberId === viewerMemberId);
    const remainingSlots = projection.counts.remainingRealSlots;
    const joinDecision = this.teamStateService.resolveJoinDecision({
      teamStatus,
      remainingSlots,
      viewerJoined,
      activityOnShelf: config.status === PublishStatus.ON_SHELF,
    });

    return {
      teamId: leader.id,
      productId: config.serviceId,
      productName: product?.name ?? readString(leaderData.productName) ?? '拼课商品',
      productImg: product?.mainImages?.[0] ?? readString(leaderData.productImg) ?? '',
      skuId: readString(leaderData.skuId) ?? undefined,
      tenantId,
      tenantName: storeMap.get(config.tenantId) ?? config.tenantId,
      activityContextKey: readString(leaderData.activityContextKey) ?? buildActivityContextKey(config.id),
      activityConfigId: config.id,
      teamStatus,
      leader: {
        userId: leaderView.userId,
        name: leaderView.name,
        avatar: leaderView.avatar,
        mobile: leaderView.mobile,
      },
      classAddress: readString(leaderData.classAddress) ?? readString(rules.classAddress) ?? undefined,
      classStartTime: readString(leaderData.classStartTime) ?? readString(rules.classStartTime) ?? undefined,
      classEndTime: readString(leaderData.classEndTime) ?? readString(rules.classEndTime) ?? undefined,
      minCount,
      maxCount,
      currentMembers: projection.counts.effectiveMemberCount,
      paidMembers: projection.counts.realPaidMemberCount,
      realMemberCount: projection.counts.realMemberCount,
      virtualMemberCount: projection.counts.virtualMemberCount,
      effectiveMemberCount: projection.counts.effectiveMemberCount,
      realPaidMemberCount: projection.counts.realPaidMemberCount,
      realPaidAmount: finance.realPaidAmount,
      commissionBaseAmount: finance.commissionBaseAmount,
      commissionAmount: finance.commissionAmount,
      formedByVirtual: projection.status.formedByVirtual,
      financeEvidenceReady: finance.financeEvidenceReady,
      enableVirtualFill: readBoolean(rules.enableVirtualFill) ?? false,
      allowLeaderManualFill: readBoolean(rules.allowLeaderManualFill) ?? false,
      allowAdminManualFill: readBoolean(rules.allowAdminManualFill) ?? false,
      remainingSlots,
      recommended: projection.status.baseStatus === 'FORMED',
      joinable: joinDecision.joinable,
      joinBlockReasonCode: joinDecision.reasonCode,
      joinBlockReasonText: joinDecision.reasonText,
      storeReady: this.isStoreReady(config),
      ruleSummary: `最少${minCount}人，最多${maxCount}人`,
      revenueHint: readString(rules.revenueHint) ?? '成团后按团长分佣规则结算',
      shareTitle: readString(rules.shareTitle) ?? '邀请你一起拼课',
      latestVirtualFillAt: latestVirtualFillAudit?.createdAt,
      latestVirtualFillSource: latestVirtualFillAudit?.sourceType,
      createTime: leader.createTime.toISOString(),
    };
  }
}
