import { PlayInstanceStatus } from '@prisma/client';
import { TeamReconcileService } from '../services/team-reconcile.service';
import { TeamProjectionService } from '../services/team-projection.service';
import { TeamStateService } from '../services/team-state.service';

describe('TeamReconcileService', () => {
  let service: TeamReconcileService;

  beforeEach(() => {
    service = new TeamReconcileService(new TeamProjectionService(new TeamStateService()));
  });

  it('should rebuild courseGroupTeam projection and patch compatibility fields', () => {
    const reconciled = service.reconcileLeaderInstanceData({
      teamId: 'team-1',
      reason: 'READ_MODEL_REFRESH',
      leaderStatus: PlayInstanceStatus.ACTIVE,
      minCount: 3,
      maxCount: 5,
      instanceData: {
        currentCount: 99,
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-1',
                  displayName: '虚拟成员1',
                  sourceType: 'AUTO',
                  createdByType: 'SYSTEM',
                  createdById: 'system',
                  createdAt: '2026-04-23T10:00:00.000Z',
                },
              ],
            },
          },
        },
      },
      members: [
        { status: PlayInstanceStatus.ACTIVE },
        { status: PlayInstanceStatus.PAID },
      ],
    });

    expect(reconciled.projection.counts).toMatchObject({
      realMemberCount: 2,
      virtualMemberCount: 1,
      effectiveMemberCount: 3,
    });
    expect(reconciled.nextInstanceData).toMatchObject({
      currentCount: 3,
      courseGroupTeam: {
        meta: {
          lastReconcileReason: 'READ_MODEL_REFRESH',
        },
        projection: {
          counts: {
            effectiveMemberCount: 3,
          },
          status: {
            formedByVirtual: true,
          },
        },
      },
    });
    expect(reconciled.nextInstanceData).toEqual(
      expect.objectContaining({
        courseGroupTeam: expect.objectContaining({
          meta: expect.objectContaining({
            lastReconciledAt: expect.any(String),
          }),
        }),
      }),
    );
  });
});
