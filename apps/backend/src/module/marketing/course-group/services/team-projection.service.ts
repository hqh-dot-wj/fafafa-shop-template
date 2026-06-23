import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { TeamStateService } from './team-state.service';

export const COURSE_GROUP_TEAM_SCHEMA_VERSION = 1;

export type CourseGroupRuntimeStatus = 'IN_CLASS' | 'FINISHED' | 'CLOSED';
export type CourseGroupBaseStatus = 'RECRUITING' | 'FORMED' | 'FAILED' | 'CLOSED';
export type CourseGroupDisplayStatus = CourseGroupBaseStatus | CourseGroupRuntimeStatus;
export type CourseGroupVirtualFillSourceType = 'AUTO' | 'LEADER_MANUAL' | 'ADMIN_MANUAL';
export type CourseGroupVirtualFillActorType = 'SYSTEM' | 'LEADER' | 'ADMIN';

export type CourseGroupProxyOpenAuditRecord = {
  teamId: string;
  operatorUserId: string;
  operatorRole: 'STORE_STAFF';
  leaderUserId: string;
  productId: string;
  activityContextKey?: string | null;
  reason?: string | null;
  createdAt: string;
};

export type CourseGroupRuntimeTransitionAuditRecord = {
  runtimeStatus: CourseGroupRuntimeStatus;
  createdAt: string;
  createdByType?: string;
  createdById?: string;
  reason?: string | null;
};

export type CourseGroupVirtualFillAuditRecord = {
  auditId: string;
  opType: 'ADD' | 'REMOVE';
  virtualMemberId: string;
  displayName?: string;
  avatar?: string | null;
  sourceType: CourseGroupVirtualFillSourceType;
  createdByType: CourseGroupVirtualFillActorType;
  createdById: string;
  createdAt: string;
  reason?: string | null;
};

export type CourseGroupVirtualMemberProjection = {
  virtualMemberId: string;
  displayName: string;
  avatar?: string | null;
  sourceType: CourseGroupVirtualFillSourceType;
  createdByType: CourseGroupVirtualFillActorType;
  createdById: string;
  createdAt: string;
};

export type CourseGroupTeamState = {
  meta: {
    schemaVersion: number;
    lastReconciledAt?: string;
    lastReconcileReason?: string;
  };
  facts: {
    snapshot: Record<string, unknown>;
    audits: {
      proxyOpen: CourseGroupProxyOpenAuditRecord[];
      virtualFill: CourseGroupVirtualFillAuditRecord[];
      runtimeTransition: CourseGroupRuntimeTransitionAuditRecord[];
      reconcile: Array<Record<string, unknown>>;
      memberFailure: Array<Record<string, unknown>>;
    };
  };
  projection?: CourseGroupTeamProjection;
};

export type CourseGroupTeamProjection = {
  counts: {
    realMemberCount: number;
    virtualMemberCount: number;
    effectiveMemberCount: number;
    realPaidMemberCount: number;
    remainingRealSlots: number;
  };
  status: {
    baseStatus: CourseGroupBaseStatus;
    runtimeStatus: CourseGroupRuntimeStatus | null;
    displayStatus: CourseGroupDisplayStatus;
    formedByVirtual: boolean;
  };
  evidence: {
    projectionVersion: number;
    driftFlags: string[];
    courseArtifactsReady: boolean;
    financeProjectionReady: boolean;
  };
  effects: {
    shouldFinalizeGroup: boolean;
    shouldCreateCourseArtifacts: boolean;
    shouldRaiseIncident: boolean;
  };
};

export type BuildTeamProjectionInput = {
  teamId: string;
  leaderStatus: PlayInstanceStatus;
  minCount: number;
  maxCount: number;
  instanceData?: unknown;
  members: Array<{ status: PlayInstanceStatus }>;
};

@Injectable()
export class TeamProjectionService {
  constructor(private readonly teamStateService: TeamStateService = new TeamStateService()) {}

  buildProjection(input: BuildTeamProjectionInput): CourseGroupTeamProjection {
    const root = toCourseGroupRecord(input.instanceData);
    const courseGroupTeam = readCourseGroupTeamState(input.instanceData);
    const virtualMembers = reduceActiveVirtualMembers(courseGroupTeam.facts.audits.virtualFill);
    const realPaidMemberCount = input.members.filter(member => this.teamStateService.isPaidStatus(member.status)).length;
    const realMemberCount = realPaidMemberCount;
    const virtualMemberCount = virtualMembers.length;
    const effectiveMemberCount = realMemberCount + virtualMemberCount;
    const remainingRealSlots = Math.max(0, input.maxCount - effectiveMemberCount);
    const runtimeStatus = this.resolveRuntimeStatus(root, courseGroupTeam);
    const baseStatus = this.toBaseStatus(root, input.leaderStatus, effectiveMemberCount, input.minCount, input.maxCount);
    const displayStatus = runtimeStatus ?? baseStatus;
    const formedByVirtual = effectiveMemberCount >= input.minCount && realMemberCount < input.minCount && virtualMemberCount > 0;
    const driftFlags = this.buildDriftFlags(root, effectiveMemberCount, runtimeStatus, courseGroupTeam);

    return {
      counts: {
        realMemberCount,
        virtualMemberCount,
        effectiveMemberCount,
        realPaidMemberCount,
        remainingRealSlots,
      },
      status: {
        baseStatus,
        runtimeStatus,
        displayStatus,
        formedByVirtual,
      },
      evidence: {
        projectionVersion: COURSE_GROUP_TEAM_SCHEMA_VERSION,
        driftFlags,
        courseArtifactsReady: false,
        financeProjectionReady: false,
      },
      effects: {
        shouldFinalizeGroup: false,
        shouldCreateCourseArtifacts: false,
        shouldRaiseIncident: false,
      },
    };
  }

  listActiveVirtualMembers(instanceData?: unknown): CourseGroupVirtualMemberProjection[] {
    return reduceActiveVirtualMembers(readCourseGroupTeamState(instanceData).facts.audits.virtualFill);
  }

  private resolveRuntimeStatus(
    root: Record<string, unknown>,
    courseGroupTeam: CourseGroupTeamState,
  ): CourseGroupRuntimeStatus | null {
    const runtimeAudits = courseGroupTeam.facts.audits.runtimeTransition;
    const latestRuntimeAudit = runtimeAudits.length > 0 ? runtimeAudits[runtimeAudits.length - 1] : null;
    const auditedRuntime = latestRuntimeAudit?.runtimeStatus;
    if (isRuntimeStatus(auditedRuntime)) {
      return auditedRuntime;
    }

    const legacyRuntime = readString(root.runtimeStatus);
    return isRuntimeStatus(legacyRuntime) ? legacyRuntime : null;
  }

  private toBaseStatus(
    root: Record<string, unknown>,
    leaderStatus: PlayInstanceStatus,
    effectiveMemberCount: number,
    minCount: number,
    maxCount: number,
  ): CourseGroupBaseStatus {
    const status = this.teamStateService.toTeamStatus(
      leaderStatus,
      effectiveMemberCount,
      minCount,
      maxCount,
      {
        closedByStore: readBoolean(root.closedByStore) ?? false,
      },
    );

    if (status === 'FORMED' || status === 'FAILED' || status === 'CLOSED') {
      return status;
    }

    return 'RECRUITING';
  }

  private buildDriftFlags(
    root: Record<string, unknown>,
    effectiveMemberCount: number,
    runtimeStatus: CourseGroupRuntimeStatus | null,
    courseGroupTeam: CourseGroupTeamState,
  ): string[] {
    const driftFlags: string[] = [];
    const legacyCurrentCount = readNumber(root.currentCount);
    if (legacyCurrentCount != null && legacyCurrentCount !== effectiveMemberCount) {
      driftFlags.push('LEGACY_CURRENT_COUNT_MISMATCH');
    }

    const legacyRuntime = readString(root.runtimeStatus);
    if (legacyRuntime && isRuntimeStatus(legacyRuntime) && runtimeStatus === legacyRuntime) {
      if (courseGroupTeam.facts.audits.runtimeTransition.length === 0) {
        driftFlags.push('LEGACY_RUNTIME_STATUS_FALLBACK');
      }
    }

    return driftFlags;
  }
}

export function readCourseGroupTeamState(instanceData?: unknown): CourseGroupTeamState {
  const root = toCourseGroupRecord(instanceData);
  const courseGroupTeam = toCourseGroupRecord(root.courseGroupTeam);
  const facts = toCourseGroupRecord(courseGroupTeam.facts);
  const audits = toCourseGroupRecord(facts.audits);

  return {
    meta: {
      schemaVersion: readNumber(courseGroupTeam.meta && toCourseGroupRecord(courseGroupTeam.meta).schemaVersion) ??
        COURSE_GROUP_TEAM_SCHEMA_VERSION,
      lastReconciledAt: readString(courseGroupTeam.meta && toCourseGroupRecord(courseGroupTeam.meta).lastReconciledAt) ?? undefined,
      lastReconcileReason:
        readString(courseGroupTeam.meta && toCourseGroupRecord(courseGroupTeam.meta).lastReconcileReason) ?? undefined,
    },
    facts: {
      snapshot: toCourseGroupRecord(facts.snapshot),
      audits: {
        proxyOpen: normalizeAuditArray<CourseGroupProxyOpenAuditRecord>(audits.proxyOpen),
        virtualFill: normalizeAuditArray<CourseGroupVirtualFillAuditRecord>(audits.virtualFill),
        runtimeTransition: normalizeAuditArray<CourseGroupRuntimeTransitionAuditRecord>(audits.runtimeTransition),
        reconcile: normalizeAuditArray<Record<string, unknown>>(audits.reconcile),
        memberFailure: normalizeAuditArray<Record<string, unknown>>(audits.memberFailure),
      },
    },
    projection: courseGroupTeam.projection as CourseGroupTeamProjection | undefined,
  };
}

export function writeCourseGroupTeamState(
  instanceData: unknown,
  courseGroupTeam: CourseGroupTeamState,
): Record<string, unknown> {
  const root = toCourseGroupRecord(instanceData);
  return {
    ...root,
    courseGroupTeam,
  };
}

export function reduceActiveVirtualMembers(
  audits: CourseGroupVirtualFillAuditRecord[],
): CourseGroupVirtualMemberProjection[] {
  const activeMap = new Map<string, CourseGroupVirtualMemberProjection>();

  for (const audit of audits) {
    if (audit.opType === 'ADD') {
      if (!audit.displayName) {
        continue;
      }
      activeMap.set(audit.virtualMemberId, {
        virtualMemberId: audit.virtualMemberId,
        displayName: audit.displayName,
        avatar: audit.avatar,
        sourceType: audit.sourceType,
        createdByType: audit.createdByType,
        createdById: audit.createdById,
        createdAt: audit.createdAt,
      });
      continue;
    }

    if (audit.opType === 'REMOVE') {
      activeMap.delete(audit.virtualMemberId);
    }
  }

  return [...activeMap.values()];
}

export function toCourseGroupRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return null;
}

export function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeAuditArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isRuntimeStatus(value: unknown): value is CourseGroupRuntimeStatus {
  return value === 'IN_CLASS' || value === 'FINISHED' || value === 'CLOSED';
}
