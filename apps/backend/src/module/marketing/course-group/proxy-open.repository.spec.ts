import { ProxyOpenRepository } from './proxy-open.repository';

describe('ProxyOpenRepository', () => {
  const prisma = {
    playInstance: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const tenantHelper = {
    readWhereForDelegate: jest.fn((_delegate: string, where: unknown) => where),
  };

  let repository: ProxyOpenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProxyOpenRepository(prisma as any, tenantHelper as any);
  });

  it('appendProxyOpenAudit should write into courseGroupTeam facts instead of flat proxyOpenRecords only', async () => {
    prisma.playInstance.findFirst.mockResolvedValue({
      id: 'team-1',
      instanceData: {
        courseGroupTeam: {
          facts: {
            audits: {
              proxyOpen: [],
            },
          },
        },
      },
    });

    await repository.appendProxyOpenAudit({
      teamId: 'team-1',
      tenantId: '000000',
      operatorUserId: 'staff-1',
      leaderUserId: 'leader-1',
      productId: 'prod-1',
      activityContextKey: 'ctx-1',
      reason: '门店代开团',
    });

    expect(prisma.playInstance.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: {
        instanceData: expect.objectContaining({
          latestProxyOpenAt: expect.any(String),
          courseGroupTeam: expect.objectContaining({
            facts: expect.objectContaining({
              audits: expect.objectContaining({
                proxyOpen: [
                  expect.objectContaining({
                    teamId: 'team-1',
                    operatorUserId: 'staff-1',
                    leaderUserId: 'leader-1',
                    productId: 'prod-1',
                    activityContextKey: 'ctx-1',
                    reason: '门店代开团',
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
