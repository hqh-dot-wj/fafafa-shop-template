import { TeamRepository } from './team.repository';

describe('TeamRepository', () => {
  const prisma = {
    playInstance: {
      update: jest.fn(),
    },
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
  };

  let repository: TeamRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TeamRepository(prisma as any, tenantHelper as any);
  });

  it('updateTeamRuntimeState should append runtime transition audits under courseGroupTeam facts', async () => {
    await repository.updateTeamRuntimeState(
      'team-1',
      {
        runtimeStatus: 'FORMED',
        courseGroupTeam: {
          facts: {
            audits: {
              runtimeTransition: [],
            },
          },
        },
      },
      'IN_CLASS',
      {
        operatorId: 'store-1',
      },
    );

    expect(prisma.playInstance.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: {
        instanceData: expect.objectContaining({
          runtimeStatus: 'IN_CLASS',
          runtimeUpdatedAt: expect.any(String),
          operatorId: 'store-1',
          courseGroupTeam: expect.objectContaining({
            facts: expect.objectContaining({
              audits: expect.objectContaining({
                runtimeTransition: [
                  expect.objectContaining({
                    runtimeStatus: 'IN_CLASS',
                    createdAt: expect.any(String),
                  }),
                ],
              }),
            }),
          }),
        }),
      },
    });
  });
});
