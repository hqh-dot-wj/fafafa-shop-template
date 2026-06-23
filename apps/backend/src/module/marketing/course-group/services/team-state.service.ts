import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';

export type CourseGroupJoinBlockReasonCode =
  | 'JOINABLE'
  | 'NO_RECRUITING_TEAM'
  | 'VIEWER_ALREADY_JOINED'
  | 'TEAM_FULL'
  | 'TEAM_FORMED'
  | 'TEAM_IN_CLASS'
  | 'TEAM_FINISHED'
  | 'TEAM_FAILED'
  | 'TEAM_CLOSED'
  | 'STORE_NOT_READY'
  | 'ACTIVITY_OFF_SHELF'
  | 'UNKNOWN';

export type CourseGroupJoinDecision = {
  joinable: boolean;
  reasonCode: CourseGroupJoinBlockReasonCode;
  reasonText: string;
};

export type CourseGroupJoinDecisionInput = {
  teamStatus: string;
  remainingSlots: number;
  viewerJoined: boolean;
  activityOnShelf?: boolean;
  storeReady?: boolean;
};

@Injectable()
export class TeamStateService {
  toTeamStatus(
    status: PlayInstanceStatus,
    currentMembers: number,
    minCount: number,
    maxCount: number,
    instanceData?: unknown,
  ): string {
    const runtime = this.readString(this.toRecord(instanceData).runtimeStatus);
    if (runtime === 'IN_CLASS' || runtime === 'FINISHED' || runtime === 'CLOSED') {
      return runtime;
    }

    if (status === PlayInstanceStatus.SUCCESS) return 'FORMED';
    if (status === PlayInstanceStatus.FAILED) {
      return this.readBoolean(this.toRecord(instanceData).closedByStore) ? 'CLOSED' : 'FAILED';
    }
    if (status === PlayInstanceStatus.TIMEOUT) return 'FAILED';
    if (status === PlayInstanceStatus.REFUNDED) return 'CLOSED';
    if (currentMembers >= maxCount || currentMembers >= minCount) return 'FORMED';
    return 'RECRUITING';
  }

  toTeamStatusText(status: string): string {
    switch (status) {
      case 'RECRUITING':
        return '招募中';
      case 'FORMED':
        return '已成团';
      case 'IN_CLASS':
        return '进行中';
      case 'FINISHED':
        return '已结课';
      case 'FAILED':
        return '已失败';
      case 'CLOSED':
        return '已关闭';
      default:
        return status;
    }
  }

  isPaidStatus(status: PlayInstanceStatus): boolean {
    return (
      status === PlayInstanceStatus.PAID ||
      status === PlayInstanceStatus.ACTIVE ||
      status === PlayInstanceStatus.SUCCESS
    );
  }

  countEffectiveMembers(instances: Array<{ status: PlayInstanceStatus }>): number {
    return instances.filter(instance => this.isPaidStatus(instance.status)).length;
  }

  resolveJoinDecision(input: CourseGroupJoinDecisionInput): CourseGroupJoinDecision {
    if (input.activityOnShelf === false) {
      return this.joinDecision(false, 'ACTIVITY_OFF_SHELF');
    }
    if (input.storeReady === false) {
      return this.joinDecision(false, 'STORE_NOT_READY');
    }
    if (input.viewerJoined) {
      return this.joinDecision(false, 'VIEWER_ALREADY_JOINED');
    }

    const status = String(input.teamStatus || '').trim().toUpperCase();
    if (status === 'RECRUITING') {
      return input.remainingSlots > 0
        ? this.joinDecision(true, 'JOINABLE')
        : this.joinDecision(false, 'TEAM_FULL');
    }
    if (status === 'FORMED') {
      return this.joinDecision(false, 'TEAM_FORMED');
    }
    if (status === 'IN_CLASS') {
      return this.joinDecision(false, 'TEAM_IN_CLASS');
    }
    if (status === 'FINISHED') {
      return this.joinDecision(false, 'TEAM_FINISHED');
    }
    if (status === 'FAILED') {
      return this.joinDecision(false, 'TEAM_FAILED');
    }
    if (status === 'CLOSED') {
      return this.joinDecision(false, 'TEAM_CLOSED');
    }

    return this.joinDecision(false, 'UNKNOWN');
  }

  canJoin(teamStatus: string, remainingSlots: number, viewerJoined: boolean): boolean {
    return this.resolveJoinDecision({ teamStatus, remainingSlots, viewerJoined }).joinable;
  }

  private joinDecision(joinable: boolean, reasonCode: CourseGroupJoinBlockReasonCode): CourseGroupJoinDecision {
    return {
      joinable,
      reasonCode,
      reasonText: this.toJoinReasonText(reasonCode),
    };
  }

  private toJoinReasonText(reasonCode: CourseGroupJoinBlockReasonCode): string {
    switch (reasonCode) {
      case 'JOINABLE':
        return '可参团';
      case 'NO_RECRUITING_TEAM':
        return '暂无可加入团队，可先开团';
      case 'VIEWER_ALREADY_JOINED':
        return '你已在团内';
      case 'TEAM_FULL':
        return '名额已满';
      case 'TEAM_FORMED':
        return '团队已成团';
      case 'TEAM_IN_CLASS':
        return '课程进行中';
      case 'TEAM_FINISHED':
        return '课程已结束';
      case 'TEAM_FAILED':
        return '团队已失败';
      case 'TEAM_CLOSED':
        return '团队已关闭';
      case 'STORE_NOT_READY':
        return '门店排课信息未完善';
      case 'ACTIVITY_OFF_SHELF':
        return '活动已下架';
      default:
        return '当前不可参团';
    }
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
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
}
