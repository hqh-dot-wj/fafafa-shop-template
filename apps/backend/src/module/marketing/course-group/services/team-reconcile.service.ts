import { Injectable } from '@nestjs/common';
import {
  COURSE_GROUP_TEAM_SCHEMA_VERSION,
  type BuildTeamProjectionInput,
  type CourseGroupTeamProjection,
  readCourseGroupTeamState,
  readString,
  TeamProjectionService,
  toCourseGroupRecord,
  writeCourseGroupTeamState,
} from './team-projection.service';
import { TeamStateService } from './team-state.service';

type ReconcileLeaderInstanceDataInput = BuildTeamProjectionInput & {
  reason: string;
  reconciledAt?: string;
};

@Injectable()
export class TeamReconcileService {
  constructor(
    private readonly projectionService: TeamProjectionService = new TeamProjectionService(new TeamStateService()),
  ) {}

  reconcileLeaderInstanceData(input: ReconcileLeaderInstanceDataInput): {
    projection: CourseGroupTeamProjection;
    nextInstanceData: Record<string, unknown>;
  } {
    const reconciledAt = input.reconciledAt ?? new Date().toISOString();
    const projection = this.projectionService.buildProjection(input);
    const courseGroupTeam = readCourseGroupTeamState(input.instanceData);
    const nextCourseGroupTeam = {
      ...courseGroupTeam,
      meta: {
        ...courseGroupTeam.meta,
        schemaVersion: COURSE_GROUP_TEAM_SCHEMA_VERSION,
        lastReconciledAt: reconciledAt,
        lastReconcileReason: input.reason,
      },
      facts: {
        ...courseGroupTeam.facts,
        audits: {
          ...courseGroupTeam.facts.audits,
          reconcile: [
            ...courseGroupTeam.facts.audits.reconcile,
            {
              reason: input.reason,
              status: 'SUCCESS',
              createdAt: reconciledAt,
              effectiveMemberCount: projection.counts.effectiveMemberCount,
              driftFlags: projection.evidence.driftFlags,
            },
          ].slice(-50),
        },
      },
      projection,
    };
    const nextInstanceData = writeCourseGroupTeamState(input.instanceData, nextCourseGroupTeam);
    const latestProxyOpenAt = this.findLatestProxyOpenAt(nextCourseGroupTeam.facts.audits.proxyOpen);

    nextInstanceData.currentCount = projection.counts.effectiveMemberCount;
    if (projection.status.runtimeStatus) {
      nextInstanceData.runtimeStatus = projection.status.runtimeStatus;
      nextInstanceData.runtimeUpdatedAt = reconciledAt;
    }
    if (latestProxyOpenAt) {
      nextInstanceData.latestProxyOpenAt = latestProxyOpenAt;
    }

    return {
      projection,
      nextInstanceData,
    };
  }

  appendFailureAudit(input: {
    instanceData: unknown;
    reason: string;
    message: string;
    createdAt?: string;
  }): Record<string, unknown> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const courseGroupTeam = readCourseGroupTeamState(input.instanceData);
    const nextCourseGroupTeam = {
      ...courseGroupTeam,
      facts: {
        ...courseGroupTeam.facts,
        audits: {
          ...courseGroupTeam.facts.audits,
          reconcile: [
            ...courseGroupTeam.facts.audits.reconcile,
            {
              reason: input.reason,
              status: 'FAILED',
              createdAt,
              message: input.message,
            },
          ].slice(-50),
        },
      },
    };

    return writeCourseGroupTeamState(input.instanceData, nextCourseGroupTeam);
  }

  private findLatestProxyOpenAt(audits: Array<Record<string, unknown>>) {
    const lastAudit = audits.length > 0 ? audits[audits.length - 1] : null;
    return readString(lastAudit && toCourseGroupRecord(lastAudit).createdAt) ?? undefined;
  }
}
