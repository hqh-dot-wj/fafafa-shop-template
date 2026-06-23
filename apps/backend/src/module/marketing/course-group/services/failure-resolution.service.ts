import { Injectable } from '@nestjs/common';
import { PlayInstanceStatus } from '@prisma/client';
import { PlayInstanceService } from '../../instance/instance.service';

@Injectable()
export class FailureResolutionService {
  constructor(private readonly playInstanceService: PlayInstanceService) {}

  async resolveMemberFailure(input: {
    memberRecordId: string;
    currentStatus: PlayInstanceStatus;
    reason?: string;
  }) {
    const canTransit =
      input.currentStatus === PlayInstanceStatus.PENDING_PAY ||
      input.currentStatus === PlayInstanceStatus.PAID;

    if (!canTransit) {
      return {
        resolved: true,
        transitioned: false,
      };
    }

    await this.playInstanceService.transitStatus(input.memberRecordId, PlayInstanceStatus.FAILED, {
      failureReason: input.reason ?? '门店人工处理',
    });

    return {
      resolved: true,
      transitioned: true,
    };
  }
}
