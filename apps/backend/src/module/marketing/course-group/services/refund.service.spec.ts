import { CourseGroupRefundService } from './refund.service';

describe('CourseGroupRefundService', () => {
  let service: CourseGroupRefundService;

  beforeEach(() => {
    service = new CourseGroupRefundService();
  });

  describe('invariants', () => {
    it('returns non-queued member refund result with identifiers preserved', async () => {
      const result = await service.refundMemberOnFailure({
        teamId: 'team-1',
        memberRecordId: 'member-record-1',
        reason: 'TEAM_FAILED',
      });

      expect(result.data).toEqual({
        teamId: 'team-1',
        memberRecordId: 'member-record-1',
        reason: 'TEAM_FAILED',
        queued: false,
      });
    });

    it('returns non-queued closed-team refund result with team id preserved', async () => {
      const result = await service.refundClosedTeam({ teamId: 'team-1', reason: 'CLOSED' });

      expect(result.data).toEqual({ teamId: 'team-1', reason: 'CLOSED', queued: false });
    });
  });

  describe('boundary conditions', () => {
    it('keeps reason undefined when caller omits it', async () => {
      const result = await service.refundClosedTeam({ teamId: 'team-1' });

      expect(result.data).toEqual({ teamId: 'team-1', reason: undefined, queued: false });
    });
  });
});
