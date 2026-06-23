import { TenantContext } from 'src/common/tenant/tenant.context';
import { TenantHelper } from 'src/common/tenant/tenant.helper';
import { PrismaService } from 'src/prisma/prisma.service';
import { ListNotificationDto } from './dto/list-notification.dto';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  let controller: NotificationController;

  const mockPrisma = {
    sysNotificationLog: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn(),
  };

  const mockTenantHelper = {
    readWhereForDelegate: jest.fn((_model: string, where: object) => where),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (actions: Promise<unknown>[]) => Promise.all(actions));
    controller = new NotificationController(
      mockPrisma as unknown as PrismaService,
      mockTenantHelper as unknown as TenantHelper,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses notice permission because the standalone message menu is removed', () => {
    expect(Reflect.getMetadata('permission', NotificationController.prototype.list)).toBe('system:notice:list');
  });

  it('builds marketing-source filters and pagination query', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-1');
    jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(false);

    const query = Object.assign(new ListNotificationDto(), {
      pageNum: 2,
      pageSize: 20,
      channel: 'IN_APP',
      status: 'SENT',
      bizType: 'MARKETING_ACTIVITY',
      bizRefId: 'activity_001',
      activityId: 'activity_001',
      touchpointCode: 'SUCCESS_WELCOME',
      touchpointKind: 'MESSAGE',
      templateCode: 'MKT_ACTIVITY_SUCCESS_V1',
      sceneCode: 'newcomer',
      createTimeFrom: '2026-04-19T00:00:00.000Z',
      createTimeTo: '2026-04-19T23:59:59.000Z',
    });

    await controller.list(query);

    expect(mockTenantHelper.readWhereForDelegate).toHaveBeenCalledWith(
      'sysNotificationLog',
      expect.objectContaining({
        tenantId: 'tenant-1',
        channel: 'IN_APP',
        status: 'SENT',
        bizType: 'MARKETING_ACTIVITY',
        bizRefId: 'activity_001',
        activityId: 'activity_001',
        touchpointCode: 'SUCCESS_WELCOME',
        touchpointKind: 'MESSAGE',
        template: 'MKT_ACTIVITY_SUCCESS_V1',
        sceneCode: 'newcomer',
        createTime: expect.objectContaining({
          gte: new Date('2026-04-19T00:00:00.000Z'),
          lte: new Date('2026-04-19T23:59:59.000Z'),
        }),
      }),
    );
    expect(mockPrisma.sysNotificationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: query.skip,
        take: query.take,
      }),
    );
    expect(mockPrisma.sysNotificationLog.count).toHaveBeenCalled();
  });

  it('does not force tenantId filter for super tenant', async () => {
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue(TenantContext.SUPER_TENANT_ID);
    jest.spyOn(TenantContext, 'isSuperTenant').mockReturnValue(true);

    const query = Object.assign(new ListNotificationDto(), {
      pageNum: 1,
      pageSize: 10,
      bizType: 'MARKETING_ACTIVITY',
    });

    await controller.list(query);

    expect(mockTenantHelper.readWhereForDelegate).toHaveBeenCalledWith(
      'sysNotificationLog',
      expect.not.objectContaining({
        tenantId: expect.any(String),
      }),
    );
  });
});
