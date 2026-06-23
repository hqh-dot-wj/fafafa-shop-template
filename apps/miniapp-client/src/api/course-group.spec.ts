import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpGet = vi.fn();
const httpPost = vi.fn();

vi.mock('@/http/http', () => ({
  httpGet,
  httpPost,
}));

describe('course-group api', () => {
  beforeEach(() => {
    httpGet.mockReset();
    httpPost.mockReset();
  });

  it('uses shared contract types for team list without local normalization', async () => {
    httpGet.mockResolvedValue({
      productId: 'prod-1',
      activityContextKey: 'cg:1',
      activityConfigId: 'config-1',
      canOpen: true,
      allowProxyOpen: false,
      teams: [
        {
          teamId: 'team-1',
          productId: 'prod-1',
          productName: '少儿体适能',
          productImg: 'https://img.example.com/p1.png',
          tenantId: 'tenant-1',
          tenantName: '门店 A',
          activityContextKey: 'cg:1',
          activityConfigId: 'config-1',
          teamStatus: 'RECRUITING',
          leader: { userId: 'leader-1', name: '团长A' },
          minCount: 3,
          maxCount: 6,
          currentMembers: 2,
          paidMembers: 2,
          realMemberCount: 2,
          virtualMemberCount: 0,
          effectiveMemberCount: 2,
          realPaidMemberCount: 2,
          realPaidAmount: 99,
          commissionBaseAmount: 99,
          commissionAmount: 10,
          formedByVirtual: false,
          financeEvidenceReady: true,
          enableVirtualFill: false,
          allowLeaderManualFill: false,
          allowAdminManualFill: false,
          remainingSlots: 1,
          recommended: false,
          joinable: true,
          joinBlockReasonCode: 'JOINABLE',
          joinBlockReasonText: '可参团',
          storeReady: true,
        },
      ],
      total: 1,
      pageNum: 1,
      pageSize: 20,
    });

    const { listCourseGroupTeams } = await import('./course-group');
    const result = await listCourseGroupTeams('prod-1', { tenantId: 'tenant-1' });

    expect(httpGet).toHaveBeenCalledWith(
      '/client/course-group/product/prod-1/teams',
      { tenantId: 'tenant-1' },
      undefined,
      undefined,
    );
    expect(result.teams[0].teamId).toBe('team-1');
    expect(result.teams[0].joinBlockReasonCode).toBe('JOINABLE');
  });

  it('uses dedicated inspect endpoint instead of encoding member flags into detail payload', async () => {
    httpGet
      .mockResolvedValueOnce({
        teamId: 'team-1',
        productId: 'prod-1',
        productName: '少儿体适能',
        productImg: 'https://img.example.com/p1.png',
        tenantId: 'tenant-1',
        tenantName: '门店 A',
        activityContextKey: 'cg:1',
        activityConfigId: 'config-1',
        teamStatus: 'FORMED',
        leader: { userId: 'leader-1', name: '团长A' },
        minCount: 3,
        maxCount: 6,
        currentMembers: 3,
        paidMembers: 2,
        realMemberCount: 2,
        virtualMemberCount: 1,
        effectiveMemberCount: 3,
        realPaidMemberCount: 2,
        realPaidAmount: 99,
        commissionBaseAmount: 99,
        commissionAmount: 10,
        formedByVirtual: true,
        financeEvidenceReady: true,
        enableVirtualFill: true,
        allowLeaderManualFill: false,
        allowAdminManualFill: true,
        remainingSlots: 0,
        recommended: true,
        joinable: false,
        joinBlockReasonCode: 'TEAM_FORMED',
        joinBlockReasonText: '团队已成团',
        storeReady: true,
        detailId: 'team-1',
        viewerRole: 'LEADER',
        viewerJoined: true,
        viewerPaid: true,
        canShare: true,
        canJoin: false,
        teamStatusText: '已成团',
        members: [
          {
            memberId: 'member-1',
            userId: 'member-1',
            name: '真实学员',
            role: 'MEMBER',
            joinedAt: '2026-04-23T10:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        memberId: 'vm-1',
        name: '补位学员',
        role: 'MEMBER',
        memberType: 'VIRTUAL',
        isVirtual: true,
        sourceType: 'ADMIN_MANUAL',
        participatesInOrder: false,
        participatesInAttendance: false,
        participatesInCommission: false,
      });

    const { getCourseGroupTeamDetail, inspectCourseGroupTeamMember } = await import('./course-group');
    const detail = await getCourseGroupTeamDetail('team-1', { tenantId: 'tenant-1' });
    const inspect = await inspectCourseGroupTeamMember('team-1', 'vm-1', { tenantId: 'tenant-1' });

    expect(detail.viewerRole).toBe('LEADER');
    expect(httpGet).toHaveBeenLastCalledWith(
      '/client/course-group/team/team-1/member/vm-1/inspect',
      { tenantId: 'tenant-1' },
      undefined,
      undefined,
    );
    expect(inspect.memberType).toBe('VIRTUAL');
    expect(inspect.participatesInOrder).toBe(false);
  });

  it('passes join-preview payload through shared contract shape', async () => {
    httpPost.mockResolvedValue({
      teamId: 'team-1',
      joinable: false,
      reasonCode: 'TEAM_FORMED',
      reasonText: '团队已成团',
      joinBlockReasonCode: 'TEAM_FORMED',
      joinBlockReasonText: '团队已成团',
      payAmount: 99,
      originalPrice: 129,
      activityPrice: 99,
      remainingSlots: 0,
      message: '团队已成团',
    });

    const { getCourseGroupJoinPreview } = await import('./course-group');
    const preview = await getCourseGroupJoinPreview('team-1', { tenantId: 'tenant-1' });

    expect(httpPost).toHaveBeenCalledWith(
      '/client/course-group/team/team-1/join-preview',
      { tenantId: 'tenant-1' },
      undefined,
      undefined,
      undefined,
    );
    expect(preview.joinBlockReasonText).toBe('团队已成团');
    expect(preview.message).toBe('团队已成团');
  });
});
