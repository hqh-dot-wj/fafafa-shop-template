import { PlayInstanceStatus } from '@prisma/client';
import { TeamProjectionService } from '../services/team-projection.service';
import { TeamStateService } from '../services/team-state.service';

describe('TeamProjectionService', () => {
  let service: TeamProjectionService;

  beforeEach(() => {
    service = new TeamProjectionService(new TeamStateService());
  });

  it('should build projection from real paid members only and flag legacy currentCount drift', () => {
    const projection = service.buildProjection({
      teamId: 'team-1',
      leaderStatus: PlayInstanceStatus.ACTIVE,
      minCount: 3,
      maxCount: 5,
      instanceData: {
        currentCount: 99,
      },
      members: [
        { status: PlayInstanceStatus.ACTIVE },
        { status: PlayInstanceStatus.TIMEOUT },
      ],
    });

    expect(projection.counts).toMatchObject({
      realMemberCount: 1,
      virtualMemberCount: 0,
      effectiveMemberCount: 1,
      realPaidMemberCount: 1,
      remainingRealSlots: 4,
    });
    expect(projection.status).toMatchObject({
      baseStatus: 'RECRUITING',
      displayStatus: 'RECRUITING',
      formedByVirtual: false,
    });
    expect(projection.evidence.driftFlags).toContain('LEGACY_CURRENT_COUNT_MISMATCH');
  });

  it('should count active virtual fill facts toward effective member count', () => {
    const projection = service.buildProjection({
      teamId: 'team-1',
      leaderStatus: PlayInstanceStatus.ACTIVE,
      minCount: 3,
      maxCount: 5,
      instanceData: {
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

    expect(projection.counts).toMatchObject({
      realMemberCount: 2,
      virtualMemberCount: 1,
      effectiveMemberCount: 3,
      realPaidMemberCount: 2,
      remainingRealSlots: 2,
    });
    expect(projection.status).toMatchObject({
      baseStatus: 'FORMED',
      displayStatus: 'FORMED',
      formedByVirtual: true,
    });
  });

  it('should not mark formedByVirtual when real members already satisfy minCount', () => {
    const projection = service.buildProjection({
      teamId: 'team-1',
      leaderStatus: PlayInstanceStatus.ACTIVE,
      minCount: 3,
      maxCount: 5,
      instanceData: {
        courseGroupTeam: {
          facts: {
            audits: {
              virtualFill: [
                {
                  auditId: 'vf-add-1',
                  opType: 'ADD',
                  virtualMemberId: 'vm-1',
                  displayName: '虚拟成员1',
                  sourceType: 'ADMIN_MANUAL',
                  createdByType: 'ADMIN',
                  createdById: 'admin-1',
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
        { status: PlayInstanceStatus.SUCCESS },
      ],
    });

    expect(projection.status).toMatchObject({
      baseStatus: 'FORMED',
      displayStatus: 'FORMED',
      formedByVirtual: false,
    });
  });

  it('should keep projection viewer-independent and omit joinability fields', () => {
    const projection = service.buildProjection({
      teamId: 'team-1',
      leaderStatus: PlayInstanceStatus.ACTIVE,
      minCount: 2,
      maxCount: 4,
      instanceData: {},
      members: [{ status: PlayInstanceStatus.ACTIVE }],
    });

    expect(projection.status).not.toHaveProperty('joinable');
    expect(projection).not.toHaveProperty('viewerRole');
    expect(projection).not.toHaveProperty('viewerJoined');
  });
});
