import { Injectable } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions';

type PublishStage = 'DRAFT' | 'PENDING' | 'APPROVED' | 'PUBLISHED';
type MutabilityArea =
  | 'basicInfo'
  | 'audience'
  | 'entitlement'
  | 'touchpointMaterial'
  | 'paceAndCap'
  | 'budget';

type DeleteDecision =
  | {
      action: 'ALLOW_DELETE';
      reason: '草稿且无外部引用，可物理删除';
    }
  | {
      action: 'ARCHIVE_ONLY';
      reason: '活动已有发布痕迹，请改用停用或归档' | '活动存在外部引用或参与记录，请改用归档';
    };

@Injectable()
export class MarketingLifecyclePolicyService {
  decideDelete(input: {
    approvalStatus: PublishStage;
    hasExternalRefs: boolean;
    participationCount: number;
  }): DeleteDecision {
    if (input.approvalStatus !== 'DRAFT') {
      return {
        action: 'ARCHIVE_ONLY',
        reason: '活动已有发布痕迹，请改用停用或归档',
      };
    }

    if (input.hasExternalRefs || input.participationCount > 0) {
      return {
        action: 'ARCHIVE_ONLY',
        reason: '活动存在外部引用或参与记录，请改用归档',
      };
    }

    return {
      action: 'ALLOW_DELETE',
      reason: '草稿且无外部引用，可物理删除',
    };
  }

  assertMutable(input: { area: MutabilityArea; stage: PublishStage }) {
    if (input.stage === 'PUBLISHED' && ['audience', 'entitlement'].includes(input.area)) {
      BusinessException.throwIf(true, '当前区域发布后必须创建新版本');
    }
  }

  getStopModeMatrix() {
    return {
      'pause-new-entry': {
        allowNewEntry: false,
        keepRunning: true,
        cancelQueuedMessages: true,
      },
      'drain-existing': {
        allowNewEntry: false,
        keepRunning: true,
        cancelQueuedMessages: false,
      },
      'hard-stop': {
        allowNewEntry: false,
        keepRunning: false,
        cancelQueuedMessages: true,
      },
      archive: {
        allowNewEntry: false,
        keepRunning: false,
        cancelQueuedMessages: true,
      },
      'fuse-off': {
        allowNewEntry: false,
        keepRunning: false,
        cancelQueuedMessages: true,
      },
    } as const;
  }
}
