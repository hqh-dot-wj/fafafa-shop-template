import { Injectable } from '@nestjs/common';
import { Result } from 'src/common/response';

@Injectable()
export class CourseGroupRefundService {
  async refundMemberOnFailure(input: { teamId: string; memberRecordId: string; reason?: string }) {
    return Result.ok({
      teamId: input.teamId,
      memberRecordId: input.memberRecordId,
      reason: input.reason,
      queued: false,
    });
  }

  async refundClosedTeam(input: { teamId: string; reason?: string }) {
    return Result.ok({
      teamId: input.teamId,
      reason: input.reason,
      queued: false,
    });
  }
}
